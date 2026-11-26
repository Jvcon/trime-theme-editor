import { ChevronRight } from "lucide-react";
import type { Orientation, PresetLibraries, ProjectBundle, Variant } from "../types";
import { deviceLabel, resolveLayoutForDevice, resolveMetrics } from "../resolve";
import { KeyboardPreview, type DropPosition, type KeyPosition } from "./KeyboardPreview";

export function PreviewRail({
  project, libs, deviceId, onDeviceId, orientation, onOrientation, onCollapse,
  onVariant,
  layoutId, interactive = false, wide = false,
  selected, onSelect, popup, onPopup, onMoveKey, onMessage, onClosePopup,
}: {
  project: ProjectBundle;
  libs: PresetLibraries;
  deviceId: string;
  onDeviceId: (id: string) => void;
  orientation: Orientation;
  onOrientation: (value: Orientation) => void;
  onCollapse: () => void;
  onVariant: (value: Variant) => void;
  /** When editing a specific layout, preview that layout instead of the device's binding. */
  layoutId?: string;
  /** Turn the rail into the layout editing canvas. */
  interactive?: boolean;
  /** Wider rail for the layout editing step. */
  wide?: boolean;
  selected?: KeyPosition;
  onSelect?: (position: KeyPosition) => void;
  popup?: KeyPosition | null;
  onPopup?: (position: KeyPosition) => void;
  onMoveKey?: (from: KeyPosition, to: DropPosition) => void;
  onMessage?: (message: string) => void;
  onClosePopup?: () => void;
}) {
  const device = project.devices.find((item) => item.id === deviceId) ?? project.devices[0];
  const previewDevice = device ? { ...device, orientation } : undefined;
  const editing = layoutId ? libs.layouts.find((item) => item.id === layoutId) : undefined;
  const layout = editing ?? resolveLayoutForDevice(project, previewDevice);
  const metrics = resolveMetrics(project, previewDevice);
  const base = device
    ? project.layouts.find((item) => item.id === (device.mainLayoutId ?? project.mainLayoutId))
    : undefined;
  const usesVariant = !editing && orientation === "landscape" && Boolean(base?.landscapeId) && layout?.id === base?.landscapeId;
  const widthClass = wide
    ? "w-[30%] min-w-[420px] max-w-[720px]"
    : "w-[30%] min-w-[320px] max-w-[640px]";

  return (
    <aside className={`hidden ${widthClass} shrink-0 flex-col border-l border-border bg-card/20 lg:flex`}>
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <span className="text-xs font-semibold">{interactive ? "键盘编辑" : "预览"}</span>
        <span className="text-[9px] text-muted-foreground">{interactive ? "点击选键 · 拖拽移动 · 长按 popup" : "跟随当前步骤"}</span>
        <button type="button" className="ml-auto text-muted-foreground hover:text-foreground" title="收起预览" onClick={onCollapse}>
          {interactive ? null : <ChevronRight className="size-4" />}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-1 border-b border-border px-3 py-2">
        <select
          className="h-7 min-w-0 flex-1 rounded border border-input bg-background px-1 text-[10px]"
          value={device?.id ?? ""}
          onChange={(event) => onDeviceId(event.target.value)}
        >
          {project.devices.map((item) => (
            <option key={item.id} value={item.id}>{deviceLabel(item)}</option>
          ))}
        </select>
        <div className="flex shrink-0 items-center rounded border border-border p-0.5" title="预览方案">
          <button
            type="button"
            className={`rounded px-1.5 py-0.5 text-[10px] ${project.variant === "light" ? "bg-primary/10 text-primary" : "text-muted-foreground"}`}
            onClick={() => onVariant("light")}
          >浅色</button>
          <button
            type="button"
            className={`rounded px-1.5 py-0.5 text-[10px] ${project.variant === "dark" ? "bg-primary/10 text-primary" : "text-muted-foreground"}`}
            onClick={() => onVariant("dark")}
          >深色</button>
        </div>
        {interactive ? (
          <span className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
            {orientation === "landscape" ? "横屏" : "竖屏"}
          </span>
        ) : (
          <>
            <button
              type="button"
              className={`rounded border px-1.5 py-0.5 text-[10px] ${orientation === "portrait" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}
              onClick={() => onOrientation("portrait")}
            >竖屏</button>
            <button
              type="button"
              className={`rounded border px-1.5 py-0.5 text-[10px] ${orientation === "landscape" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}
              onClick={() => onOrientation("landscape")}
            >横屏</button>
          </>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-3">
        {layout ? (
          <KeyboardPreview
            project={project}
            libs={libs}
            layout={layout}
            metrics={metrics}
            orientation={orientation}
            fit={interactive ? "full" : "device"}
            chrome
            interactive={interactive}
            selected={selected}
            onSelect={onSelect}
            popup={popup}
            onPopup={onPopup}
            onMoveKey={onMoveKey}
            onMessage={onMessage}
            onClosePopup={onClosePopup}
          />
        ) : (
          <p className="text-xs text-muted-foreground">还没有可用布局。</p>
        )}
      </div>

      <div className="space-y-0.5 border-t border-border px-3 py-2 text-[9px] text-muted-foreground">
        <div>
          布局：<span className="text-foreground">{layout?.name ?? "—"}</span>
          {editing ? " · 正在编辑" : usesVariant ? " · 横屏变体" : ""}
        </div>
        <div>键盘高 {metrics.keyboardHeight ?? 270} · 键高 {metrics.keyHeight ?? 52} · {layout?.rows.length ?? 0} 行</div>
        <div>{deviceLabel(device ?? { id: "phone", kind: "phone", orientation: "portrait" }, true)}</div>
      </div>
    </aside>
  );
}
