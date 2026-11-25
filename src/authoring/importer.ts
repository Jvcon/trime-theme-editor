import YAML from "yaml";
import { defaultBundle } from "./compiler";
import { KEYCODES } from "./catalogs";
import { BUILTIN_PRESETS } from "./presets";
import type { ActionRef, ChromePatch, KeySlot, LayoutPreset, LayoutRow, LiquidConfig, LiquidTab, MacroPreset, MacroStep, PreeditConfig, ProjectBundle, ThemeCardPreset, ToolbarButton, ToolbarConfig, Variant, WindowConfig } from "./types";
import { defaultKeyStyles, fitLayoutRows, normalizeChrome, slug } from "./utils";

type Dict = Record<string, unknown>;

export type ImportResult = {
  project: ProjectBundle;
  warnings: string[];
};

export type ImportOptions = {
  themeCard?: boolean;
  interface?: boolean;
  keyboards?: "all" | "main";
  calibrateRows?: boolean;
};

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

function variantOf(scheme: Dict): ThemeCardPreset["variants"][Variant] {
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
      hover: {
        surface: hex(scheme.hilited_key_back_color ?? scheme.hilited_keyboard_background, FALLBACK.surfaceAlt),
      },
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

function buildCard(doc: Dict, warnings: string[]): ThemeCardPreset | undefined {
  const schemes = asDict(doc.preset_color_schemes);
  const names = Object.keys(schemes);
  if (names.length === 0) {
    warnings.push("没有 preset_color_schemes，保留默认色卡。");
    return undefined;
  }
  const lightName = names.includes("light") ? "light" : names[0];
  const darkName = names.includes("dark") ? "dark" : names.find((name) => name !== lightName) ?? lightName;
  return {
    kind: "theme-card",
    id: `imported-card-${slug(text(doc.name) || "theme")}`,
    name: `${text(doc.name) || "Imported"} card`,
    version: 1,
    builtin: false,
    variants: {
      light: variantOf(asDict(schemes[lightName])),
      dark: variantOf(asDict(schemes[darkName])),
    },
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

function importMacros(doc: Dict, warnings: string[]): {
  macros: MacroPreset[];
  byToken: Map<string, string>;
  rawPresetKeys: Record<string, Record<string, unknown>>;
  rawTokens: Set<string>;
} {
  const presetKeys = asDict(doc.preset_keys);
  const macros: MacroPreset[] = [];
  const rawPresetKeys: Record<string, Record<string, unknown>> = {};
  const rawTokens = new Set<string>();
  const byToken = new Map<string, string>();
  const taken = new Set(BUILTIN_PRESETS.macros.map((item) => item.id));
  for (const [token, value] of Object.entries(presetKeys)) {
    const entry = asDict(value);
    if (Object.keys(entry).length === 0) continue;
    rawPresetKeys[token] = entry;
    if (entry.select !== undefined || entry.command !== undefined) {
      rawTokens.add(token);
      continue;
    }
    const send = text(entry.send);
    const body = text(entry.text);
    if (!send && !body) continue;
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
    });
    byToken.set(token, id);
  }
  if (macros.length > 0) warnings.push(`已导入 ${macros.length} 个 preset_keys 为宏；label/send/text 已转换。`);
  if (rawTokens.size > 0) warnings.push(`已保留 ${rawTokens.size} 个 command/select 型 preset_keys（宏无法表达）。`);
  return { macros, byToken, rawPresetKeys, rawTokens };
}

function importAction(raw: unknown, ctx: { byToken: Map<string, string>; rawTokens: Set<string>; layoutIds: Map<string, string>; defaultId: string; warnings: string[] }): ActionRef | undefined {
  const token = text(raw);
  if (!token) return undefined;
  if (ctx.byToken.has(token)) return { kind: "macro", id: ctx.byToken.get(token)! };
  if (ctx.rawTokens.has(token)) return { kind: "preset", value: token };
  if (token.startsWith("Keyboard_")) {
    const original = token.slice("Keyboard_".length);
    const mapped = ctx.layoutIds.get(original) ?? (original === "default" ? ctx.defaultId : original);
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
  ctx: { byToken: Map<string, string>; rawTokens: Set<string>; layoutIds: Map<string, string>; defaultId: string; warnings: string[] },
): LayoutPreset {
  const rawKeys = Array.isArray(entry.keys) ? entry.keys : [];
  const rows: LayoutRow[] = [];
  let row: LayoutRow = { height: number(entry.height) ?? 52, keys: [] };
  let used = 0;
  for (const rawKey of rawKeys) {
    const source = asDict(rawKey);
    const width = number(source.width) ?? 10;
    if (used + width > 100.5 && row.keys.length > 0) {
      rows.push(row);
      row = { height: number(entry.height) ?? 52, keys: [] };
      used = 0;
    }
    const click = importAction(source.click, ctx);
    const slot: KeySlot = {
      style: click ? "default" : "off",
      width,
      ...(text(source.label) ? { label: text(source.label) } : {}),
      ...(text(source.label_symbol) ? { label_symbol: text(source.label_symbol) } : {}),
      ...(text(source.hint) ? { hint: text(source.hint) } : {}),
      ...(click ? { click } : { click: { kind: "text", value: "" } }),
      ...(importAction(source.long_click, ctx) ? { long_click: importAction(source.long_click, ctx) } : {}),
      ...(importAction(source.double_click, ctx) ? { double_click: importAction(source.double_click, ctx) } : {}),
      ...(importAction(source.swipe_up, ctx) ? { swipe_up: importAction(source.swipe_up, ctx) } : {}),
      ...(importAction(source.swipe_down, ctx) ? { swipe_down: importAction(source.swipe_down, ctx) } : {}),
      ...(importAction(source.swipe_left, ctx) ? { swipe_left: importAction(source.swipe_left, ctx) } : {}),
      ...(importAction(source.swipe_right, ctx) ? { swipe_right: importAction(source.swipe_right, ctx) } : {}),
      ...(Array.isArray(source.popup) ? { popup: source.popup.map(text).filter(Boolean) } : {}),
    };
    if (number(source.height)) slot.height = number(source.height);
    row.keys.push(slot);
    used += width;
  }
  if (row.keys.length > 0) rows.push(row);
  if (rows.length === 0) rows.push({ height: 52, keys: [{ style: "default", width: 100, click: { kind: "char", value: "a" }, label: "A" }] });

  const name = text(entry.name) || id;
  const role = /number|num|123|digit/i.test(id) ? "number" : /symbol|punct|emoji/i.test(id) ? "symbols" : "number";
  return {
    kind: "layout",
    id,
    name,
    version: 1,
    builtin: false,
    pageRole: role as LayoutPreset["pageRole"],
    rows,
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
  };
}

function importToolbar(value: unknown): ToolbarConfig | undefined {
  const source = asDict(value);
  if (Object.keys(source).length === 0) return undefined;
  const primary = importToolbarButton(source.primary_button);
  const buttons = Array.isArray(source.buttons)
    ? source.buttons.map(importToolbarButton).filter((item): item is ToolbarButton => Boolean(item))
    : [];
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
  if (normalizedType === "SYMBOL") {
    const symbols = Array.isArray(rawKeys)
      ? rawKeys.map((item) => {
        const entry = asDict(item);
        const [label, command] = Object.entries(entry)[0] ?? [];
        return { label: String(label ?? ""), command: String(command ?? "") };
      }).filter((item) => item.label)
      : [];
    return { id, name: text(source.name) || id, type: normalizedType, symbols };
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
  return { id, name: text(source.name) || id, type: normalizedType, ...(keys ? { keys } : {}) };
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

function importChrome(doc: Dict): ChromePatch {
  return {
    ...(importToolbar(doc.tool_bar) ? { toolbar: importToolbar(doc.tool_bar) } : {}),
    ...(importLiquid(doc.liquid_keyboard) ? { liquid: importLiquid(doc.liquid_keyboard) } : {}),
    ...(importWindow(doc.window) ? { window: importWindow(doc.window) } : {}),
    ...(importPreedit(doc.preedit) ? { preedit: importPreedit(doc.preedit) } : {}),
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

export function importTrimeYaml(source: string, fileName = "trime.yaml", options: ImportOptions = {}): ImportResult {
  const parsed = YAML.parse(source);
  const doc = asDict(asDict(parsed).base) && Object.keys(asDict(asDict(parsed).base)).length > 0 ? asDict(asDict(parsed).base) : asDict(parsed);
  const warnings: string[] = [];
  const presetKeyboards = asDict(doc.preset_keyboards);
  const opts = { themeCard: true, interface: true, keyboards: "all" as "all" | "main", calibrateRows: true, ...options };

  const card = opts.themeCard ? buildCard(doc, warnings) : undefined;
  const { macros, byToken, rawPresetKeys, rawTokens } = importMacros(doc, warnings);

  const mainCandidate = resolveKeyboard(presetKeyboards, "default")
    ?? resolveKeyboard(presetKeyboards, "qwerty")
    ?? resolveKeyboard(presetKeyboards, Object.keys(presetKeyboards)[0] ?? "");
  if (!mainCandidate) {
    warnings.push("没有可用 preset_keyboards，导入为空项目。");
    const empty = defaultBundle();
    empty.id = `imported-${slug(fileName.replace(/\.ya?ml$/i, ""))}`;
    empty.meta.name = text(doc.name) || fileName.replace(/\.ya?ml$/i, "");
    empty.meta.author = text(doc.author) || empty.meta.author;
    return { project: empty, warnings };
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
  const ctx = { byToken, rawTokens, layoutIds, defaultId: mainId, warnings };

  const layouts: LayoutPreset[] = [];
  const seenLayouts = new Set<string>();
  for (const original of Object.keys(presetKeyboards)) {
    const resolved = resolveKeyboard(presetKeyboards, original);
    if (!resolved || seenLayouts.has(resolved.id)) continue;
    seenLayouts.add(resolved.id);
    const finalId = finalByResolved.get(resolved.id)!;
    const layout = convertKeyboard(finalId, resolved.entry, ctx);
    if (resolved.id === resolvedMainId) layout.pageRole = "main";
    layouts.push(layout);
  }

  const mainLayout = layouts.find((item) => item.id === mainId) ?? layouts[0];
  const importedLayouts = opts.keyboards === "main" ? [mainLayout] : layouts;
  if (opts.calibrateRows) {
    for (const layout of importedLayouts) fitLayoutRows(layout);
    warnings.push("已把每行宽度校准到 100%；可在 Layouts → Reflow 重新分行。");
  }
  if (opts.keyboards === "main" && layouts.length > 1) {
    warnings.push(`仅导入主键盘；${layouts.length - 1} 个页面布局未导入，页面跳转引用可能悬空。`);
  }
  const pageIds = importedLayouts.filter((item) => item.id !== mainLayout.id).map((item) => item.id);
  const project = defaultBundle();
  project.id = `imported-${slug(fileName.replace(/\.ya?ml$/i, ""))}`;
  project.meta = {
    name: text(doc.name) || fileName.replace(/\.ya?ml$/i, ""),
    author: text(doc.author) || "imported trime.yaml",
    description: `Imported from ${fileName}`,
    configVersion: text(doc.config_version) || "3.0",
  };
  project.mainLayoutId = mainLayout.id;
  project.pageIds = pageIds;
  project.layouts = importedLayouts;
  project.macros = macros;
  project.customPresetKeys = rawPresetKeys;
  project.keyStyles = defaultKeyStyles();
  if (card) {
    project.theme = card;
    const hasDark = Object.prototype.hasOwnProperty.call(asDict(doc.preset_color_schemes), "dark");
    project.variant = hasDark ? "dark" : "light";
  }
  if (opts.interface) {
    project.chrome = normalizeChrome(importChrome(doc));
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

  warnings.unshift(`已导入 ${importedLayouts.length} 个键盘、${macros.length} 个宏${card ? "、1 张色卡" : ""}${opts.interface ? "、界面配置" : ""}。`);
  return { project, warnings };
}
