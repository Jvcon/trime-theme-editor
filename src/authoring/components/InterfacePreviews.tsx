import { useState } from "react";
import {
  ArrowLeft, ChevronDown, Clipboard, Languages, List, Mic, MoreHorizontal,
  Palette, Settings, Smile, Square, Undo2,
} from "lucide-react";
import type { PresetLibraries, ProjectBundle, ThemeCardPreset, ToolbarButton } from "../types";
import { defaultChrome, tokenValue } from "../utils";

const TOOLBAR_ICONS: Record<string, typeof Square> = {
  "ic@dots_horizontal": MoreHorizontal,
  "ic@arrow-left": ArrowLeft,
  "ic@emoticon": Smile,
  "ic@clipboard": Clipboard,
  "ic@microphone": Mic,
  "ic@ascii": Languages,
  "ic@keyboard_close": ChevronDown,
  "ic@keyboard": Square,
  "ic@settings": Settings,
  "ic@theme": Palette,
  "ic@schema": List,
  "ic@undo": Undo2,
  "ic@redo": Undo2,
  "ic@paste": Clipboard,
  "ic@search": List,
  "ic@voice": Mic,
  "ic@menu": List,
};

const FIXED_KEY_LABELS: Record<string, string> = {
  liquid_keyboard_exit: "返回",
  liquid_keyboard_switch: "更多",
  space1: "空格",
  Return1: "⏎",
  Return2: "⏎",
  BackSpace: "⌫",
  clipboard_window: "剪贴",
};

function palette(project: ProjectBundle, libs: PresetLibraries) {
  const card = project.theme ?? libs.themeCards[0];
  const variant = project.variant;
  const color = (token: string, fallback: string) => {
    const value = tokenValue(card, variant, token);
    return value && value !== "transparent" ? value : fallback;
  };
  return {
    card,
    variant,
    bg: color("bg", "#202124"),
    surface: color("surface", "#2d2f31"),
    surfaceAlt: color("surfaceAlt", "#3c4043"),
    border: color("border", "#5f6368"),
    text: color("text", "#e8eaed"),
    textMuted: color("textMuted", "#9aa0a6"),
    primary: color("primary", "#8ab4f8"),
    onPrimary: color("onPrimary", "#202124"),
    accent: color("accent", "#f28b82"),
  };
}

function resolve(value: string | undefined, card: ThemeCardPreset, variant: "light" | "dark", fallback: string): string {
  if (!value) return fallback;
  if (value.startsWith("#")) return value;
  if (/^0x[0-9a-fA-F]{8}$/.test(value)) {
    const alpha = parseInt(value.slice(2, 4), 16);
    if (alpha === 0) return "transparent";
    const red = parseInt(value.slice(4, 6), 16);
    const green = parseInt(value.slice(6, 8), 16);
    const blue = parseInt(value.slice(8, 10), 16);
    return `rgba(${red}, ${green}, ${blue}, ${(alpha / 255).toFixed(2)})`;
  }
  if (/^0x[0-9a-fA-F]{6}$/.test(value)) return `#${value.slice(2)}`;
  const token = tokenValue(card, variant, value);
  return token && token !== "transparent" ? token : fallback;
}

function Icon({ name }: { name: string | undefined }) {
  const Component = (name && TOOLBAR_ICONS[name]) || Square;
  return <Component className="size-4" />;
}

function ToolbarButtonView({ button, colors }: { button: ToolbarButton; colors: ReturnType<typeof palette> }) {
  const size = button.size ?? [44, 44];
  const width = Math.min(52, size[0] || 44);
  const height = Math.min(52, size[1] || 44);
  const background = resolve(button.background?.normal, colors.card, colors.variant, "transparent");
  const foreground = resolve(button.foreground?.normal, colors.card, colors.variant, colors.text);
  const icon = button.icon ?? button.foreground?.style;
  return (
    <button
      type="button"
      className={`grid shrink-0 place-items-center border ${button.background?.type === "circle" ? "rounded-full" : "rounded-md"}`}
      style={{ width, height, background, color: foreground, borderColor: colors.border }}
      title={`${button.action}${button.longPressAction ? ` · long: ${button.longPressAction}` : ""}`}
    >
      {icon ? <Icon name={icon} /> : <span className="max-w-full truncate px-1 text-[9px]">{button.label ?? button.action}</span>}
    </button>
  );
}

export function ToolbarPreview({ project, libs }: { project: ProjectBundle; libs: PresetLibraries }) {
  const colors = palette(project, libs);
  const toolbar = (project.chrome ?? defaultChrome()).toolbar;
  return (
    <section className="rounded-xl border border-border bg-card p-3">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-xs font-medium">Toolbar preview</span>
        <span className="text-[9px] text-muted-foreground">primary · buttons · spacing {toolbar.buttonSpacing}px</span>
      </div>
      <div className="rounded-lg border p-2" style={{ background: colors.surfaceAlt, borderColor: colors.border }}>
        <div className="flex items-center" style={{ gap: toolbar.buttonSpacing }}>
          <button type="button" className="grid size-9 shrink-0 place-items-center rounded-md border" style={{ background: "transparent", color: colors.text, borderColor: colors.border }} title={toolbar.backStyle}>
            <Icon name={toolbar.backStyle} />
          </button>
          <ToolbarButtonView button={toolbar.primaryButton} colors={colors} />
          <div className="ml-auto flex items-center overflow-hidden" style={{ gap: toolbar.buttonSpacing }}>
            {toolbar.buttons.map((button, index) => <ToolbarButtonView key={`${button.action}-${index}`} button={button} colors={colors} />)}
          </div>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {[toolbar.primaryButton, ...toolbar.buttons].map((button, index) => (
          <span key={`${button.action}-${index}`} className="rounded border border-border bg-muted/20 px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground">{button.action}</span>
        ))}
      </div>
    </section>
  );
}

export function LiquidPreview({ project, libs, tabId, onTab }: { project: ProjectBundle; libs: PresetLibraries; tabId: string; onTab: (id: string) => void }) {
  const colors = palette(project, libs);
  const liquid = (project.chrome ?? defaultChrome()).liquid;
  const selected = liquid.tabs.find((tab) => tab.id === tabId) ?? liquid.tabs[0];
  const [output, setOutput] = useState("");
  const keyHeight = Math.max(24, liquid.keyHeight ?? 40);
  const singleWidth = Math.max(28, liquid.singleWidth);

  return (
    <section className="rounded-xl border border-border bg-card p-3">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-xs font-medium">Liquid preview</span>
        <span className="text-[9px] text-muted-foreground">{liquid.tabs.length} tabs · {liquid.singleWidth}px keys · {liquid.marginX}px gap</span>
        <span className="ml-auto max-w-64 truncate text-[10px]" title={output}>{output ? `输出：${output}` : "点击预览上屏"}</span>
      </div>

      <div className="rounded-lg border p-2" style={{ background: colors.bg, borderColor: colors.border }}>
        <div className="mb-2 flex flex-wrap gap-1">
          {liquid.tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className="rounded-md border px-2 py-1 text-[10px]"
              style={selected?.id === tab.id
                ? { background: colors.primary, color: colors.onPrimary, borderColor: colors.primary }
                : { background: colors.surface, color: colors.textMuted, borderColor: colors.border }}
              onClick={() => onTab(tab.id)}
            >
              {tab.name}
            </button>
          ))}
        </div>

        {liquid.fixedBar.position === "top" ? <FixedBar liquid={liquid} colors={colors} /> : null}

        <div className="max-h-72 overflow-auto rounded-md border p-2" style={{ background: colors.surface, borderColor: colors.border }}>
          {selected?.type === "SINGLE" ? (
            <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fill, minmax(${singleWidth}px, 1fr))`, gap: liquid.marginX }}>
              {(selected.keys ?? []).map((key, index) => (
                <button
                  key={`${key}-${index}`}
                  type="button"
                  className="overflow-hidden rounded border px-1"
                  style={{ height: keyHeight, background: colors.surfaceAlt, borderColor: colors.border, color: colors.text, fontSize: key.length > 4 ? 9 : 18 }}
                  title={key}
                  onClick={() => setOutput(key)}
                >
                  <span className="line-clamp-2 break-all">{key}</span>
                </button>
              ))}
              {(selected.keys ?? []).length === 0 ? <span className="p-2 text-[10px]" style={{ color: colors.textMuted }}>没有 keys</span> : null}
            </div>
          ) : null}

          {selected?.type === "SYMBOL" ? (
            <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fill, minmax(${Math.max(60, singleWidth)}px, 1fr))`, gap: liquid.marginX }}>
              {(selected.symbols ?? []).map((symbol) => (
                <button
                  key={symbol.label}
                  type="button"
                  className="rounded border px-1 py-1 text-left"
                  style={{ background: colors.surfaceAlt, borderColor: colors.border, color: colors.text }}
                  onClick={() => setOutput(`${symbol.label} ${symbol.command}`)}
                >
                  <span className="block text-[11px]">{symbol.label}</span>
                  <span className="block truncate text-[8px]" style={{ color: colors.textMuted }}>{symbol.command}</span>
                </button>
              ))}
            </div>
          ) : null}

          {selected?.type === "HISTORY" ? <p className="p-2 text-[10px]" style={{ color: colors.textMuted }}>历史由运行时提供，编辑器只保留类型。</p> : null}
          {selected?.type === "TABS" ? <p className="p-2 text-[10px]" style={{ color: colors.textMuted }}>更多 tabs 由运行时展开。</p> : null}
        </div>

        {liquid.fixedBar.position !== "top" ? <FixedBar liquid={liquid} colors={colors} /> : null}
      </div>
    </section>
  );
}

function FixedBar({ liquid, colors }: { liquid: ReturnType<typeof defaultChrome>["liquid"]; colors: ReturnType<typeof palette> }) {
  return (
    <div
      className={`mt-2 flex gap-1 ${liquid.fixedBar.position === "left" ? "justify-start" : "justify-end"}`}
      title={`fixed bar · ${liquid.fixedBar.position}`}
    >
      {liquid.fixedBar.keys.map((key, index) => (
        <span
          key={`${key}-${index}`}
          className="rounded border px-2 py-1 text-[9px]"
          style={key.startsWith("Return") || key === "liquid_keyboard_exit"
            ? { background: colors.primary, color: colors.onPrimary, borderColor: colors.primary }
            : { background: colors.surfaceAlt, color: colors.text, borderColor: colors.border }}
        >
          {FIXED_KEY_LABELS[key] ?? key}
        </span>
      ))}
    </div>
  );
}

export function WindowPreview({ project, libs }: { project: ProjectBundle; libs: PresetLibraries }) {
  const colors = palette(project, libs);
  const chrome = project.chrome ?? defaultChrome();
  const config = chrome.window;
  return (
    <section className="rounded-xl border border-border bg-card p-3">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-xs font-medium">Window preview</span>
        <span className="text-[9px] text-muted-foreground">insets {config.verticalInset}/{config.horizontalInset} · radius {config.cornerRadius} · alpha {config.alpha}</span>
      </div>
      <div
        className="border"
        style={{
          background: colors.bg,
          borderColor: colors.border,
          borderWidth: Math.max(0, config.border),
          borderRadius: config.cornerRadius,
          boxShadow: config.shadow ? `0 8px ${config.shadow * 3}px rgba(0,0,0,${Math.max(0.05, Math.min(0.5, config.alpha * 0.25))})` : undefined,
          opacity: Math.max(0.2, Math.min(1, config.alpha)),
          padding: `${config.verticalInset}px ${config.horizontalInset}px`,
        }}
      >
        <div className="mb-1 flex items-center gap-1 rounded px-2 py-1" style={{ background: colors.surfaceAlt, color: colors.text, paddingTop: config.itemVerticalPadding, paddingBottom: config.itemVerticalPadding }}>
          <span style={{ color: colors.textMuted, fontSize: config.commentFontSize }}>候选</span>
          <span style={{ fontSize: config.labelFontSize }}>你好</span>
          <span style={{ color: colors.textMuted, fontSize: config.commentFontSize }}>nǐ hǎo</span>
          <span className="ml-auto" style={{ color: colors.textMuted, fontSize: config.textFontSize }}>1/9</span>
        </div>
        {[0, 1, 2].map((row) => (
          <div key={row} className="mb-1 flex gap-1" style={{ marginTop: row === 0 ? config.itemVerticalPadding : 0 }}>
            {Array.from({ length: row === 0 ? 10 : 9 }).map((_, index) => (
              <span
                key={index}
                className="flex flex-1 items-center justify-center rounded"
                style={{
                  height: Math.max(18, 26 - row),
                  background: colors.surfaceAlt,
                  color: colors.text,
                  fontSize: Math.max(8, config.textFontSize - 6),
                  padding: `${config.itemVerticalPadding / 2}px ${config.itemHorizontalPadding / 2}px`,
                }}
              >
                {row === 0 ? "qwertyuiop"[index] : row === 1 ? "asdfghjkl"[index] : index === 0 ? "⇧" : index === 8 ? "⌫" : "zxcvbnm"[index - 1]}
              </span>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

export function PreeditPreview({ project, libs }: { project: ProjectBundle; libs: PresetLibraries }) {
  const colors = palette(project, libs);
  const config = (project.chrome ?? defaultChrome()).preedit;
  return (
    <section className="rounded-xl border border-border bg-card p-3">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-xs font-medium">Preedit preview</span>
        <span className="text-[9px] text-muted-foreground">padding {config.horizontalPadding} · radius {config.topStartRadius}/{config.topEndRadius} · alpha {config.alpha}</span>
      </div>
      <div className="grid min-h-44 place-items-center rounded-lg border p-4" style={{ background: colors.bg, borderColor: colors.border }}>
        <div
          className="inline-flex items-center gap-2 shadow-lg"
          style={{
            background: colors.surfaceAlt,
            color: colors.text,
            borderRadius: `${config.topStartRadius}px ${config.topEndRadius}px ${Math.min(config.topStartRadius, 6)}px ${Math.min(config.topEndRadius, 6)}px`,
            padding: `6px ${config.horizontalPadding}px`,
            opacity: Math.max(0.2, Math.min(1, config.alpha)),
            fontSize: config.fontSize,
            border: `1px solid ${colors.border}`,
          }}
        >
          <span>ni hao</span>
          <span className="h-[1em] w-px animate-pulse" style={{ background: colors.primary }} />
          <span style={{ color: colors.textMuted, fontSize: Math.max(9, config.fontSize - 6) }}>你好</span>
        </div>
      </div>
    </section>
  );
}
