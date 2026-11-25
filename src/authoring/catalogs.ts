/**
 * Read-only catalogs mirrored from the official Trime/Android keycodes.
 * These are not presets: users pick from them, they cannot edit them.
 */

export type KeycodeGroup = {
  id: string;
  label: string;
  items: string[];
};

export const KEYCODES: KeycodeGroup[] = [
  {
    id: "editing",
    label: "Editing",
    items: ["BackSpace", "Return", "space", "Tab", "Escape", "Delete", "Insert", "Clear"],
  },
  {
    id: "navigation",
    label: "Navigation",
    items: ["Left", "Right", "Up", "Down", "Home", "End", "Page_Up", "Page_Down", "Move_Home", "Move_End"],
  },
  {
    id: "modifiers",
    label: "Modifiers",
    items: ["Shift_L", "Shift_R", "Control_L", "Control_R", "Alt_L", "Alt_R", "Meta_L", "Meta_R", "Caps_Lock"],
  },
  {
    id: "function",
    label: "Function",
    items: ["F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8", "F9", "F10", "F11", "F12"],
  },
  {
    id: "keypad",
    label: "Keypad",
    items: ["KP_0", "KP_1", "KP_2", "KP_3", "KP_4", "KP_5", "KP_6", "KP_7", "KP_8", "KP_9", "KP_Enter", "KP_Plus", "KP_Minus", "KP_Multiply", "KP_Divide", "KP_Dot"],
  },
  {
    id: "trime",
    label: "Trime / IME",
    items: ["Mode_switch", "Eisu_toggle", "Henkan", "Muhenkan", "Zenkaku_Hankaku", "Hangul", "Hangul_Hanja"],
  },
  {
    id: "combos",
    label: "Combos",
    items: ["Control+a", "Control+c", "Control+v", "Control+x", "Control+z", "Control+y", "Control+s", "Control+f", "Shift+Left", "Shift+Right", "Shift+Home", "Shift+End"],
  },
];

export type CharacterSet = {
  id: string;
  label: string;
  description: string;
  items: string[];
};

const asciiPunct = "`~!@#$%^&*()-_=+[]{}|;:'\",.<>/?".split("");
const cnPunct = "，。？！：；、…—“”‘’（）【】《》〈〉「」『』〔〕·～".split("");
const quotes = ["“”", "‘’", "「」", "『』", "《》", "〈〉", "（）", "【】", "〔〕", "()", "[]", "{}"];
const math = "±×÷≈≠≤≥∞√∑∏∫∂∆∇∈∉⊂⊃∪∩∧∨¬∀∃∅°′″µ".split("");
const currency = "￥$€£₩₹₽¢¥".split("");
const fullwidth = "ＡＢＣＤＥＦＧＨＩＪＫＬＭＮＯＰＱＲＳＴＵＶＷＸＹＺａｂｃｄｅｆｇｈｉｊｋｌｍｎｏｐｑｒｓｔｕｖｗｘｙｚ１２３４５６７８９０".split("");
const emoji = "😀😁😂🤣😃😄😅😆😉😊😋😎😍😘🥰😗😙😚🙂🤗🤔😐😑😶🙄😏😣😥😮🤐😯😪😫🥱😴😌😛😜😝🤤😒😓😔😕🙃🤑😲🙁😖😞😟😤😢😭😦😧😨😩🤯😬😰😱🥶😳🤪😵😡😠🤬😷🤒🤕🤢🤮🥴😇🤠🥳🥺🤡🤫🤭🧐🤓😈👻💀👽🤖💩😺😸😹😻😼😽🙀😿😾".split("");

export const CHARACTER_SETS: CharacterSet[] = [
  { id: "letters", label: "Letters", description: "a-z / A-Z", items: [..."abcdefghijklmnopqrstuvwxyz", ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"] },
  { id: "digits", label: "Digits", description: "0-9", items: "0123456789".split("") },
  { id: "ascii", label: "ASCII punctuation", description: "programming and latin punctuation", items: asciiPunct },
  { id: "cn", label: "中文标点", description: "Chinese punctuation and brackets", items: cnPunct },
  { id: "pairs", label: "成对符号", description: "paired brackets used by macro presets", items: quotes },
  { id: "math", label: "Math", description: "math operators and symbols", items: math },
  { id: "currency", label: "Currency", description: "currency signs", items: currency },
  { id: "fullwidth", label: "Fullwidth", description: "fullwidth letters and digits", items: fullwidth },
  { id: "emoji", label: "Emoji", description: "emoji used as committed text", items: emoji },
];

export const TOGGLES: Array<{ value: string; label: string }> = [
  { value: "ascii_mode", label: "ASCII mode" },
  { value: "simplification", label: "Simplification" },
  { value: "traditionalization", label: "Traditionalization" },
  { value: "emoji", label: "Emoji mode" },
];

export const COMMANDS: Array<{ value: string; label: string; option?: string }> = [
  { value: "liquid_keyboard", label: "Liquid keyboard" },
  { value: "clipboard", label: "Clipboard", option: "clipboard" },
  { value: "theme", label: "Theme switcher" },
  { value: "schema", label: "Schema switcher" },
  { value: "ime_options", label: "IME options" },
];
