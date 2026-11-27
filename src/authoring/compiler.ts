import YAML from "yaml";
import type { ActionRef, ChromeConfig, KeySlot, KeyStyle, LayoutPreset, LayoutRow, LiquidConfig, MacroPreset, PreeditConfig, ProjectBundle, ThemeCardPreset, ToolbarButton, WindowConfig } from "./types";
import { defaultChrome, defaultKeyStyles, defaultThemeSelection, integerRowWidths, isPlaceholder, normalizeBundle, normalizeChrome, rowPercentages } from "./utils";
import { mergeMetrics, resolveLayoutForDevice } from "./resolve";
import { BUILTIN_PRESETS } from "./presets";

/**
 * Trime only recognises these scheme styles. Everything else is applied as a
 * per-key colour override in preset_keyboards, which is why non-default roles
 * follow the preview direction instead of the light/dark scheme.
 */
const SCHEME_PREFIX = {
  default: "key",
  off: "off_key",
  on: "on_key",
} as const;

/** Trime writes colours as 0xAARRGGBB; accept #RRGGBB authoring tokens. */
export function normalizeColor(value: string | undefined): string {
  if (!value) return "";
  const trimmed = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return `0xFF${trimmed.slice(1).toUpperCase()}`;
  if (/^#[0-9a-fA-F]{8}$/.test(trimmed)) return `0x${trimmed.slice(1).toUpperCase()}`;
  return trimmed;
}

function color(card: ThemeCardPreset, token: string | undefined): string {
  if (!token) return "";
  const [group, key] = token.includes(".") ? token.split(".", 2) : ["tokens", token];
  if (group === "tokens") return normalizeColor(card.tokens[key]);
  return normalizeColor(card.states[group]?.[key] ?? card.tokens[token]);
}

type ResolvedStyle = {
  back: string;
  text: string;
  symbol: string;
  border: string;
  hilitedBack: string;
  hilitedText: string;
  hilitedSymbol: string;
  hilitedBorder: string;
};

function resolveStyle(card: ThemeCardPreset, style: KeyStyle): ResolvedStyle {
  const pressed = style.pressed ?? {};
  return {
    back: color(card, style.background),
    text: color(card, style.text),
    symbol: color(card, style.symbol ?? style.text),
    border: color(card, style.border ?? style.background),
    hilitedBack: color(card, pressed.background) || color(card, "pressed.surface") || color(card, style.background),
    hilitedText: color(card, pressed.text) || color(card, "pressed.text") || color(card, style.text),
    hilitedSymbol: color(card, pressed.symbol) || color(card, style.symbol ?? style.text),
    hilitedBorder: color(card, pressed.border) || color(card, style.border ?? style.background),
  };
}

function schemeStyleColors(card: ThemeCardPreset, style: KeyStyle, prefix: string) {
  const resolved = resolveStyle(card, style);
  return {
    [`${prefix}_back_color`]: resolved.back,
    [`${prefix}_text_color`]: resolved.text,
    [`${prefix}_symbol_color`]: resolved.symbol,
    [`${prefix}_border_color`]: resolved.border,
    [`hilited_${prefix}_back_color`]: resolved.hilitedBack,
    [`hilited_${prefix}_text_color`]: resolved.hilitedText,
    [`hilited_${prefix}_symbol_color`]: resolved.hilitedSymbol,
    [`hilited_${prefix}_border_color`]: resolved.hilitedBorder,
  };
}

function buildScheme(card: ThemeCardPreset, keyStyles: Record<string, KeyStyle>) {
  const tokens: Record<string, string> = {
    back_color: color(card, "bg"),
    text_color: color(card, "text"),
    candidate_text_color: color(card, "text"),
    comment_text_color: color(card, "textMuted"),
    border_color: color(card, "border"),
    label_color: color(card, "textMuted"),
    candidate_background: color(card, "surface"),
    keyboard_background: color(card, "surface"),
    root_background: color(card, "bg"),
    liquid_keyboard_background: color(card, "surface"),
    shadow_color: "0x33000000",
    long_text_color: color(card, "text"),
    long_text_back_color: color(card, "surface"),
    preview_back_color: color(card, "surface"),
    preview_text_color: color(card, "text"),
    popup_back_color: color(card, "surface"),
    popup_text_color: color(card, "text"),
    popup_border_color: color(card, "border"),
  };

  // Only emit Trime's fixed scheme styles. modifier / enter / space / custom
  // styles are compiled as per-key colours by compileKey instead.
  const defaultStyle = keyStyles.default ?? Object.values(keyStyles)[0];
  if (defaultStyle) Object.assign(tokens, schemeStyleColors(card, defaultStyle, SCHEME_PREFIX.default));
  const offStyle = keyStyles.off;
  if (offStyle) Object.assign(tokens, schemeStyleColors(card, offStyle, SCHEME_PREFIX.off));
  const onStyle = keyStyles.on;
  if (onStyle) Object.assign(tokens, schemeStyleColors(card, onStyle, SCHEME_PREFIX.on));

  if (!tokens.off_key_back_color) tokens.off_key_back_color = color(card, "surfaceAlt");
  if (!tokens.off_key_text_color) tokens.off_key_text_color = color(card, "textMuted");
  if (!tokens.off_key_symbol_color) tokens.off_key_symbol_color = color(card, "textMuted");
  if (!tokens.off_key_border_color) tokens.off_key_border_color = color(card, "border");
  return { name: card.name, author: "trime-theme-editor", ...tokens } as Record<string, unknown>;
}

function clean(input: Record<string, unknown>): Record<string, unknown> {
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined && value !== "") output[key] = value;
  }
  return output;
}

function isDict(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/** Raw passthrough is the base; generated/modelled fields win. Objects merge recursively. */
function mergeDeep(base: unknown, override: unknown): unknown {
  if (isDict(base) && isDict(override)) {
    const output: Record<string, unknown> = { ...base };
    for (const [key, value] of Object.entries(override)) {
      output[key] = mergeDeep(base[key], value);
    }
    return output;
  }
  return override === undefined ? base : override;
}

function mergeScheme(raw: Record<string, unknown>, generated: Record<string, unknown>): Record<string, unknown> {
  const merged = mergeDeep(raw, generated) as Record<string, unknown>;
  // Preserve the source scheme's identity fields while generated colors win.
  for (const key of ["name", "author"] as const) {
    if (typeof raw[key] === "string") merged[key] = raw[key];
  }
  return merged;
}

function compileToolbarButton(button: ToolbarButton): Record<string, unknown> {
  const background = button.background ? clean({
    type: button.background.type,
    normal: normalizeColor(button.background.normal),
    highlight: button.background.highlight,
    vertical_inset: button.background.verticalInset,
    horizontal_inset: button.background.horizontalInset,
  }) : undefined;
  const foreground = (button.foreground || button.icon) ? clean({
    style: button.icon ?? button.foreground?.style,
    normal: button.foreground?.normal,
    padding: button.foreground?.padding,
  }) : undefined;
  const generated = clean({
    action: button.action,
    long_press_action: button.longPressAction,
    label: button.label,
    background,
    foreground,
    size: button.size,
  });
  return mergeDeep(button.passthrough ?? {}, generated) as Record<string, unknown>;
}

function compileToolbar(config: ChromeConfig["toolbar"]): Record<string, unknown> {
  return {
    button_spacing: config.buttonSpacing,
    back_style: config.backStyle,
    primary_button: compileToolbarButton(config.primaryButton),
    buttons: config.buttons.map(compileToolbarButton),
  };
}

function compileLiquidTab(tab: LiquidConfig["tabs"][number]): Record<string, unknown> {
  const output: Record<string, unknown> = { type: tab.type, name: tab.name };
  if (tab.type === "SINGLE" && tab.keys?.length) output.keys = tab.keys;
  if (tab.type === "SYMBOL" && tab.symbols?.length) {
    output.keys = tab.symbols.map((item) => ({ [item.label]: item.command }));
  }
  return mergeDeep(tab.passthrough ?? {}, output) as Record<string, unknown>;
}

function compileLiquid(config: LiquidConfig): Record<string, unknown> {
  const tabs: Record<string, unknown> = {};
  for (const tab of config.tabs) tabs[tab.id] = compileLiquidTab(tab);
  return {
    single_width: config.singleWidth,
    margin_x: config.marginX,
    ...(config.keyHeight !== undefined ? { key_height: config.keyHeight } : {}),
    ...(config.row !== undefined ? { row: config.row } : {}),
    ...(config.verticalGap !== undefined ? { vertical_gap: config.verticalGap } : {}),
    fixed_key_bar: { position: config.fixedBar.position, keys: config.fixedBar.keys },
    keyboards: config.tabs.map((tab) => tab.id),
    ...tabs,
  };
}

function compileWindow(config: WindowConfig): Record<string, unknown> {
  return {
    insets: { vertical: config.verticalInset, horizontal: config.horizontalInset },
    item_padding: { vertical: config.itemVerticalPadding, horizontal: config.itemHorizontalPadding },
    min_width: config.minWidth,
    corner_radius: config.cornerRadius,
    border: config.border,
    shadow: config.shadow,
    alpha: config.alpha,
    foreground: {
      label_font_size: config.labelFontSize,
      text_font_size: config.textFontSize,
      comment_font_size: config.commentFontSize,
    },
  };
}

function compilePreedit(config: PreeditConfig): Record<string, unknown> {
  return {
    horizontal_padding: config.horizontalPadding,
    top_start_radius: config.topStartRadius,
    top_end_radius: config.topEndRadius,
    alpha: config.alpha,
    foreground: { font_size: config.fontSize },
  };
}

function liquidPresetKeys(config: LiquidConfig): Record<string, unknown> {
  const keys: Record<string, unknown> = {
    liquid_keyboard_exit: { label: "返回", send: "FUNCTION", command: "liquid_keyboard", option: "-1" },
    space1: { label: "空格", repeatable: false, functional: false, send: "space" },
    Return1: { label: "回车", send: "Return" },
    liquid_keyboard_clipboard: { label: "剪贴", send: "FUNCTION", command: "liquid_keyboard", option: "clipboard" },
  };
  for (const tab of config.tabs) {
    keys[`liquid_keyboard_${tab.id.replace(/[^A-Za-z0-9_]/g, "_")}`] ??= {
      label: tab.name,
      send: "FUNCTION",
      command: "liquid_keyboard",
      option: tab.id,
    };
  }
  return keys;
}

export function macroToken(macro: MacroPreset): string {
  return macro.steps.map((step) => {
    if (step.type === "text") return step.value;
    if (step.type === "key") return step.value ? `{${step.value}}` : "";
    return "";
  }).join("");
}

export function macroId(id: string) {
  return id.startsWith("macro_") ? id : `macro_${id.replace(/[^A-Za-z0-9_]/g, "_")}`;
}

function pageAction(id: string) {
  return `Keyboard_${id.replace(/[^A-Za-z0-9_]/g, "_")}`;
}

function sanitizeId(value: string) {
  return value.replace(/[^A-Za-z0-9_]/g, "_");
}

function actionToken(action: ActionRef | undefined, macroKeyOf: (id: string) => string): string | undefined {
  if (!action) return undefined;
  if (action.kind === "char") return action.value;
  if (action.kind === "text") return action.value;
  if (action.kind === "key") return action.value;
  if (action.kind === "macro") return macroKeyOf(action.id);
  if (action.kind === "page") return pageAction(action.id);
  if (action.kind === "toggle") return `toggle_${action.value}`;
  if (action.kind === "command") return `command_${action.value}`;
  if (action.kind === "preset") return action.value;
  return undefined;
}

/**
 * Trime reads key widths as shares of 100 and wraps when a row reaches 100.
 * Normalize every row so the editor's explicit rows survive compilation.
 */
function rowExportWidths(row: LayoutRow, precision: "exact" | "integer"): number[] {
  if (precision === "integer") return integerRowWidths(row);
  const percentages = rowPercentages(row);
  if (percentages.length === 0) return [];
  const rounded = percentages.map((value) => Number(value.toFixed(3)));
  const diff = Number((100 - rounded.reduce((sum, value) => sum + value, 0)).toFixed(3));
  if (diff !== 0) {
    // Put the residual on the widest key so it can never become negative.
    let widest = 0;
    for (let index = 1; index < rounded.length; index += 1) {
      if (rounded[index] > rounded[widest]) widest = index;
    }
    rounded[widest] = Number((rounded[widest] + diff).toFixed(3));
  }
  return rounded.map((value) => (value > 0 ? value : 0.001));
}

function compileKey(
  slot: KeySlot,
  width: number,
  rowHeight: number | undefined,
  first: boolean,
  card: ThemeCardPreset,
  keyStyles: Record<string, KeyStyle>,
  macroKeyOf: (id: string) => string,
) {
  if (isPlaceholder(slot)) {
    return { ...(slot.passthrough ?? {}), width: Number(width.toFixed(3)) };
  }
  const key: Record<string, unknown> = { ...(slot.passthrough ?? {}) };
  if (slot.click) {
    const token = actionToken(slot.click, macroKeyOf);
    if (token !== undefined && token !== "") key.click = token;
    else if (slot.click.kind === "text") key.click = slot.click.value;
  }
  for (const behavior of ["long_click", "double_click", "swipe_up", "swipe_down", "swipe_left", "swipe_right"] as const) {
    const token = actionToken(slot[behavior], macroKeyOf);
    if (token) key[behavior] = token;
  }
  if (slot.label !== undefined) key.label = slot.label;
  if (slot.label_symbol !== undefined) key.label_symbol = slot.label_symbol;
  if (slot.hint !== undefined) key.hint = slot.hint;
  if (slot.popup?.length) key.popup = slot.popup;
  key.width = Number(width.toFixed(3));
  if (slot.height) key.height = slot.height;
  if (first && rowHeight) key.height = rowHeight;
  if (slot.style && slot.style !== "default") {
    const style = keyStyles[slot.style] ?? keyStyles.default;
    if (style) {
      const resolved = resolveStyle(card, style);
      key.key_back_color = resolved.back;
      key.key_text_color = resolved.text;
      key.key_symbol_color = resolved.symbol;
      key.key_border_color = resolved.border;
      key.hilited_key_back_color = resolved.hilitedBack;
      key.hilited_key_text_color = resolved.hilitedText;
      key.hilited_key_symbol_color = resolved.hilitedSymbol;
      key.hilited_key_border_color = resolved.hilitedBorder;
    }
  }
  for (const field of KEY_COLOR_FIELDS) {
    const value = slot[field];
    if (value) key[field] = value;
  }
  return key;
}

const KEY_COLOR_FIELDS = [
  "key_back_color",
  "key_text_color",
  "key_symbol_color",
  "key_border_color",
  "hilited_key_back_color",
  "hilited_key_text_color",
  "hilited_key_symbol_color",
  "hilited_key_border_color",
] as const;

function compileLayout(
  layout: LayoutPreset,
  card: ThemeCardPreset,
  keyStyles: Record<string, KeyStyle>,
  macroKeyOf: (id: string) => string,
  widthPrecision: "exact" | "integer",
) {
  const keys: Record<string, unknown>[] = [];
  for (const row of layout.rows) {
    const widths = rowExportWidths(row, widthPrecision);
    row.keys.forEach((slot, index) => {
      keys.push(compileKey(slot, widths[index] ?? 100, row.height, index === 0, card, keyStyles, macroKeyOf));
    });
  }
  const firstHeight = layout.rows[0]?.height;
  const generated = { name: layout.name, ascii_mode: layout.asciiMode ?? 0, ...(firstHeight ? { height: firstHeight } : {}), keys };
  return mergeDeep(layout.passthrough ?? {}, generated) as Record<string, unknown>;
}

/**
 * Canonical YAML output. Map keys are sorted with a locale-independent
 * comparator so equivalent bundles always produce byte-identical files.
 */
export function stringifyTrime(value: unknown): string {
  return YAML.stringify(value, {
    lineWidth: 0,
    indent: 2,
    sortMapEntries: (a, b) => {
      const left = String(a.key);
      const right = String(b.key);
      return left < right ? -1 : left > right ? 1 : 0;
    },
  });
}

/**
 * Compiles a v4 bundle into one trime.yaml for a device profile. The bundle
 * is the only source of presets: there is no fallback to built-in libraries
 * here. All layouts in the bundle are compiled so device overrides and schema
 * aliases can reference them.
 */
export function compileBundle(input: ProjectBundle, deviceId?: string): string {
  const bundle = normalizeBundle(input);
  const device = bundle.devices.find((item) => item.id === deviceId) ?? bundle.devices[0];
  const lightCard = bundle.theme.light;
  const darkCard = bundle.theme.dark;
  // Layout key colors are baked into preset_keyboards; they follow the preview
  // direction. The light/dark schemes themselves use their own cards.
  const previewCard = bundle.theme[bundle.variant] ?? darkCard;
  const widthPrecision = bundle.exportWidthPrecision === "integer" ? "integer" : "exact";
  const layout = resolveLayoutForDevice(bundle, device);
  const layouts = bundle.layouts;
  // Bundle macros are the selected set. References to macros that are not in
  // the bundle are reported by the Export panel validation instead of being
  // silently resolved from the built-in catalog.
  const allMacros = bundle.macros;

  const passthrough = isDict(bundle.passthrough) ? bundle.passthrough : {};
  const rawMacros = isDict(passthrough.macros) ? passthrough.macros : {};
  const macroKeys = new Map(allMacros.map((item) => [item.id, item.token ?? macroId(item.id)]));
  const macroKeyOf = (id: string) => macroKeys.get(id) ?? macroId(id);
  const presetKeys: Record<string, unknown> = {};
  for (const item of allMacros) {
    const token = macroToken(item);
    if (token) {
      const raw = isDict(rawMacros[item.id]) ? rawMacros[item.id] : {};
      presetKeys[macroKeyOf(item.id)] = mergeDeep(raw, { text: token });
    }
  }
  for (const item of layouts) {
    presetKeys[pageAction(item.id)] = { label: item.name, send: "Eisu_toggle", select: item.id };
  }
  if (layout) {
    presetKeys.Keyboard_main = { label: "ABC", send: "Eisu_toggle", select: layout.id };
    presetKeys.Keyboard_default = { label: "返回", send: "Eisu_toggle", select: `.default` };
  }

  const presetKeyboards: Record<string, unknown> = {};
  for (const item of layouts) presetKeyboards[item.id] = compileLayout(item, previewCard, bundle.keyStyles, macroKeyOf, widthPrecision);
  if (layout && layout.id !== "default") presetKeyboards.default = { import_preset: layout.id };

  // Schema bindings emit alias keyboards that import an existing keyset.
  // Landscape devices import the landscape variant when one exists.
  const aliasTarget = (id: string) => {
    if (device?.orientation !== "landscape") return id;
    const base = bundle.layouts.find((item) => item.id === id);
    if (!base?.landscapeId) return id;
    return bundle.layouts.some((item) => item.id === base.landscapeId) ? base.landscapeId : id;
  };
  const aliases: string[] = [];
  for (const binding of bundle.schemaBindings) {
    if (!binding.layoutId || !layouts.some((item) => item.id === binding.layoutId)) continue;
    const alias = binding.alias?.trim() || `schema_${sanitizeId(binding.schemaId || binding.layoutId)}`;
    if (alias === "default" || Object.prototype.hasOwnProperty.call(presetKeyboards, alias)) continue;
    presetKeyboards[alias] = { import_preset: aliasTarget(binding.layoutId) };
    aliases.push(alias);
  }

  const firstRowHeight = layout?.rows[0]?.height ?? 52;
  const metrics = mergeMetrics(bundle.metrics, device?.metrics);
  const chrome = normalizeChrome(bundle.chrome);
  const rawKeyboards = isDict(passthrough.preset_keyboards) ? passthrough.preset_keyboards : {};
  for (const [id, raw] of Object.entries(rawKeyboards)) {
    if (!isDict(raw) || Object.prototype.hasOwnProperty.call(presetKeyboards, id)) continue;
    presetKeyboards[id] = structuredClone(raw);
    aliases.push(id);
  }
  for (const [name, value] of Object.entries(liquidPresetKeys(chrome.liquid))) {
    if (!presetKeys[name]) presetKeys[name] = value;
  }
  for (const [name, value] of Object.entries(bundle.customPresetKeys ?? {})) {
    if (name.startsWith("Keyboard_")) continue;
    presetKeys[name] = value;
  }

  const rawTop = isDict(passthrough.top) ? passthrough.top : {};
  const rawStyle = isDict(passthrough.style) ? passthrough.style : {};
  const rawWindow = isDict(passthrough.window) ? passthrough.window : {};
  const rawPreedit = isDict(passthrough.preedit) ? passthrough.preedit : {};
  const rawToolbar = isDict(passthrough.tool_bar) ? passthrough.tool_bar : {};
  const rawLiquid = isDict(passthrough.liquid_keyboard) ? passthrough.liquid_keyboard : {};
  const rawSchemes = isDict(passthrough.preset_color_schemes) ? passthrough.preset_color_schemes : {};
  const rawLight = isDict(rawSchemes.light) ? rawSchemes.light : {};
  const rawDark = isDict(rawSchemes.dark) ? rawSchemes.dark : {};
  const extraSchemes: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(rawSchemes)) {
    if (name === "light" || name === "dark") continue;
    if (isDict(value)) extraSchemes[name] = structuredClone(value);
  }
  const fallbackColors = bundle.fallbackColors && Object.keys(bundle.fallbackColors).length > 0
    ? bundle.fallbackColors
    : {
      candidate_text_color: "text_color",
      comment_text_color: "candidate_text_color",
      border_color: "back_color",
      key_back_color: "back_color",
      key_border_color: "border_color",
      key_text_color: "candidate_text_color",
      key_symbol_color: "comment_text_color",
    };

  const generated = {
    config_version: bundle.meta.configVersion || "3.0",
    name: bundle.meta.name,
    author: bundle.meta.author,
    style: mergeDeep(rawStyle, {
      key_width: metrics.keyWidth ?? 10,
      key_height: metrics.keyHeight ?? firstRowHeight,
      horizontal_gap: metrics.horizontalGap ?? 2,
      vertical_gap: metrics.verticalGap ?? 3,
      keyboard_height: metrics.keyboardHeight ?? 270,
      candidate_view_height: metrics.candidateViewHeight ?? 44,
      candidate_text_size: metrics.candidateTextSize ?? 18,
      comment_text_size: metrics.commentTextSize ?? 12,
      key_text_size: metrics.keyTextSize ?? 22,
      key_long_text_size: 14,
      popup_width: metrics.popupWidth ?? 44,
      popup_height: metrics.popupHeight ?? 56,
      popup_key_height: metrics.popupKeyHeight ?? 48,
      popup_text_size: metrics.popupTextSize ?? 22,
      popup_bottom_margin: metrics.popupBottomMargin ?? 8,
      keyboards: [...new Set([...layouts.map((item) => item.id), ...aliases, ...(layout ? ["default"] : [])])],
    }),
    window: mergeDeep(rawWindow, compileWindow(chrome.window)),
    preedit: mergeDeep(rawPreedit, compilePreedit(chrome.preedit)),
    tool_bar: mergeDeep(rawToolbar, compileToolbar(chrome.toolbar)),
    fallback_colors: fallbackColors,
    preset_color_schemes: {
      ...extraSchemes,
      light: mergeScheme(rawLight, buildScheme(lightCard, bundle.keyStyles)),
      dark: mergeScheme(rawDark, { ...buildScheme(darkCard, bundle.keyStyles), light_scheme: "light" }),
    },
    preset_keys: presetKeys,
    preset_keyboards: presetKeyboards,
    liquid_keyboard: mergeDeep(rawLiquid, compileLiquid(chrome.liquid)),
  };
  return stringifyTrime({ ...rawTop, ...generated });
}

function embeddedPreset<T extends { id: string }>(items: T[], id: string): T {
  const found = items.find((item) => item.id === id) ?? items[0];
  return structuredClone(found);
}

function baseBundle(): ProjectBundle {
  return {
    format: "trime-theme-bundle",
    schemaVersion: 4,
    id: "default",
    meta: { name: "My Trime Theme", author: "trime-theme-editor", description: "", configVersion: "3.0" },
    devices: [{ id: "phone", kind: "phone", orientation: "portrait" }],
    schemaBindings: [],
    layoutGroupIds: [],
    theme: defaultThemeSelection(),
    variant: "dark",
    customThemeCards: [],
    keyStyles: defaultKeyStyles(),
    layouts: [],
    macros: [],
    chrome: defaultChrome(),
    passthrough: {},
  };
}

/** A genuinely empty project: no layouts and no default until the author adds one. */
export function blankBundle(): ProjectBundle {
  return baseBundle();
}

/** Seeded 26-key template used by tests and explicit template flows. */
export function templateBundle(): ProjectBundle {
  const main = embeddedPreset(BUILTIN_PRESETS.layouts.filter((item) => item.role === "letters"), "qwerty26");
  const pages = ["number", "symbols"]
    .map((id) => BUILTIN_PRESETS.layouts.find((item) => item.id === id))
    .filter((item): item is LayoutPreset => Boolean(item))
    .map((item) => structuredClone(item));
  const macroIds = ["pair-paren", "pair-bracket", "pair-brace", "select-all", "cut", "copy", "paste"];
  const macros = macroIds
    .map((id) => BUILTIN_PRESETS.macros.find((item) => item.id === id))
    .filter((item): item is MacroPreset => Boolean(item))
    .map((item) => structuredClone(item));
  return {
    ...baseBundle(),
    defaultLayoutId: main.id,
    layoutGroupIds: [main.id, ...pages.map((item) => item.id)],
    layouts: [main, ...pages],
    macros,
  };
}
