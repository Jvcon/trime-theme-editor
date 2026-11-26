import type { ActionRef, KeySlot, LayoutPreset, LayoutRow, LiquidConfig, MacroPreset, PresetLibraries, PreeditConfig, ThemeCardPreset, ToolbarConfig, WindowConfig } from "./types";

export const KEY_STYLES = {
  default: {
    id: "default", name: "Default",
    background: "surface", text: "text", symbol: "textMuted", border: "border",
    pressed: { background: "primary", text: "onPrimary", symbol: "onPrimary", border: "primary" },
  },
  modifier: {
    id: "modifier", name: "Modifier",
    background: "surfaceAlt", text: "textMuted", symbol: "textMuted", border: "border",
    pressed: { background: "primary", text: "onPrimary" },
  },
  enter: {
    id: "enter", name: "Enter",
    background: "primary", text: "onPrimary", symbol: "onPrimary", border: "primary",
    pressed: { background: "accent", text: "onPrimary" },
  },
  space: {
    id: "space", name: "Space",
    background: "surface", text: "textMuted", symbol: "textMuted", border: "border",
    pressed: { background: "primary", text: "onPrimary" },
  },
  off: {
    id: "off", name: "Off",
    background: "surfaceAlt", text: "textMuted", symbol: "textMuted", border: "border",
    pressed: { background: "primary", text: "onPrimary" },
  },
} as const;

/**
 * A theme card is one scheme. The project separately picks a light card and a
 * dark card, so cards such as Alucard and Dracula can be mixed freely.
 *
 * Palette sources:
 * - Dracula / Alucard: https://github.com/dracula/dracula-theme
 * - Catppuccin:        https://github.com/catppuccin/catppuccin
 * - Solarized:         https://github.com/altercation/solarized
 *
 * Catppuccin's Squirrel port was used to confirm the four flavours, but the
 * values here come from the official palette so the Trime tokens stay
 * consistent across platforms.
 */
function themeCard(
  id: string,
  name: string,
  family: string,
  appearance: "light" | "dark",
  tokens: Record<string, string>,
): ThemeCardPreset {
  return {
    kind: "theme-card",
    id,
    name,
    version: 1,
    builtin: true,
    family,
    appearance,
    tokens,
    states: {
      pressed: { surface: tokens.primary, text: tokens.onPrimary },
    },
  };
}

export const THEME_CARDS: ThemeCardPreset[] = [
  themeCard("dracula", "Dracula", "Dracula", "dark", {
    bg: "#282a36", surface: "#44475a", surfaceAlt: "#343746", border: "#6272a4",
    text: "#f8f8f2", textMuted: "#b8b8c8", primary: "#bd93f9", onPrimary: "#282a36",
    accent: "#ff79c6", danger: "#ff5555", success: "#50fa7b", warning: "#f1fa8c",
  }),
  themeCard("alucard", "Alucard", "Dracula", "light", {
    bg: "#fffbeb", surface: "#f5eedd", surfaceAlt: "#cfcfde", border: "#d8d0bc",
    text: "#1f1f1f", textMuted: "#6c664b", primary: "#644ac9", onPrimary: "#fffbeb",
    accent: "#a3144d", danger: "#cb3a2a", success: "#14710a", warning: "#846e15",
  }),
  themeCard("catppuccin-latte", "Catppuccin Latte", "Catppuccin", "light", {
    bg: "#dce0e8", surface: "#eff1f5", surfaceAlt: "#ccd0da", border: "#acb0be",
    text: "#4c4f69", textMuted: "#6c6f85", primary: "#8839ef", onPrimary: "#dce0e8",
    accent: "#ea76cb", danger: "#d20f39", success: "#40a02b", warning: "#df8e1d",
  }),
  themeCard("catppuccin-frappe", "Catppuccin Frappé", "Catppuccin", "dark", {
    bg: "#232634", surface: "#303446", surfaceAlt: "#414559", border: "#626880",
    text: "#c6d0f5", textMuted: "#a5adce", primary: "#ca9ee6", onPrimary: "#232634",
    accent: "#f4b8e4", danger: "#e78284", success: "#a6d189", warning: "#e5c890",
  }),
  themeCard("catppuccin-macchiato", "Catppuccin Macchiato", "Catppuccin", "dark", {
    bg: "#181926", surface: "#24273a", surfaceAlt: "#363a4f", border: "#5b6078",
    text: "#cad3f5", textMuted: "#a5adcb", primary: "#c6a0f6", onPrimary: "#181926",
    accent: "#f5bde6", danger: "#ed8796", success: "#a6da95", warning: "#eed49f",
  }),
  themeCard("catppuccin-mocha", "Catppuccin Mocha", "Catppuccin", "dark", {
    bg: "#11111b", surface: "#1e1e2e", surfaceAlt: "#313244", border: "#585b70",
    text: "#cdd6f4", textMuted: "#a6adc8", primary: "#cba6f7", onPrimary: "#11111b",
    accent: "#f5c2e7", danger: "#f38ba8", success: "#a6e3a1", warning: "#f9e2af",
  }),
  themeCard("solarized-light", "Solarized Light", "Solarized", "light", {
    bg: "#fdf6e3", surface: "#eee8d5", surfaceAlt: "#e3dcc8", border: "#d5cdb6",
    text: "#657b83", textMuted: "#93a1a1", primary: "#268bd2", onPrimary: "#fdf6e3",
    accent: "#d33682", danger: "#dc322f", success: "#859900", warning: "#b58900",
  }),
  themeCard("solarized-dark", "Solarized Dark", "Solarized", "dark", {
    bg: "#002b36", surface: "#073642", surfaceAlt: "#0e3f4b", border: "#586e75",
    text: "#93a1a1", textMuted: "#839496", primary: "#268bd2", onPrimary: "#002b36",
    accent: "#d33682", danger: "#dc322f", success: "#859900", warning: "#b58900",
  }),
  themeCard("material-light", "Material Light", "Material", "light", {
    bg: "#fafafa", surface: "#ffffff", surfaceAlt: "#f0f0f0", border: "#d0d0d0",
    text: "#212121", textMuted: "#757575", primary: "#1976d2", onPrimary: "#ffffff",
    accent: "#e91e63", danger: "#d32f2f", success: "#388e3c", warning: "#f57c00",
  }),
  themeCard("material-dark", "Material Dark", "Material", "dark", {
    bg: "#121212", surface: "#1e1e1e", surfaceAlt: "#2a2a2a", border: "#3d3d3d",
    text: "#e8e8e8", textMuted: "#a0a0a0", primary: "#90caf9", onPrimary: "#0d47a1",
    accent: "#f48fb1", danger: "#ef9a9a", success: "#a5d6a7", warning: "#ffcc80",
  }),
  themeCard("nord-light", "Nord Light", "Nord", "light", {
    bg: "#eceff4", surface: "#ffffff", surfaceAlt: "#e5e9f0", border: "#d8dee9",
    text: "#2e3440", textMuted: "#4c566a", primary: "#5e81ac", onPrimary: "#eceff4",
    accent: "#b48ead", danger: "#bf616a", success: "#a3be8c", warning: "#ebcb8b",
  }),
  themeCard("nord-dark", "Nord Dark", "Nord", "dark", {
    bg: "#2e3440", surface: "#3b4252", surfaceAlt: "#434c5e", border: "#4c566a",
    text: "#eceff4", textMuted: "#d8dee9", primary: "#88c0d0", onPrimary: "#2e3440",
    accent: "#b48ead", danger: "#bf616a", success: "#a3be8c", warning: "#ebcb8b",
  }),
];

export const MACROS: MacroPreset[] = [
  { kind: "macro", id: "pair-paren", name: "()", version: 1, builtin: true, steps: [{ type: "text", value: "()" }, { type: "key", value: "Left" }] },
  { kind: "macro", id: "pair-bracket", name: "[]", version: 1, builtin: true, steps: [{ type: "text", value: "[]" }, { type: "key", value: "Left" }] },
  { kind: "macro", id: "pair-brace", name: "{}", version: 1, builtin: true, steps: [{ type: "text", value: "{}" }, { type: "key", value: "Left" }] },
  { kind: "macro", id: "pair-quote", name: "“”", version: 1, builtin: true, steps: [{ type: "text", value: "“”" }, { type: "key", value: "Left" }] },
  { kind: "macro", id: "pair-corner", name: "「」", version: 1, builtin: true, steps: [{ type: "text", value: "「」" }, { type: "key", value: "Left" }] },
  { kind: "macro", id: "pair-angle", name: "《》", version: 1, builtin: true, steps: [{ type: "text", value: "《》" }, { type: "key", value: "Left" }] },
  { kind: "macro", id: "select-all", name: "Select all", version: 1, builtin: true, steps: [{ type: "key", value: "Control+a" }] },
  { kind: "macro", id: "cut", name: "Cut", version: 1, builtin: true, steps: [{ type: "key", value: "Control+x" }] },
  { kind: "macro", id: "copy", name: "Copy", version: 1, builtin: true, steps: [{ type: "key", value: "Control+c" }] },
  { kind: "macro", id: "paste", name: "Paste", version: 1, builtin: true, steps: [{ type: "key", value: "Control+v" }] },
  { kind: "macro", id: "undo", name: "Undo", version: 1, builtin: true, steps: [{ type: "key", value: "Control+z" }] },
  { kind: "macro", id: "line-start", name: "Line start", version: 1, builtin: true, steps: [{ type: "key", value: "Home" }] },
  { kind: "macro", id: "line-end", name: "Line end", version: 1, builtin: true, steps: [{ type: "key", value: "End" }] },
];

const ch = (value: string): ActionRef => ({ kind: "char", value });
const key = (value: string): ActionRef => ({ kind: "key", value });
const macro = (id: string): ActionRef => ({ kind: "macro", id });
const page = (id: string): ActionRef => ({ kind: "page", id });

function k(click: ActionRef, style = "default", width = 10, extra: Partial<KeySlot> = {}): KeySlot {
  return { click, style, width, ...extra };
}

function spacer(width: number): KeySlot {
  return { kind: "placeholder", width };
}

const mainRows: LayoutRow[] = [
  { height: 52, keys: "qwertyuiop".split("").map((c) => k(ch(c), "default", 10, {
    label: c.toUpperCase(),
    ...(c === "o" ? { long_click: macro("pair-paren"), label_symbol: "()" } : {}),
  })) },
  { height: 52, keys: [spacer(5), ..."asdfghjkl".split("").map((c) => k(ch(c), "default", 10, {
    label: c.toUpperCase(),
    ...(c === "h" ? { long_click: macro("pair-bracket"), label_symbol: "[]" } : {}),
    ...(c === "j" ? { long_click: macro("pair-brace"), label_symbol: "{}" } : {}),
  })), spacer(5)] },
  { height: 52, keys: [k(key("Shift_L"), "modifier", 15, { label: "Shift" }), ..."zxcvbnm".split("").map((c) => k(ch(c), "default", 10, { label: c.toUpperCase() })), k(key("BackSpace"), "modifier", 15, { label: "⌫" })] },
  { height: 52, keys: [
    k(key("Mode_switch"), "modifier", 15, { label: "中/英" }),
    k(page("symbols"), "modifier", 10, { label: "符号" }),
    k(ch("，"), "default", 10, { label: "，", long_click: ch("、"), popup: ["，", "、", "；", "："] }),
    k(key("space"), "space", 30, { label: "" }),
    k(ch("。"), "default", 10, { label: "。", long_click: ch("？"), popup: ["。", "！", "？", "…"] }),
    k(ch("/"), "default", 10, { label: "/" }),
    k(key("Return"), "enter", 15, { label: "Enter" }),
  ] },
];

const numberRows: LayoutRow[] = [
  { height: 48, keys: [k(page("main"), "modifier", 15, { label: "ABC" }), ..."1234567890".split("").map((c) => k(ch(c), "default", 8, { label: c })), k(key("BackSpace"), "modifier", 15, { label: "⌫" })] },
  { height: 48, keys: ["-", "/", ":", ";", "(", ")", "$", "&", "@", "\"", ".", ","].map((c) => k(ch(c), "default", 10, { label: c })) },
  { height: 48, keys: [k(page("symbols"), "modifier", 20, { label: "符号" }), k(key("space"), "space", 40, { label: "" }), k(key("Return"), "enter", 40, { label: "Enter" })] },
].map((row) => ({ ...row, keys: row.keys.map((item) => ({ ...item, width: 100 / row.keys.length })) }));

const symbolChars = "，。？！：；、…—“”‘’（）【】《》〈〉「」『』〔〕·～￥$€£©®™°′″≈≠≤≥±×÷".split("");
const symbolRows: LayoutRow[] = [
  { height: 48, keys: [k(page("main"), "modifier", 15, { label: "ABC" }), ...symbolChars.slice(0, 15).map((c) => k(ch(c), "default", 5.6, { label: c }))] },
  { height: 48, keys: symbolChars.slice(15, 30).map((c) => k(ch(c), "default", 100 / 15, { label: c })) },
  { height: 48, keys: [k(page("number"), "modifier", 20, { label: "123" }), k(key("space"), "space", 40, { label: "" }), k(key("Return"), "enter", 40, { label: "Enter" })] },
];

/**
 * 18-key pinyin layout: 26 letters folded into 18 keys, following the shape
 * used by the qwerty_18 keyboards in this project.
 */
const combine = (first: string, second: string, width: number): KeySlot =>
  k(ch(first), "default", width, {
    label: `${first.toUpperCase()}/${second.toUpperCase()}`,
    long_click: ch(second),
  });

const eighteenRows: LayoutRow[] = [
  { height: 52, keys: [
    k(ch("q"), "default", 100 / 7, { label: "Q" }),
    combine("w", "e", 100 / 7),
    combine("r", "t", 100 / 7),
    k(ch("y"), "default", 100 / 7, { label: "Y" }),
    k(ch("u"), "default", 100 / 7, { label: "U" }),
    combine("i", "o", 100 / 7),
    k(ch("p"), "default", 100 / 7, { label: "P" }),
  ] },
  { height: 52, keys: [
    k(ch("a"), "default", 7.7, { label: "A" }),
    combine("s", "d", 7.7),
    combine("f", "g", 7.7),
    k(ch("h"), "default", 7.7, { label: "H" }),
    combine("j", "k", 7.7),
    k(ch("l"), "default", 7.7, { label: "L" }),
    k(ch("z"), "default", 7.7, { label: "Z" }),
    combine("x", "c", 7.7),
    k(ch("v"), "default", 7.7, { label: "V" }),
    combine("b", "n", 7.7),
    k(ch("m"), "default", 7.7, { label: "M" }),
    k(key("BackSpace"), "modifier", 15.3, { label: "⌫" }),
  ] },
  { height: 50, keys: [
    k(page("number"), "modifier", 12, { label: "123" }),
    k(page("symbols"), "modifier", 10, { label: "简" }),
    k(key("Mode_switch"), "modifier", 10, { label: "中" }),
    k(ch("，"), "default", 8, { label: "，", popup: ["，", "、", "；", "："] }),
    k(key("space"), "space", 28, { label: "" }),
    k(ch("。"), "default", 8, { label: "。", popup: ["。", "！", "？", "…"] }),
    k(ch("/"), "default", 8, { label: "/" }),
    k(key("Return"), "enter", 16, { label: "Enter" }),
  ] },
];

/** 14-key pinyin layout: two letters per key. */
const fourteenRows: LayoutRow[] = [
  { height: 54, keys: [
    combine("q", "w", 20),
    combine("e", "r", 20),
    combine("t", "y", 20),
    combine("u", "i", 20),
    combine("o", "p", 20),
  ] },
  { height: 54, keys: [
    combine("a", "s", 20),
    combine("d", "f", 20),
    combine("g", "h", 20),
    combine("j", "k", 20),
    k(ch("l"), "default", 20, { label: "L" }),
  ] },
  { height: 54, keys: [
    spacer(5),
    combine("z", "x", 20),
    combine("c", "v", 20),
    combine("b", "n", 20),
    k(ch("m"), "default", 20, { label: "M" }),
    k(key("BackSpace"), "modifier", 15, { label: "⌫" }),
  ] },
  { height: 50, keys: [
    k(page("number"), "modifier", 12, { label: "123" }),
    k(page("symbols"), "modifier", 8, { label: "简" }),
    k(key("Mode_switch"), "modifier", 8, { label: "中" }),
    k(ch("，"), "default", 7, { label: "，", long_click: ch("、"), popup: ["，", "、", "；", "："] }),
    k(key("space"), "space", 40, { label: "" }),
    k(ch("。"), "default", 7, { label: "。", long_click: ch("？"), popup: ["。", "！", "？", "…"] }),
    k(ch("/"), "default", 6, { label: "/" }),
    k(key("Return"), "enter", 12, { label: "Enter" }),
  ] },
];

/** 9-key T9 layout: letters are grouped by phone keypad. */
const nineRows: LayoutRow[] = [
  { height: 54, keys: [
    k(ch("a"), "default", 25, { label: "ABC", long_click: ch("2") }),
    k(ch("d"), "default", 25, { label: "DEF", long_click: ch("3") }),
    k(ch("g"), "default", 25, { label: "GHI", long_click: ch("4") }),
    k(key("BackSpace"), "modifier", 25, { label: "⌫" }),
  ] },
  { height: 54, keys: [
    k(ch("j"), "default", 25, { label: "JKL", long_click: ch("5") }),
    k(ch("m"), "default", 25, { label: "MNO", long_click: ch("6") }),
    k(ch("p"), "default", 25, { label: "PQRS", long_click: ch("7") }),
    k(key("Mode_switch"), "modifier", 25, { label: "中" }),
  ] },
  { height: 54, keys: [
    k(ch("t"), "default", 25, { label: "TUV", long_click: ch("8") }),
    k(ch("w"), "default", 25, { label: "WXYZ", long_click: ch("9") }),
    k(ch("，"), "default", 25, { label: "，", popup: ["，", "、", "；", "："] }),
    k(ch("。"), "default", 25, { label: "。", popup: ["。", "！", "？", "…"] }),
  ] },
  { height: 50, keys: [
    k(page("number"), "modifier", 20, { label: "123" }),
    k(key("space"), "space", 40, { label: "" }),
    k(page("symbols"), "modifier", 20, { label: "/" }),
    k(key("Return"), "enter", 20, { label: "Enter" }),
  ] },
];

export const LAYOUTS: LayoutPreset[] = [
  { kind: "layout", id: "qwerty26", name: "26 键", version: 1, builtin: true, pageRole: "main", rows: mainRows },
  { kind: "layout", id: "qwerty18", name: "18 键", version: 1, builtin: true, pageRole: "main", rows: eighteenRows },
  { kind: "layout", id: "qwerty14", name: "14 键", version: 1, builtin: true, pageRole: "main", rows: fourteenRows },
  { kind: "layout", id: "qwerty9", name: "9 键", version: 1, builtin: true, pageRole: "main", rows: nineRows },
  { kind: "layout", id: "number", name: "数字", version: 1, builtin: true, pageRole: "number", rows: numberRows },
  { kind: "layout", id: "symbols", name: "符号", version: 1, builtin: true, pageRole: "symbols", rows: symbolRows },
];


const EMOJI = Array.from("😀😃😄😁😆😅🤣😂🙂🙃😉😊😇🥰😍🤩😘😗😚😙😋😛😜🤪😝🤑🤗🤭🤔🤐😐😑😶😏😒🙄😬😌😔😪😴😷🤒🤕🤢🤮🤧🥵🥶🥴😵🤯🤠🥳😎🤓🧐😕😟🙁☹😮😯😲😳🥺😦😧😨😰😥😢😭😱😖😣😞😓😩😫🥱😤😡😠🤬😈👿💀💩🤡👹👺👻👽👾🤖😺😸😹😻😼😽🙀😿😾");

const KAOMOJI = [
  "^_^", "^ω^", "^o^", "T_T", "QwQ", ">_<", "=w=", "(^_^)", "(￣▽￣)", "(´▽｀)",
  "(・ω・)", "(｡･ω･｡)", "(╯°□°）╯", "(ノ°Д°)ノ", "(づ｡◕‿‿◕｡)づ", "(๑•̀ㅂ•́)و✧",
];

const LIQUID_SYMBOLS = Array.from("，。？！：；、…—“”‘’（）【】《》〈〉「」『』〔〕·～￥$€£©®™°′″≈≠≤≥±×÷√∞∠⊥∥∈∉⊂⊃∪∩○●◇◆□■△▲▽▼☆★♠♥♦♣♪♫¶§→←↑↓");

export const DEFAULT_TOOLBAR: ToolbarConfig = {
  buttonSpacing: 6,
  backStyle: "ic@arrow-left",
  primaryButton: {
    action: "menu_keyboard",
    longPressAction: "Settings",
    icon: "ic@dots_horizontal",
    size: [44, 44],
    background: { type: "circle", normal: "0x00000000", highlight: "hilited_candidate_back_color", verticalInset: 4, horizontalInset: 4 },
    foreground: { style: "ic@dots_horizontal", normal: "candidate_text_color", padding: 10 },
  },
  buttons: [
    { action: "liquid_keyboard_emoji", icon: "ic@emoticon", size: [44, 44] },
    { action: "liquid_keyboard_kaomoji", icon: "ic@emoticon", size: [44, 44] },
    { action: "liquid_keyboard_clipboard", icon: "ic@clipboard", size: [44, 44] },
    { action: "VOICE_ASSIST", icon: "ic@microphone", size: [44, 44] },
    { action: "Mode_switch", icon: "ic@ascii", size: [44, 44] },
    { action: "Hide", icon: "ic@keyboard_close", size: [44, 44] },
  ],
};

export const DEFAULT_LIQUID: LiquidConfig = {
  singleWidth: 60,
  marginX: 3,
  keyHeight: 40,
  row: 6,
  verticalGap: 1,
  fixedBar: { position: "right", keys: ["liquid_keyboard_exit", "space1", "BackSpace", "Return1"] },
  tabs: [
    { id: "emoji", name: "表情", type: "SINGLE", keys: EMOJI },
    { id: "kaomoji", name: "颜文字", type: "SINGLE", keys: KAOMOJI },
    { id: "history", name: "历史", type: "HISTORY" },
    { id: "symbols", name: "符号", type: "SINGLE", keys: LIQUID_SYMBOLS },
  ],
};

export const DEFAULT_WINDOW: WindowConfig = {
  verticalInset: 4,
  horizontalInset: 8,
  itemVerticalPadding: 4,
  itemHorizontalPadding: 8,
  minWidth: 0,
  cornerRadius: 8,
  border: 0,
  shadow: 4,
  alpha: 1,
  labelFontSize: 18,
  textFontSize: 20,
  commentFontSize: 14,
};

export const DEFAULT_PREEDIT: PreeditConfig = {
  horizontalPadding: 10,
  topStartRadius: 12,
  topEndRadius: 12,
  alpha: 1,
  fontSize: 18,
};

export const DEFAULT_TOOLBAR_ACTIONS = [
  "menu_keyboard", "Settings", "Mode_switch", "Hide", "VOICE_ASSIST", "Clipboard",
  "liquid_keyboard_emoji", "liquid_keyboard_kaomoji", "liquid_keyboard_clipboard", "liquid_keyboard_switch",
  "Keyboard_default", "Keyboard_main", "select_schema", "toggle_ascii_mode",
];

export const DEFAULT_TOOLBAR_ICONS = [
  "ic@dots_horizontal", "ic@arrow-left", "ic@emoticon", "ic@clipboard", "ic@microphone",
  "ic@ascii", "ic@keyboard_close", "ic@keyboard", "ic@settings", "ic@theme", "ic@schema",
  "ic@undo", "ic@redo", "ic@paste", "ic@search", "ic@voice", "ic@one_hand", "ic@menu",
];

export const BUILTIN_PRESETS: PresetLibraries = {
  themeCards: THEME_CARDS,
  layouts: LAYOUTS,
  macros: MACROS,
};
