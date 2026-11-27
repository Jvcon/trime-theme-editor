import YAML from "yaml";
import { blankBundle } from "./compiler";
import { KEYCODES } from "./catalogs";
import { expandThemeDsl, ThemeDslError } from "./dsl";
import { BUILTIN_PRESETS } from "./presets";
import type { ActionRef, ChromePatch, KeySlot, LayoutPreset, LayoutRow, LiquidConfig, LiquidTab, MacroPreset, MacroStep, PreeditConfig, ProjectBundle, ThemeCardPreset, ToolbarButton, ToolbarConfig, WindowConfig } from "./types";
import { defaultKeyStyles, fitLayoutRows, normalizeChrome, slug } from "./utils";

type Dict = Record<string, unknown>;

export type ImportReport = {
  mapped: string[];
  passthrough: string[];
  needsReview: string[];
  dropped: string[];
};

export type ImportResult = {
  project: ProjectBundle;
  warnings: string[];
  report: ImportReport;
};

export type ImportOptions = {
  themeCard?: boolean;
  interface?: boolean;
  keyboards?: "all" | "main";
  calibrateRows?: boolean;
};

const TOP_LEVEL_KEYS = new Set([
  "config_version", "name", "author", "style", "preedit", "window", "tool_bar",
  "fallback_colors", "preset_color_schemes", "liquid_keyboard", "preset_keys",
  "preset_keyboards", "base",
]);

const STYLE_KEYS = new Set([
  "key_width", "key_height", "horizontal_gap", "vertical_gap", "keyboard_height",
  "candidate_view_height", "candidate_text_size", "comment_text_size", "key_text_size",
  "popup_width", "popup_height", "popup_key_height", "popup_text_size",
  "popup_bottom_margin", "keyboard_padding_left", "keyboard_padding",
]);

const KEY_KNOWN_FIELDS = new Set([
  "click", "long_click", "double_click", "swipe_up", "swipe_down", "swipe_left", "swipe_right",
  "popup", "label", "label_symbol", "hint", "width", "height",
  "key_back_color", "key_text_color", "key_symbol_color", "key_border_color",
  "hilited_key_back_color", "hilited_key_text_color", "hilited_key_symbol_color", "hilited_key_border_color",
]);

const LAYOUT_KNOWN_FIELDS = new Set(["keys", "name", "height", "ascii_mode"]);

function pickUnknown(source: Dict, known: Set<string>): Dict {
  const output: Dict = {};
  for (const [key, value] of Object.entries(source)) {
    if (!known.has(key)) output[key] = value;
  }
  return output;
}

function withPassthrough<T extends object>(value: T, passthrough: Dict): T & { passthrough?: Dict } {
  return Object.keys(passthrough).length > 0 ? { ...value, passthrough } : value;
}

const KEYCODE_SET = new Set(KEYCODES.flatMap((group) => group.items));
const FALLBACK = {
  bg: "#202124", surface: "#2d2f31", surfaceAlt: "#3c4043", border: "#5f6368",
  text: "#e8eaed", textMuted: "#9aa0a6", primary: "#8ab4f8", onPrimary: "#202124",
  accent: "#f28b82", danger: "#f28b82", success: "#81c995", warning: "#fdd663",
};

function asDict(value: unknown): Dict {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Dict : {};
}

function text(value: unknown): string {
  return typeof value === "string" ? value : typeof value === "number" ? String(value) : "";
}

function hex(value: unknown, fallback: string): string {
  const raw = text(value).trim();
  if (/^#[0-9a-fA-F]{6}$/.test(raw)) return raw.toLowerCase();
  if (/^0x[0-9a-fA-F]{8}$/.test(raw)) return `#${raw.slice(4).toLowerCase()}`;
  if (/^0x[0-9a-fA-F]{6}$/.test(raw)) return `#${raw.slice(2).toLowerCase()}`;
  return fallback;
}

function number(value: unknown): number | undefined {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function variantOf(scheme: Dict): Pick<ThemeCardPreset, "tokens" | "states"> {
  return {
    tokens: {
      bg: hex(scheme.back_color ?? scheme.root_background, FALLBACK.bg),
      surface: hex(scheme.key_back_color ?? scheme.keyboard_background ?? scheme.candidate_background, FALLBACK.surface),
      surfaceAlt: hex(scheme.off_key_back_color ?? scheme.keyboard_background, FALLBACK.surfaceAlt),
      border: hex(scheme.border_color ?? scheme.key_border_color, FALLBACK.border),
      text: hex(scheme.text_color ?? scheme.key_text_color, FALLBACK.text),
      textMuted: hex(scheme.comment_text_color ?? scheme.key_symbol_color ?? scheme.label_color, FALLBACK.textMuted),
      primary: hex(scheme.enter_back_color ?? scheme.hilited_key_back_color, FALLBACK.primary),
      onPrimary: hex(scheme.enter_text_color ?? scheme.key_text_color, FALLBACK.onPrimary),
      accent: hex(scheme.hilited_enter_back_color ?? scheme.hilited_key_back_color, FALLBACK.accent),
      danger: hex(scheme.danger_color, FALLBACK.danger),
      success: hex(scheme.success_color, FALLBACK.success),
      warning: hex(scheme.warning_color, FALLBACK.warning),
    },
    states: {
      pressed: {
        surface: hex(scheme.hilited_key_back_color ?? scheme.hilited_back_color, FALLBACK.primary),
        text: hex(scheme.hilited_key_text_color ?? scheme.hilited_text_color, FALLBACK.onPrimary),
      },
      disabled: {
        surface: hex(scheme.off_key_back_color, FALLBACK.surfaceAlt),
        text: hex(scheme.off_key_text_color, FALLBACK.textMuted),
      },
    },
  };
}

function buildCards(doc: Dict, report: ImportReport): { light: ThemeCardPreset; dark: ThemeCardPreset } | undefined {
  const schemes = asDict(doc.preset_color_schemes);
  const names = Object.keys(schemes);
  if (names.length === 0) {
    report.needsReview.push("没有 preset_color_schemes，保留默认色卡。");
    return undefined;
  }
  const lightName = names.includes("light") ? "light" : names[0];
  const darkName = names.includes("dark") ? "dark" : names.find((name) => name !== lightName) ?? lightName;
  if (!names.includes("light") || !names.includes("dark")) {
    report.needsReview.push(`preset_color_schemes 使用非 light/dark 名称（${names.join(", ")}），已映射为浅色/深色方案；原始 scheme 保留在 passthrough。`);
  }
  const base = text(doc.name) || "Imported";
  const cardFor = (variant: "light" | "dark", schemeName: string): ThemeCardPreset => {
    const scheme = asDict(schemes[schemeName]);
    const suffix = variant === "light" ? "Light" : "Dark";
    return {
      kind: "theme-card",
      id: `imported-card-${slug(base)}-${variant}`,
      name: text(scheme.name) || `${base} ${suffix}`,
      version: 1,
      builtin: false,
      appearance: variant,
      ...variantOf(scheme),
    };
  };
  return {
    light: cardFor("light", lightName),
    dark: cardFor("dark", darkName),
  };
}

function macroStepsOf(value: string): MacroStep[] {
  const steps: MacroStep[] = [];
  let cursor = 0;
  const pattern = /\{([^{}]+)\}/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(value)) !== null) {
    if (match.index > cursor) steps.push({ type: "text", value: value.slice(cursor, match.index) });
    steps.push({ type: "key", value: match[1] });
    cursor = match.index + match[0].length;
  }
  if (cursor < value.length) steps.push({ type: "text", value: value.slice(cursor) });
  return steps.length > 0 ? steps : [{ type: "text", value }];
}

function importMacros(doc: Dict, report: ImportReport): {
  macros: MacroPreset[];
  byToken: Map<string, string>;
  rawPresetKeys: Record<string, Record<string, unknown>>;
  macroPassthrough: Record<string, Record<string, unknown>>;
  rawTokens: Set<string>;
} {
  const presetKeys = asDict(doc.preset_keys);
  const macros: MacroPreset[] = [];
  const rawPresetKeys: Record<string, Record<string, unknown>> = {};
  const macroPassthrough: Record<string, Record<string, unknown>> = {};
  const rawTokens = new Set<string>();
  const byToken = new Map<string, string>();
  const taken = new Set(BUILTIN_PRESETS.macros.map((item) => item.id));
  for (const [token, value] of Object.entries(presetKeys)) {
    const entry = asDict(value);
    if (Object.keys(entry).length === 0) continue;
    const isCommand = entry.select !== undefined || entry.command !== undefined;
    const send = text(entry.send);
    const body = text(entry.text);
    if (isCommand || (!send && !body)) {
      rawPresetKeys[token] = entry;
      if (isCommand) rawTokens.add(token);
      continue;
    }
    let id = token.replace(/[^A-Za-z0-9_]/g, "_") || "macro";
    if (taken.has(id)) {
      let index = 2;
      const base = id;
      while (taken.has(`${base}_${index}`)) index += 1;
      id = `${base}_${index}`;
    }
    taken.add(id);
    const steps: MacroStep[] = [];
    if (body) steps.push(...macroStepsOf(body));
    if (send) steps.push({ type: "key", value: send });
    macros.push({
      kind: "macro",
      id,
      name: text(entry.label) || token,
      version: 1,
      builtin: false,
      steps,
      token,
    });
    const extra = { ...entry };
    delete extra.send;
    delete extra.text;
    delete extra.label;
    if (Object.keys(extra).length > 0) macroPassthrough[id] = extra;
    byToken.set(token, id);
  }
  if (macros.length > 0) report.mapped.push(`已把 ${macros.length} 个 preset_keys 转为宏；label/send/text 已转换。`);
  if (Object.keys(rawPresetKeys).length > 0) {
    report.passthrough.push(`已保留 ${Object.keys(rawPresetKeys).length} 个原始 preset_keys（command/select/未建模；其中 ${rawTokens.size} 个 command/select）。`);
  }
  return { macros, byToken, rawPresetKeys, macroPassthrough, rawTokens };
}

function importAction(raw: unknown, ctx: { byToken: Map<string, string>; rawTokens: Set<string>; layoutIds: Map<string, string>; warnings: string[] }): ActionRef | undefined {
  const token = text(raw);
  if (!token) return undefined;
  if (ctx.byToken.has(token)) return { kind: "macro", id: ctx.byToken.get(token)! };
  if (ctx.rawTokens.has(token)) return { kind: "preset", value: token };
  if (token === "Keyboard_default") return { kind: "page", id: "main" };
  if (token.startsWith("Keyboard_")) {
    const original = token.slice("Keyboard_".length);
    const mapped = ctx.layoutIds.get(original) ?? original;
    return { kind: "page", id: mapped };
  }
  if (token.startsWith("toggle_")) return { kind: "toggle", value: token.slice("toggle_".length) };
  if (token.startsWith("command_")) return { kind: "command", value: token.slice("command_".length) };
  if (KEYCODE_SET.has(token) || /^[A-Z][A-Za-z0-9_]+$/.test(token)) return { kind: "key", value: token };
  return token.length <= 2 ? { kind: "char", value: token } : { kind: "text", value: token };
}

function convertKeyboard(
  id: string,
  entry: Dict,
  ctx: { byToken: Map<string, string>; rawTokens: Set<string>; layoutIds: Map<string, string>; warnings: string[] },
): LayoutPreset {
  const rawKeys = Array.isArray(entry.keys) ? entry.keys : [];
  const rows: LayoutRow[] = [];
  let row: LayoutRow = { height: number(entry.height) ?? 52, keys: [] };
  let used = 0;
  for (const rawKey of rawKeys) {
    const source = asDict(rawKey);
    const width = number(source.width) ?? 10;
    const keyHeight = number(source.height);
    if (used + width > 100.5 && row.keys.length > 0) {
      rows.push(row);
      row = { height: number(entry.height) ?? 52, keys: [] };
      used = 0;
    }
    // Trime expresses a row's height on the key that starts the row.
    if (keyHeight && row.keys.length === 0) row.height = keyHeight;
    const click = importAction(source.click, ctx);
    const passthrough = pickUnknown(source, KEY_KNOWN_FIELDS);
    const slot: KeySlot = {
      width,
      ...(click ? { style: "default", click } : { kind: "placeholder" as const }),
      ...(click && text(source.label) ? { label: text(source.label) } : {}),
      ...(click && text(source.label_symbol) ? { label_symbol: text(source.label_symbol) } : {}),
      ...(click && text(source.hint) ? { hint: text(source.hint) } : {}),
      ...(click && importAction(source.long_click, ctx) ? { long_click: importAction(source.long_click, ctx) } : {}),
      ...(click && importAction(source.double_click, ctx) ? { double_click: importAction(source.double_click, ctx) } : {}),
      ...(click && importAction(source.swipe_up, ctx) ? { swipe_up: importAction(source.swipe_up, ctx) } : {}),
      ...(click && importAction(source.swipe_down, ctx) ? { swipe_down: importAction(source.swipe_down, ctx) } : {}),
      ...(click && importAction(source.swipe_left, ctx) ? { swipe_left: importAction(source.swipe_left, ctx) } : {}),
      ...(click && importAction(source.swipe_right, ctx) ? { swipe_right: importAction(source.swipe_right, ctx) } : {}),
      ...(click && Array.isArray(source.popup) ? { popup: source.popup.map(text).filter(Boolean) } : {}),
      ...(click && text(source.key_back_color) ? { key_back_color: text(source.key_back_color) } : {}),
      ...(click && text(source.key_text_color) ? { key_text_color: text(source.key_text_color) } : {}),
      ...(click && text(source.key_symbol_color) ? { key_symbol_color: text(source.key_symbol_color) } : {}),
      ...(click && text(source.key_border_color) ? { key_border_color: text(source.key_border_color) } : {}),
      ...(click && text(source.hilited_key_back_color) ? { hilited_key_back_color: text(source.hilited_key_back_color) } : {}),
      ...(click && text(source.hilited_key_text_color) ? { hilited_key_text_color: text(source.hilited_key_text_color) } : {}),
      ...(click && text(source.hilited_key_symbol_color) ? { hilited_key_symbol_color: text(source.hilited_key_symbol_color) } : {}),
      ...(click && text(source.hilited_key_border_color) ? { hilited_key_border_color: text(source.hilited_key_border_color) } : {}),
      ...(Object.keys(passthrough).length > 0 ? { passthrough } : {}),
    };
    if (click && keyHeight && row.keys.length > 0) slot.height = keyHeight;
    row.keys.push(slot);
    used += width;
  }
  if (row.keys.length > 0) rows.push(row);
  if (rows.length === 0) rows.push({ height: 52, keys: [{ style: "default", width: 100, click: { kind: "char", value: "a" }, label: "A" }] });

  const name = text(entry.name) || id;
  const role = /number|num|123|digit/i.test(id) ? "number" : /symbol|punct|emoji/i.test(id) ? "symbols" : "letters";
  const passthrough = pickUnknown(entry, LAYOUT_KNOWN_FIELDS);
  return {
    kind: "layout",
    id,
    name,
    version: 1,
    builtin: false,
    role: role as LayoutPreset["role"],
    asciiMode: number(entry.ascii_mode) ?? 0,
    rows,
    ...(Object.keys(passthrough).length > 0 ? { passthrough } : {}),
  };
}


function importToolbarButton(value: unknown): ToolbarButton | undefined {
  const source = asDict(value);
  const action = text(source.action);
  if (!action) return undefined;
  const foreground = asDict(source.foreground);
  const background = asDict(source.background);
  const rawSize = Array.isArray(source.size) ? source.size : [];
  const size: [number, number] | undefined = rawSize.length >= 2
    ? [number(rawSize[0]) ?? 44, number(rawSize[1]) ?? 44]
    : undefined;
  const passthrough = { ...source };
  delete passthrough.action;
  delete passthrough.long_press_action;
  delete passthrough.label;
  delete passthrough.size;
  return {
    action,
    ...(text(source.long_press_action) ? { longPressAction: text(source.long_press_action) } : {}),
    ...(text(source.label) ? { label: text(source.label) } : {}),
    ...(text(foreground.style) ? { icon: text(foreground.style) } : {}),
    ...(size ? { size } : {}),
    ...(Object.keys(background).length > 0 ? {
      background: {
        ...(text(background.type) ? { type: text(background.type) } : {}),
        ...(text(background.normal) ? { normal: text(background.normal) } : {}),
        ...(text(background.highlight) ? { highlight: text(background.highlight) } : {}),
        ...(number(background.vertical_inset) !== undefined ? { verticalInset: number(background.vertical_inset) } : {}),
        ...(number(background.horizontal_inset) !== undefined ? { horizontalInset: number(background.horizontal_inset) } : {}),
      },
    } : {}),
    ...(Object.keys(foreground).length > 0 ? {
      foreground: {
        ...(text(foreground.style) ? { style: text(foreground.style) } : {}),
        ...(text(foreground.normal) ? { normal: text(foreground.normal) } : {}),
        ...(number(foreground.padding) !== undefined ? { padding: number(foreground.padding) } : {}),
      },
    } : {}),
    ...(Object.keys(passthrough).length > 0 ? { passthrough } : {}),
  };
}

function importToolbar(value: unknown, report?: ImportReport): ToolbarConfig | undefined {
  const source = asDict(value);
  if (Object.keys(source).length === 0) return undefined;
  const primary = importToolbarButton(source.primary_button);
  const rawButtons = Array.isArray(source.buttons) ? source.buttons : [];
  const buttons = rawButtons
    .map(importToolbarButton)
    .filter((item): item is ToolbarButton => Boolean(item));
  if (report && rawButtons.length !== buttons.length) {
    report.dropped.push(`tool_bar 中 ${rawButtons.length - buttons.length} 个按钮缺少 action，未导入。`);
  }
  return {
    buttonSpacing: number(source.button_spacing) ?? 6,
    backStyle: text(source.back_style) || "ic@arrow-left",
    primaryButton: primary ?? { action: "menu_keyboard", icon: "ic@dots_horizontal" },
    buttons,
  };
}

function importLiquidTab(id: string, value: unknown): LiquidTab | undefined {
  const source = asDict(value);
  if (Object.keys(source).length === 0) return undefined;
  const type = text(source.type).toUpperCase();
  const normalizedType: LiquidTab["type"] = ["SINGLE", "HISTORY", "TABS", "SYMBOL"].includes(type)
    ? type as LiquidTab["type"]
    : "SINGLE";
  const rawKeys = source.keys;
  const passthrough = pickUnknown(source, new Set(["type", "name", "keys"]));
  if (normalizedType === "SYMBOL") {
    const symbols = Array.isArray(rawKeys)
      ? rawKeys.map((item) => {
        const entry = asDict(item);
        const [label, command] = Object.entries(entry)[0] ?? [];
        return { label: String(label ?? ""), command: String(command ?? "") };
      }).filter((item) => item.label)
      : [];
    return withPassthrough({ id, name: text(source.name) || id, type: normalizedType, symbols }, passthrough);
  }
  const keys = typeof rawKeys === "string"
    ? Array.from(rawKeys)
    : Array.isArray(rawKeys)
      ? rawKeys.map((item) => {
        if (typeof item === "string") return item;
        const entry = asDict(item);
        const [label, command] = Object.entries(entry)[0] ?? [];
        return String(label ?? command ?? "");
      }).filter(Boolean)
      : undefined;
  return withPassthrough({ id, name: text(source.name) || id, type: normalizedType, ...(keys ? { keys } : {}) }, passthrough);
}

function importLiquid(value: unknown): LiquidConfig | undefined {
  const source = asDict(value);
  if (Object.keys(source).length === 0) return undefined;
  const order = Array.isArray(source.keyboards) ? source.keyboards.map(text).filter(Boolean) : [];
  const ids = [...new Set([...order, ...Object.keys(source).filter((key) => {
    const entry = asDict(source[key]);
    return Boolean(entry.type) && key !== "fixed_key_bar";
  })])];
  const tabs = ids.map((id) => importLiquidTab(id, source[id])).filter((item): item is LiquidTab => Boolean(item));
  const fixed = asDict(source.fixed_key_bar);
  return {
    singleWidth: number(source.single_width) ?? 60,
    marginX: number(source.margin_x) ?? 3,
    ...(number(source.key_height) !== undefined ? { keyHeight: number(source.key_height) } : {}),
    ...(number(source.row) !== undefined ? { row: number(source.row) } : {}),
    ...(number(source.vertical_gap) !== undefined ? { verticalGap: number(source.vertical_gap) } : {}),
    fixedBar: {
      position: (["left", "right", "top", "bottom"].includes(text(fixed.position)) ? text(fixed.position) : "right") as LiquidConfig["fixedBar"]["position"],
      keys: Array.isArray(fixed.keys) ? fixed.keys.map(text).filter(Boolean) : ["liquid_keyboard_exit", "space1", "BackSpace", "Return1"],
    },
    tabs,
  };
}

function importWindow(value: unknown): Partial<WindowConfig> | undefined {
  const source = asDict(value);
  if (Object.keys(source).length === 0) return undefined;
  const insets = asDict(source.insets);
  const padding = asDict(source.item_padding);
  const foreground = asDict(source.foreground);
  return {
    ...(number(insets.vertical) !== undefined ? { verticalInset: number(insets.vertical) } : {}),
    ...(number(insets.horizontal) !== undefined ? { horizontalInset: number(insets.horizontal) } : {}),
    ...(number(padding.vertical) !== undefined ? { itemVerticalPadding: number(padding.vertical) } : {}),
    ...(number(padding.horizontal) !== undefined ? { itemHorizontalPadding: number(padding.horizontal) } : {}),
    ...(number(source.min_width) !== undefined ? { minWidth: number(source.min_width) } : {}),
    ...(number(source.corner_radius) !== undefined ? { cornerRadius: number(source.corner_radius) } : {}),
    ...(number(source.border) !== undefined ? { border: number(source.border) } : {}),
    ...(number(source.shadow) !== undefined ? { shadow: number(source.shadow) } : {}),
    ...(number(source.alpha) !== undefined ? { alpha: number(source.alpha) } : {}),
    ...(number(foreground.label_font_size) !== undefined ? { labelFontSize: number(foreground.label_font_size) } : {}),
    ...(number(foreground.text_font_size) !== undefined ? { textFontSize: number(foreground.text_font_size) } : {}),
    ...(number(foreground.comment_font_size) !== undefined ? { commentFontSize: number(foreground.comment_font_size) } : {}),
  };
}

function importPreedit(value: unknown): Partial<PreeditConfig> | undefined {
  const source = asDict(value);
  if (Object.keys(source).length === 0) return undefined;
  const foreground = asDict(source.foreground);
  return {
    ...(number(source.horizontal_padding) !== undefined ? { horizontalPadding: number(source.horizontal_padding) } : {}),
    ...(number(source.top_start_radius) !== undefined ? { topStartRadius: number(source.top_start_radius) } : {}),
    ...(number(source.top_end_radius) !== undefined ? { topEndRadius: number(source.top_end_radius) } : {}),
    ...(number(source.alpha) !== undefined ? { alpha: number(source.alpha) } : {}),
    ...(number(foreground.font_size) !== undefined ? { fontSize: number(foreground.font_size) } : {}),
  };
}

function importChrome(doc: Dict, report?: ImportReport): ChromePatch {
  const toolbar = importToolbar(doc.tool_bar, report);
  const liquid = importLiquid(doc.liquid_keyboard);
  const window = importWindow(doc.window);
  const preedit = importPreedit(doc.preedit);
  return {
    ...(toolbar ? { toolbar } : {}),
    ...(liquid ? { liquid } : {}),
    ...(window ? { window } : {}),
    ...(preedit ? { preedit } : {}),
  };
}

function resolveKeyboard(presetKeyboards: Dict, id: string, seen = new Set<string>()): { id: string; entry: Dict } | undefined {
  if (seen.has(id)) return undefined;
  seen.add(id);
  const entry = asDict(presetKeyboards[id]);
  if (!entry || Object.keys(entry).length === 0) return undefined;
  const alias = text(entry.import_preset);
  if (alias) {
    const target = resolveKeyboard(presetKeyboards, alias, seen);
    if (target) return { id: target.id, entry: { ...target.entry, ...entry, import_preset: undefined } };
  }
  if (!Array.isArray(entry.keys)) return undefined;
  return { id, entry };
}

export function importTrimeYaml(
  source: string,
  fileName = "trime.yaml",
  options: ImportOptions = {},
  resources: Record<string, string> = {},
): ImportResult {
  const report: ImportReport = { mapped: [], passthrough: [], needsReview: [], dropped: [] };
  const warnings: string[] = [];
  const resourceDocs: Record<string, unknown> = {};
  for (const [name, content] of Object.entries(resources)) {
    try {
      resourceDocs[name] = YAML.parse(content);
    } catch (error) {
      report.needsReview.push(`资源 ${name} 解析失败：${error instanceof Error ? error.message : String(error)}`);
    }
  }
  let parsed: unknown;
  try {
    parsed = expandThemeDsl(YAML.parse(source), fileName, resourceDocs);
  } catch (error) {
    const message = error instanceof ThemeDslError ? `${error.kind}: ${error.message}` : String(error);
    report.needsReview.push(`DSL 展开失败：${message}`);
    parsed = YAML.parse(source);
  }
  const doc = asDict(asDict(parsed).base) && Object.keys(asDict(asDict(parsed).base)).length > 0 ? asDict(asDict(parsed).base) : asDict(parsed);
  const presetKeyboards = asDict(doc.preset_keyboards);
  const opts = { themeCard: true, interface: true, keyboards: "all" as "all" | "main", calibrateRows: false, ...options };

  const cards = opts.themeCard ? buildCards(doc, report) : undefined;
  if (!opts.themeCard) report.dropped.push("preset_color_schemes（未启用 themeCard 导入）");
  const { macros, byToken, rawPresetKeys, macroPassthrough, rawTokens } = importMacros(doc, report);

  const mainCandidate = resolveKeyboard(presetKeyboards, "default")
    ?? resolveKeyboard(presetKeyboards, "qwerty")
    ?? resolveKeyboard(presetKeyboards, Object.keys(presetKeyboards)[0] ?? "");
  if (!mainCandidate) {
    const message = "没有可用 preset_keyboards，导入为空项目。";
    warnings.push(message);
    report.needsReview.push(message);
    const empty = blankBundle();
    empty.id = `imported-${slug(fileName.replace(/\.ya?ml$/i, ""))}`;
    empty.meta.name = text(doc.name) || fileName.replace(/\.ya?ml$/i, "");
    empty.meta.author = text(doc.author) || empty.meta.author;
    return { project: empty, warnings, report };
  }

  const takenLayoutIds = new Set(BUILTIN_PRESETS.layouts.map((item) => item.id));
  const resolvedMainId = mainCandidate.id;
  const finalByResolved = new Map<string, string>();
  const allocate = (original: string): string => {
    const cleaned = original.replace(/[^A-Za-z0-9_-]/g, "_") || "keyboard";
    let id = takenLayoutIds.has(cleaned) ? `imported-${cleaned}` : cleaned;
    let index = 2;
    while (takenLayoutIds.has(id)) {
      id = `imported-${cleaned}-${index}`;
      index += 1;
    }
    takenLayoutIds.add(id);
    return id;
  };
  finalByResolved.set(resolvedMainId, allocate(resolvedMainId));

  const resolvedByOriginal = new Map<string, string>();
  for (const original of Object.keys(presetKeyboards)) {
    const resolved = resolveKeyboard(presetKeyboards, original);
    if (!resolved) continue;
    resolvedByOriginal.set(original, resolved.id);
    if (!finalByResolved.has(resolved.id)) finalByResolved.set(resolved.id, allocate(resolved.id));
  }

  const layoutIds = new Map<string, string>();
  for (const [original, resolvedId] of resolvedByOriginal) {
    const finalId = finalByResolved.get(resolvedId)!;
    layoutIds.set(original, finalId);
    layoutIds.set(resolvedId, finalId);
  }
  const mainId = finalByResolved.get(resolvedMainId)!;
  const ctx = { byToken, rawTokens, layoutIds, warnings };

  const layouts: LayoutPreset[] = [];
  const seenLayouts = new Set<string>();
  for (const original of Object.keys(presetKeyboards)) {
    const resolved = resolveKeyboard(presetKeyboards, original);
    if (!resolved || seenLayouts.has(resolved.id)) continue;
    seenLayouts.add(resolved.id);
    const finalId = finalByResolved.get(resolved.id)!;
    const layout = convertKeyboard(finalId, resolved.entry, ctx);
    layouts.push(layout);
  }

  const mainLayout = layouts.find((item) => item.id === mainId) ?? layouts[0];
  const importedLayouts = opts.keyboards === "main" ? [mainLayout] : layouts;
  if (opts.calibrateRows) {
    for (const layout of importedLayouts) fitLayoutRows(layout);
    const message = "已把每行宽度校准到 100%；可在 Layouts → Reflow 重新分行。";
    warnings.push(message);
    report.mapped.push(message);
  }
  if (opts.keyboards === "main" && layouts.length > 1) {
    const message = `仅导入主键盘；${layouts.length - 1} 个页面布局未导入，页面跳转引用可能悬空。`;
    warnings.push(message);
    report.dropped.push(message);
  }
  const project = blankBundle();
  project.id = `imported-${slug(fileName.replace(/\.ya?ml$/i, ""))}`;
  project.meta = {
    name: text(doc.name) || fileName.replace(/\.ya?ml$/i, ""),
    author: text(doc.author) || "imported trime.yaml",
    description: `Imported from ${fileName}`,
    configVersion: text(doc.config_version) || "3.0",
  };
  project.defaultLayoutId = mainLayout.id;
  project.layoutGroupIds = importedLayouts.map((item) => item.id);
  project.layouts = importedLayouts;
  project.macros = macros;
  project.customPresetKeys = rawPresetKeys;
  project.keyStyles = defaultKeyStyles();
  if (cards) {
    project.theme = { light: cards.light, dark: cards.dark };
    project.customThemeCards = [structuredClone(cards.light), structuredClone(cards.dark)];
    const hasDark = Object.prototype.hasOwnProperty.call(asDict(doc.preset_color_schemes), "dark");
    project.variant = hasDark ? "dark" : "light";
  }
  if (opts.interface) {
    project.chrome = normalizeChrome(importChrome(doc, report));
  }
  const style = asDict(doc.style);
  project.metrics = {
    keyWidth: number(style.key_width),
    keyHeight: number(style.key_height),
    keyboardHeight: number(style.keyboard_height),
    horizontalGap: number(style.keyboard_padding_left ?? style.keyboard_padding),
    verticalGap: number(style.vertical_gap),
    candidateViewHeight: number(style.candidate_view_height),
    candidateTextSize: number(style.candidate_text_size),
    commentTextSize: number(style.comment_text_size),
    keyTextSize: number(style.key_text_size),
    popupWidth: number(style.popup_width),
    popupHeight: number(style.popup_height),
    popupKeyHeight: number(style.popup_key_height),
    popupTextSize: number(style.popup_text_size),
    popupBottomMargin: number(style.popup_bottom_margin),
  };
  for (const key of Object.keys(project.metrics) as Array<keyof NonNullable<ProjectBundle["metrics"]>>) {
    if (project.metrics[key] === undefined) delete project.metrics[key];
  }

  const passthrough: Record<string, unknown> = {};
  const topUnknown = pickUnknown(doc, TOP_LEVEL_KEYS);
  if (Object.keys(topUnknown).length > 0) {
    passthrough.top = topUnknown;
    report.passthrough.push(`顶层字段：${Object.keys(topUnknown).join(", ")}`);
  }
  const styleUnknown = pickUnknown(style, STYLE_KEYS);
  if (Object.keys(styleUnknown).length > 0) {
    passthrough.style = styleUnknown;
    report.passthrough.push(`style 字段：${Object.keys(styleUnknown).join(", ")}`);
  }
  for (const section of ["window", "preedit", "tool_bar", "liquid_keyboard"] as const) {
    const raw = asDict(doc[section]);
    if (Object.keys(raw).length > 0) {
      passthrough[section] = raw;
      report.passthrough.push(`${section}（原始字段保留）`);
    }
  }
  const schemes = asDict(doc.preset_color_schemes);
  if (Object.keys(schemes).length > 0) {
    passthrough.preset_color_schemes = schemes;
    report.passthrough.push("preset_color_schemes（原始字段保留）");
  }
  if (Object.keys(macroPassthrough).length > 0) {
    passthrough.macros = macroPassthrough;
    report.passthrough.push(`宏的额外字段：${Object.keys(macroPassthrough).join(", ")}`);
  }
  const aliasKeyboards: Dict = {};
  for (const [id, value] of Object.entries(presetKeyboards)) {
    const entry = asDict(value);
    if (text(entry.import_preset)) aliasKeyboards[id] = entry;
  }
  if (Object.keys(aliasKeyboards).length > 0) {
    passthrough.preset_keyboards = aliasKeyboards;
    report.passthrough.push(`preset_keyboards alias：${Object.keys(aliasKeyboards).join(", ")}`);
  }
  project.passthrough = passthrough;

  const fallback = asDict(doc.fallback_colors);
  const fallbackColors: Record<string, string> = {};
  for (const [key, value] of Object.entries(fallback)) {
    if (typeof value === "string") fallbackColors[key] = value;
  }
  if (Object.keys(fallbackColors).length > 0) {
    project.fallbackColors = fallbackColors;
    report.mapped.push("fallback_colors");
  }

  const summary = `已导入 ${importedLayouts.length} 个键盘、${macros.length} 个宏${cards ? "、浅色/深色 2 个方案" : ""}${opts.interface ? "、界面配置" : ""}。`;
  report.mapped.unshift(summary);
  return { project, warnings, report };
}
