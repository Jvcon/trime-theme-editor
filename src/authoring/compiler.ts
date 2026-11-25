import YAML from "yaml";
import type { ActionRef, ChromeConfig, KeySlot, KeyStyle, LayoutPreset, LiquidConfig, MacroPreset, PresetLibraries, PreeditConfig, ProjectDoc, ThemeCardPreset, ToolbarButton, Variant, WindowConfig } from "./types";
import { defaultKeyStyles, normalizeChrome } from "./utils";

const PREFIX: Record<string, string> = {
  default: "key",
  modifier: "modifier",
  enter: "enter",
  space: "space",
  off: "off_key",
};

function prefixFor(styleId: string) {
  return PREFIX[styleId] ?? `style_${styleId.replace(/[^A-Za-z0-9_]/g, "_")}`;
}

/** Trime writes colours as 0xAARRGGBB; accept #RRGGBB authoring tokens. */
export function normalizeColor(value: string | undefined): string {
  if (!value) return "";
  const trimmed = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return `0xFF${trimmed.slice(1).toUpperCase()}`;
  if (/^#[0-9a-fA-F]{8}$/.test(trimmed)) return `0x${trimmed.slice(1).toUpperCase()}`;
  return trimmed;
}

function color(variant: ThemeCardPreset["variants"][Variant], token: string | undefined): string {
  if (!token) return "";
  const [group, key] = token.includes(".") ? token.split(".", 2) : ["tokens", token];
  if (group === "tokens") return normalizeColor(variant.tokens[key]);
  return normalizeColor(variant.states[group]?.[key] ?? variant.tokens[token]);
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

function resolveStyle(variant: ThemeCardPreset["variants"][Variant], style: KeyStyle): ResolvedStyle {
  const pressed = style.pressed ?? {};
  return {
    back: color(variant, style.background),
    text: color(variant, style.text),
    symbol: color(variant, style.symbol ?? style.text),
    border: color(variant, style.border ?? style.background),
    hilitedBack: color(variant, pressed.background) || color(variant, "pressed.surface") || color(variant, style.background),
    hilitedText: color(variant, pressed.text) || color(variant, "pressed.text") || color(variant, style.text),
    hilitedSymbol: color(variant, pressed.symbol) || color(variant, style.symbol ?? style.text),
    hilitedBorder: color(variant, pressed.border) || color(variant, style.border ?? style.background),
  };
}

function styleColors(variant: ThemeCardPreset["variants"][Variant], style: KeyStyle) {
  const prefix = prefixFor(style.id);
  const resolved = resolveStyle(variant, style);
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

function buildScheme(card: ThemeCardPreset, variantName: Variant, keyStyles: Record<string, KeyStyle>) {
  const variant = card.variants[variantName];
  const tokens: Record<string, string> = {
    back_color: color(variant, "bg"),
    text_color: color(variant, "text"),
    candidate_text_color: color(variant, "text"),
    comment_text_color: color(variant, "textMuted"),
    border_color: color(variant, "border"),
    label_color: color(variant, "textMuted"),
    candidate_background: color(variant, "surface"),
    keyboard_background: color(variant, "surface"),
    root_background: color(variant, "bg"),
    liquid_keyboard_background: color(variant, "surface"),
    shadow_color: "0x33000000",
    long_text_color: color(variant, "text"),
    long_text_back_color: color(variant, "surface"),
    preview_back_color: color(variant, "surface"),
    preview_text_color: color(variant, "text"),
    popup_back_color: color(variant, "surface"),
    popup_text_color: color(variant, "text"),
    popup_border_color: color(variant, "border"),
  };

  for (const style of Object.values(keyStyles)) {
    Object.assign(tokens, styleColors(variant, style));
  }
  const fallback = keyStyles.default ?? Object.values(keyStyles)[0];
  if (fallback) {
    const prefix = prefixFor(fallback.id);
    tokens.key_back_color = tokens[`${prefix}_back_color`] ?? tokens.key_back_color;
    tokens.key_text_color = tokens[`${prefix}_text_color`] ?? tokens.key_text_color;
    tokens.key_symbol_color = tokens[`${prefix}_symbol_color`] ?? tokens.key_symbol_color;
    tokens.key_border_color = tokens[`${prefix}_border_color`] ?? tokens.key_border_color;
    tokens.hilited_key_back_color = tokens[`hilited_${prefix}_back_color`] ?? tokens.hilited_key_back_color;
    tokens.hilited_key_text_color = tokens[`hilited_${prefix}_text_color`] ?? tokens.hilited_key_text_color;
    tokens.hilited_key_symbol_color = tokens[`hilited_${prefix}_symbol_color`] ?? tokens.hilited_key_symbol_color;
    tokens.hilited_key_border_color = tokens[`hilited_${prefix}_border_color`] ?? tokens.hilited_key_border_color;
  }
  if (!tokens.off_key_back_color) tokens.off_key_back_color = color(variant, "surfaceAlt");
  if (!tokens.off_key_text_color) tokens.off_key_text_color = color(variant, "textMuted");
  if (!tokens.off_key_symbol_color) tokens.off_key_symbol_color = color(variant, "textMuted");
  if (!tokens.off_key_border_color) tokens.off_key_border_color = color(variant, "border");
  return { name: `${card.name} ${variantName}`, author: "trime-theme-editor", ...tokens } as Record<string, unknown>;
}

function clean(input: Record<string, unknown>): Record<string, unknown> {
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined && value !== "") output[key] = value;
  }
  return output;
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
  return clean({
    action: button.action,
    long_press_action: button.longPressAction,
    label: button.label,
    background,
    foreground,
    size: button.size,
  });
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
  return output;
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
  return `macro_${id.replace(/[^A-Za-z0-9_]/g, "_")}`;
}

function pageAction(id: string) {
  return `Keyboard_${id.replace(/[^A-Za-z0-9_]/g, "_")}`;
}

function actionToken(action: ActionRef | undefined): string | undefined {
  if (!action) return undefined;
  if (action.kind === "char") return action.value;
  if (action.kind === "text") return action.value;
  if (action.kind === "key") return action.value;
  if (action.kind === "macro") return macroId(action.id);
  if (action.kind === "page") return pageAction(action.id);
  if (action.kind === "toggle") return `toggle_${action.value}`;
  if (action.kind === "command") return `command_${action.value}`;
  if (action.kind === "preset") return action.value;
  return undefined;
}

function compileKey(
  slot: KeySlot,
  macros: MacroPreset[],
  rowHeight: number | undefined,
  first: boolean,
  variant: ThemeCardPreset["variants"][Variant],
  keyStyles: Record<string, KeyStyle>,
) {
  const key: Record<string, unknown> = {};
  if (slot.click) {
    const token = actionToken(slot.click);
    if (token !== undefined && token !== "") key.click = token;
    else if (slot.click.kind === "text") key.click = slot.click.value;
  }
  for (const behavior of ["long_click", "double_click", "swipe_up", "swipe_down", "swipe_left", "swipe_right"] as const) {
    const token = actionToken(slot[behavior]);
    if (token) key[behavior] = token;
  }
  if (slot.label !== undefined) key.label = slot.label;
  if (slot.label_symbol !== undefined) key.label_symbol = slot.label_symbol;
  if (slot.hint !== undefined) key.hint = slot.hint;
  if (slot.popup?.length) key.popup = slot.popup;
  key.width = Number((slot.width ?? 10).toFixed(3));
  if (slot.height) key.height = slot.height;
  if (first && rowHeight) key.height = rowHeight;
  if (slot.style && slot.style !== "default") {
    const style = keyStyles[slot.style] ?? keyStyles.default;
    if (style) {
      const resolved = resolveStyle(variant, style);
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
  return key;
}

function compileLayout(
  layout: LayoutPreset,
  macros: MacroPreset[],
  variant: ThemeCardPreset["variants"][Variant],
  keyStyles: Record<string, KeyStyle>,
) {
  const keys: Record<string, unknown>[] = [];
  for (const row of layout.rows) {
    row.keys.forEach((slot, index) => {
      if (slot.click?.kind === "text" && slot.click.value === "") {
        keys.push({ width: Number((slot.width ?? 10).toFixed(3)) });
        return;
      }
      keys.push(compileKey(slot, macros, row.height, index === 0, variant, keyStyles));
    });
  }
  const firstHeight = layout.rows[0]?.height;
  return { name: layout.name, ascii_mode: 0, ...(firstHeight ? { height: firstHeight } : {}), keys };
}

export function compileProject(project: ProjectDoc, basePresets: PresetLibraries): string {
  const presets: PresetLibraries = {
    themeCards: [...basePresets.themeCards, ...(project.customThemeCards ?? [])],
    layouts: [...basePresets.layouts, ...(project.customLayouts ?? [])],
    macros: [...basePresets.macros, ...(project.customMacros ?? [])],
  };
  const card = presets.themeCards.find((item) => item.id === project.themeCardId) ?? presets.themeCards[0];
  const variant = card.variants[project.variant] ?? card.variants.light;
  const layout = presets.layouts.find((item) => item.id === project.layoutId) ?? presets.layouts[0];
  const pageIds = (project.pageIds ?? []).filter((id) => id !== layout.id);
  const pages = [
    layout,
    ...pageIds.map((id) => presets.layouts.find((item) => item.id === id)).filter((item): item is LayoutPreset => Boolean(item)),
  ];
  const usedMacros = new Set<string>();
  const collect = (action: ActionRef | undefined) => {
    if (action?.kind === "macro") usedMacros.add(action.id);
  };
  for (const p of pages) {
    for (const row of p.rows) for (const slot of row.keys) {
      collect(slot.click);
      collect(slot.long_click);
      collect(slot.double_click);
      collect(slot.swipe_up);
      collect(slot.swipe_down);
      collect(slot.swipe_left);
      collect(slot.swipe_right);
    }
  }
  const allMacros = presets.macros.filter((item) => project.macroIds.includes(item.id) || usedMacros.has(item.id));

  const presetKeys: Record<string, unknown> = {};
  for (const item of allMacros) {
    const token = macroToken(item);
    if (token) presetKeys[macroId(item.id)] = { text: token };
  }
  for (const p of pages) {
    presetKeys[pageAction(p.id)] = { label: p.name, send: "Eisu_toggle", select: p.id };
  }
  presetKeys.Keyboard_main = { label: "ABC", send: "Eisu_toggle", select: layout.id };
  presetKeys.Keyboard_default = { label: "返回", send: "Eisu_toggle", select: `.default` };

  const presetKeyboards: Record<string, unknown> = {};
  for (const p of pages) presetKeyboards[p.id] = compileLayout(p, allMacros, variant, project.keyStyles);
  if (layout.id !== "default") presetKeyboards.default = { import_preset: layout.id };

  const firstRowHeight = layout.rows[0]?.height ?? 52;
  const metrics = project.metrics ?? {};
  const chrome = normalizeChrome(project.chrome);
  for (const [name, value] of Object.entries(liquidPresetKeys(chrome.liquid))) {
    if (!presetKeys[name]) presetKeys[name] = value;
  }
  for (const [name, value] of Object.entries(project.customPresetKeys ?? {})) {
    if (name.startsWith("Keyboard_")) continue;
    presetKeys[name] = value;
  }

  return YAML.stringify({
    config_version: project.meta.configVersion || "3.0",
    name: project.meta.name,
    author: project.meta.author,
    style: {
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
      keyboards: [...new Set([...pages.map((item) => item.id), "default"])],
    },
    window: compileWindow(chrome.window),
    preedit: compilePreedit(chrome.preedit),
    tool_bar: compileToolbar(chrome.toolbar),
    fallback_colors: {
      candidate_text_color: "text_color",
      comment_text_color: "candidate_text_color",
      border_color: "back_color",
      key_back_color: "back_color",
      key_border_color: "border_color",
      key_text_color: "candidate_text_color",
      key_symbol_color: "comment_text_color",
    },
    preset_color_schemes: {
      light: buildScheme(card, "light", project.keyStyles),
      dark: { ...buildScheme(card, "dark", project.keyStyles), light_scheme: "light" },
    },
    preset_keys: presetKeys,
    preset_keyboards: presetKeyboards,
    liquid_keyboard: compileLiquid(chrome.liquid),
  }, { lineWidth: 0 });
}

export function defaultProject(): ProjectDoc {
  return {
    version: 1,
    id: "default",
    meta: { name: "My Trime Theme", author: "trime-theme-editor", description: "", configVersion: "3.0" },
    themeCardId: "dracula",
    variant: "dark",
    layoutId: "qwerty26",
    pageIds: ["number", "symbols"],
    macroIds: ["pair-paren", "pair-bracket", "pair-brace", "select-all", "cut", "copy", "paste"],
    keyStyles: defaultKeyStyles(),
    chrome: normalizeChrome(undefined),
  };
}
