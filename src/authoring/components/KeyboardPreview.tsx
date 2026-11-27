import { useRef, useState } from "react";
import type { KeySlot, LayoutPreset, Orientation, PresetLibraries, ProjectBundle, ProjectMetrics } from "../types";
import { actionLabel, defaultChrome, isPlaceholder, keyStyleColors, rowPercentages, tokenValue } from "../utils";

export type KeyPosition = { row: number; key: number };
export type DropPosition = { row: number; index: number };

type Props = {
  project: ProjectBundle;
  libs: PresetLibraries;
  layout: LayoutPreset;
  metrics: ProjectMetrics;
  orientation: Orientation;
  /** "device" keeps a phone-like width for portrait; "full" uses the container. */
  fit?: "device" | "full";
  /** Draw the candidate bar and toolbar around the keys. */
  chrome?: boolean;
  /** Enable selection, drag & drop, long press and popup. */
  interactive?: boolean;
  selected?: KeyPosition;
  onSelect?: (position: KeyPosition) => void;
  popup?: KeyPosition | null;
  onPopup?: (position: KeyPosition) => void;
  onMoveKey?: (from: KeyPosition, to: DropPosition) => void;
  onMessage?: (message: string) => void;
  onClosePopup?: () => void;
};

/**
 * The single keyboard renderer used by the persistent preview and the layout
 * editor. Read-only when `interactive` is false.
 */
export function KeyboardPreview({
  project, libs, layout, metrics, orientation, fit = "device",
  chrome = false, interactive = false,
  selected, onSelect, popup, onPopup, onMoveKey, onMessage, onClosePopup,
}: Props) {
  const [drag, setDrag] = useState<KeyPosition | null>(null);
  const [drop, setDrop] = useState<DropPosition | null>(null);

  const card = project.theme[project.variant] ?? libs.themeCards[0];
  const color = (token: string, fallback: string) => {
    const value = tokenValue(card, token);
    return value && value !== "transparent" ? value : fallback;
  };
  const colors = {
    bg: color("bg", "#202124"),
    surface: color("surface", "#2d2f31"),
    surfaceAlt: color("surfaceAlt", "#3c4043"),
    border: color("border", "#5f6368"),
    text: color("text", "#e8eaed"),
    textMuted: color("textMuted", "#9aa0a6"),
    primary: color("primary", "#8ab4f8"),
    onPrimary: color("onPrimary", "#202124"),
  };
  const toolbar = (project.chrome ?? defaultChrome()).toolbar;
  const rowHeight = (row: LayoutPreset["rows"][number], key?: KeySlot) =>
    Math.max(24, row.height ?? key?.height ?? metrics.keyHeight ?? 48);

  const resetDrag = () => {
    setDrag(null);
    setDrop(null);
  };

  const moveTo = (from: KeyPosition, to: DropPosition) => {
    onMoveKey?.(from, to);
    resetDrag();
  };

  const popupKey = popup ? layout.rows[popup.row]?.keys[popup.key] : undefined;
  const popupRow = popup ? layout.rows[popup.row] : undefined;

  return (
    <div className="mx-auto w-full" style={{ maxWidth: fit === "device" && orientation === "portrait" ? 360 : undefined }}>
      <div className="overflow-hidden rounded-2xl border-2 p-2 shadow-preview" style={{ borderColor: colors.border, background: colors.bg }}>
        {chrome ? (
          <>
            <div className="mb-1 flex items-center gap-stack rounded px-2 py-1" style={{ background: colors.surfaceAlt, color: colors.text }}>
              <span className="text-3xs" style={{ color: colors.textMuted }}>候选</span>
              <span className="text-caption">你好</span>
              <span className="text-4xs" style={{ color: colors.textMuted }}>nǐ hǎo</span>
              <span className="ml-auto text-4xs" style={{ color: colors.textMuted }}>1/9</span>
            </div>

            <div className="mb-1 flex items-center gap-1 rounded px-1 py-1" style={{ background: colors.surfaceAlt }}>
              <span className="rounded border px-1.5 py-0.5 text-4xs" style={{ borderColor: colors.border, color: colors.text }}>⌄</span>
              <span className="rounded border px-1.5 py-0.5 text-4xs" style={{ borderColor: colors.border, color: colors.text }}>
                {toolbar.primaryButton.label ?? toolbar.primaryButton.action.split("_").pop() ?? "Sym"}
              </span>
              <span className="ml-auto flex gap-1">
                {toolbar.buttons.slice(0, 6).map((button, index) => (
                  <span key={`${button.action}-${index}`} className="rounded border px-1.5 py-0.5 text-4xs" style={{ borderColor: colors.border, color: colors.textMuted }}>
                    {(button.label ?? button.action.split("_").pop() ?? "·").slice(0, 6)}
                  </span>
                ))}
              </span>
            </div>
          </>
        ) : null}

        <div className="relative rounded-lg p-1" style={{ background: colors.surface }}>
          {layout.rows.length === 0 ? (
            <p className="p-2 text-2xs" style={{ color: colors.textMuted }}>这个布局还没有行。</p>
          ) : null}

          {layout.rows.map((row, rowIndex) => {
            const percentages = rowPercentages(row);
            return (
            <div
              key={rowIndex}
              className={`mb-0.5 flex gap-0.5 last:mb-0 ${
                interactive && drop?.row === rowIndex && drop.index >= row.keys.length ? "rounded ring-1 ring-primary" : ""
              }`}
              onDragOver={interactive ? (event) => {
                if (!drag) return;
                event.preventDefault();
                setDrop({ row: rowIndex, index: row.keys.length });
              } : undefined}
              onDrop={interactive ? (event) => {
                if (!drag) return;
                event.preventDefault();
                moveTo(drag, { row: rowIndex, index: row.keys.length });
              } : undefined}
            >
              {row.keys.map((key, keyIndex) => (
                <PreviewKey
                  key={keyIndex}
                  slot={key}
                  widthPercent={percentages[keyIndex] ?? 100}
                  height={rowHeight(row, key)}
                  colors={keyStyleColors(card, project.keyStyles, key.style)}
                  interactive={interactive}
                  selected={interactive && selected?.row === rowIndex && selected?.key === keyIndex}
                  dragging={drag?.row === rowIndex && drag.key === keyIndex}
                  dropBefore={Boolean(drag) && drop?.row === rowIndex && drop.index === keyIndex}
                  actionText={actionLabel(key.click, libs)}
                  onSelect={() => onSelect?.({ row: rowIndex, key: keyIndex })}
                  onPopup={() => onPopup?.({ row: rowIndex, key: keyIndex })}
                  onDragStart={() => setDrag({ row: rowIndex, key: keyIndex })}
                  onDragEnd={resetDrag}
                  onDragOver={(event) => {
                    if (!interactive) return;
                    event.preventDefault();
                    event.stopPropagation();
                    setDrop({ row: rowIndex, index: keyIndex });
                  }}
                  onDrop={(event) => {
                    if (!interactive) return;
                    event.preventDefault();
                    event.stopPropagation();
                    if (drag) moveTo(drag, { row: rowIndex, index: keyIndex });
                  }}
                />
              ))}
            </div>
            );
          })}

          {popup && popupRow && popupKey?.popup?.length ? (() => {
            let top = 4;
            for (let index = 0; index < popup.row; index += 1) top += rowHeight(layout.rows[index]) + 2;
            top += rowHeight(popupRow, popupKey) + 2;
            const popupPercentages = rowPercentages(popupRow);
            const left = popupPercentages.slice(0, popup.key).reduce((sum, value) => sum + value, 0) + (popupPercentages[popup.key] ?? 0) / 2;
            const popupWidth = Math.max(32, metrics.popupWidth ?? 44);
            const popupHeight = Math.max(28, metrics.popupKeyHeight ?? 48);
            const popupTextSize = metrics.popupTextSize ?? 22;
            return (
              <div className="pointer-events-none absolute z-20" style={{ left: `${left}%`, top, transform: "translateX(-50%)" }}>
                <div className="pointer-events-auto flex gap-1 rounded-lg border p-1 shadow-overlay" style={{ background: colors.surfaceAlt, borderColor: colors.border }}>
                  {popupKey.popup.map((item) => (
                    <button
                      key={item}
                      type="button"
                      className="flex items-center justify-center rounded border"
                      style={{ minWidth: popupWidth, height: popupHeight, fontSize: Math.min(popupTextSize, 24), background: colors.surface, color: colors.text, borderColor: colors.border }}
                      onClick={() => { onMessage?.(`popup commits: ${item}`); onClosePopup?.(); }}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            );
          })() : null}
        </div>
      </div>
    </div>
  );
}

function PreviewKey({
  slot, widthPercent, height, colors, interactive, selected, dragging, dropBefore, actionText,
  onSelect, onPopup, onDragStart, onDragEnd, onDragOver, onDrop,
}: {
  slot: KeySlot;
  widthPercent: number;
  height: number;
  colors: { background: string; text: string; border: string; symbol: string };
  interactive: boolean;
  selected: boolean;
  dragging: boolean;
  dropBefore: boolean;
  actionText: string;
  onSelect: () => void;
  onPopup: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDragOver: (event: React.DragEvent<HTMLButtonElement>) => void;
  onDrop: (event: React.DragEvent<HTMLButtonElement>) => void;
}) {
  const timer = useRef<number | undefined>(undefined);
  const fired = useRef(false);

  // Trime creates no Key for a placeholder: it only reserves width, so it is
  // never drawn or pressed. Legacy bundles used an empty text click + off style;
  // both forms are recognized here.
  const spacer = isPlaceholder(slot);

  if (spacer && !interactive) {
    return <span aria-hidden className="block min-w-0" style={{ width: `${widthPercent}%`, height }} />;
  }

  const start = () => {
    if (!interactive) return;
    fired.current = false;
    timer.current = window.setTimeout(() => {
      fired.current = true;
      if (slot.popup?.length) onPopup();
    }, 450);
  };
  const stop = () => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = undefined;
  };

  return (
    <button
      type="button"
      draggable={interactive}
      tabIndex={interactive ? 0 : -1}
      aria-hidden={interactive ? undefined : true}
      className={`relative min-w-0 overflow-hidden rounded-md border px-1 text-caption ${selected ? "ring-2 ring-primary" : ""} ${dragging ? "opacity-40" : ""} ${dropBefore ? "border-l-2 border-primary" : ""} ${spacer ? "border-dashed opacity-60" : ""}`}
      style={{
        width: `${widthPercent}%`,
        height,
        background: spacer ? "transparent" : colors.background,
        color: spacer ? "transparent" : colors.text,
        borderColor: colors.border,
      }}
      title={spacer ? "占位符：只占宽度，不渲染按键" : actionText}
      onPointerDown={interactive ? start : undefined}
      onPointerUp={interactive ? stop : undefined}
      onPointerLeave={interactive ? stop : undefined}
      onClick={interactive ? () => { if (!fired.current) onSelect(); fired.current = false; } : undefined}
      onDoubleClick={interactive ? () => (slot.popup?.length ? onPopup() : onSelect()) : undefined}
      onDragStart={interactive ? (event) => {
        stop();
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", `${slot.label ?? actionText}`);
        onDragStart();
      } : undefined}
      onDragEnd={interactive ? onDragEnd : undefined}
      onDragOver={interactive ? onDragOver : undefined}
      onDrop={interactive ? onDrop : undefined}
    >
      {spacer ? (
        <span className="block text-center text-4xs" style={{ color: colors.symbol }}>间隙</span>
      ) : (
        <>
          <span className="block whitespace-normal break-words leading-tight">{slot.label ?? actionText}</span>
          {slot.label_symbol ? <span className="absolute left-1 top-0 text-4xs" style={{ color: colors.symbol }}>{slot.label_symbol}</span> : null}
          {slot.hint ? <span className="absolute inset-x-1 bottom-0 truncate text-4xs" style={{ color: colors.symbol }}>{slot.hint}</span> : null}
          {slot.popup?.length ? <span className="absolute right-1 top-0 text-4xs opacity-70">▾</span> : null}
          {slot.long_click ? <span className="absolute right-1 bottom-0 text-4xs opacity-60">↳</span> : null}
        </>
      )}
    </button>
  );
}
