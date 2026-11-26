export type Variant = "light" | "dark";

/** Colors for a single scheme. A theme card is one scheme, not a light/dark pair. */
export type ThemeColorSet = {
  tokens: Record<string, string>;
  states: Record<string, Record<string, string>>;
};

export type ThemeCardPreset = ThemeColorSet & {
  kind: "theme-card";
  id: string;
  name: string;
  version: number;
  builtin: boolean;
  /** Authoring hint only. Never rendered on the card itself. */
  appearance?: Variant;
  /** Picker group, e.g. Dracula / Catppuccin / Solarized. */
  family?: string;
};

/** The project picks one scheme for light mode and one for dark mode. */
export type ThemeSelection = {
  light: ThemeCardPreset;
  dark: ThemeCardPreset;
};

export type KeyStyle = {
  id: string;
  name: string;
  background: string;
  text: string;
  symbol?: string;
  border?: string;
  pressed?: Partial<Record<"background" | "text" | "symbol" | "border", string>>;
};

export type MacroStep =
  | { type: "text"; value: string }
  | { type: "key"; value: string }
  | { type: "action"; value: string };

export type MacroPreset = {
  kind: "macro";
  id: string;
  name: string;
  version: number;
  builtin: boolean;
  steps: MacroStep[];
  /** Original preset_keys token, preserving imported command names. */
  token?: string;
};

export type ActionRef =
  | { kind: "char"; value: string }
  | { kind: "key"; value: string }
  | { kind: "macro"; id: string }
  | { kind: "page"; id: string }
  | { kind: "toggle"; value: string }
  | { kind: "command"; value: string; option?: string }
  | { kind: "preset"; value: string }
  | { kind: "text"; value: string };

export type KeySlot = {
  /**
   * `placeholder` reserves horizontal space only: Trime creates no Key for it,
   * so it is never drawn or pressed. Omitted means a normal key.
   */
  kind?: "key" | "placeholder";
  id?: string;
  label?: string;
  label_symbol?: string;
  hint?: string;
  /** Required for normal keys; unused by placeholders. */
  style?: string;
  width: number;
  height?: number;
  click?: ActionRef;
  long_click?: ActionRef;
  double_click?: ActionRef;
  swipe_up?: ActionRef;
  swipe_down?: ActionRef;
  swipe_left?: ActionRef;
  swipe_right?: ActionRef;
  popup?: string[];
  key_back_color?: string;
  key_text_color?: string;
  key_symbol_color?: string;
  key_border_color?: string;
  hilited_key_back_color?: string;
  hilited_key_text_color?: string;
  hilited_key_symbol_color?: string;
  hilited_key_border_color?: string;
  /** Unmodelled key fields preserved verbatim. */
  passthrough?: Record<string, unknown>;
};

export type LayoutRow = {
  height?: number;
  keys: KeySlot[];
};

export type LayoutRole = "letters" | "number" | "symbols";

export type LayoutPreset = {
  kind: "layout";
  id: string;
  name: string;
  version: number;
  builtin: boolean;
  /** Content hint used by pickers and labels. Main/default is a project pointer, not a role. */
  role?: LayoutRole;
  asciiMode?: number;
  rows: LayoutRow[];
  /**
   * Landscape variant of this layout. Optional and additive: when a landscape
   * device binds to this layout, compilation uses the variant. Missing means
   * the landscape device falls back to this layout with a warning.
   */
  landscapeId?: string;
  /** Unmodelled keyboard fields preserved verbatim. */
  passthrough?: Record<string, unknown>;
};

export type ProjectMeta = {
  name: string;
  author: string;
  description?: string;
  configVersion: string;
};

export type DeviceKind = "phone" | "fold" | "tablet";
export type Orientation = "portrait" | "landscape";
export type FoldState = "folded" | "unfolded";

export type DeviceProfile = {
  id: string;
  kind: DeviceKind;
  orientation: Orientation;
  foldState?: FoldState;
  /** Per-device metric overrides merged over the project metrics. */
  metrics?: Partial<ProjectMetrics>;
  /** Explicit entry layout for this device. Omitted means inherit the project default. */
  layoutId?: string;
};

export type SchemaBinding = {
  schemaId: string;
  layoutId: string;
  /** Output keyboard alias. Defaults to the layout id when omitted. */
  alias?: string;
};

export type ProjectMetrics = {
  keyWidth?: number;
  keyHeight?: number;
  keyboardHeight?: number;
  horizontalGap?: number;
  verticalGap?: number;
  candidateViewHeight?: number;
  candidateTextSize?: number;
  commentTextSize?: number;
  keyTextSize?: number;
  popupWidth?: number;
  popupHeight?: number;
  popupKeyHeight?: number;
  popupTextSize?: number;
  popupBottomMargin?: number;
};

export type ToolbarButton = {
  action: string;
  longPressAction?: string;
  label?: string;
  icon?: string;
  size?: [number, number];
  background?: {
    type?: string;
    normal?: string;
    highlight?: string;
    verticalInset?: number;
    horizontalInset?: number;
  };
  foreground?: {
    style?: string;
    normal?: string;
    padding?: number;
  };
  /** Unmodelled button fields (including nested background/foreground) preserved verbatim. */
  passthrough?: Record<string, unknown>;
};

export type ToolbarConfig = {
  buttonSpacing: number;
  backStyle: string;
  primaryButton: ToolbarButton;
  buttons: ToolbarButton[];
};

export type LiquidTabType = "SINGLE" | "HISTORY" | "TABS" | "SYMBOL";

export type LiquidTab = {
  id: string;
  name: string;
  type: LiquidTabType;
  keys?: string[];
  symbols?: Array<{ label: string; command: string }>;
  /** Unmodelled tab fields preserved verbatim. */
  passthrough?: Record<string, unknown>;
};

export type LiquidConfig = {
  singleWidth: number;
  marginX: number;
  keyHeight?: number;
  row?: number;
  verticalGap?: number;
  fixedBar: {
    position: "left" | "right" | "top" | "bottom";
    keys: string[];
  };
  tabs: LiquidTab[];
};

export type WindowConfig = {
  verticalInset: number;
  horizontalInset: number;
  itemVerticalPadding: number;
  itemHorizontalPadding: number;
  minWidth: number;
  cornerRadius: number;
  border: number;
  shadow: number;
  alpha: number;
  labelFontSize: number;
  textFontSize: number;
  commentFontSize: number;
};

export type PreeditConfig = {
  horizontalPadding: number;
  topStartRadius: number;
  topEndRadius: number;
  alpha: number;
  fontSize: number;
};

export type ChromeConfig = {
  toolbar: ToolbarConfig;
  liquid: LiquidConfig;
  window: WindowConfig;
  preedit: PreeditConfig;
};

export type ChromePatch = {
  toolbar?: ToolbarConfig;
  liquid?: LiquidConfig;
  window?: Partial<WindowConfig>;
  preedit?: Partial<PreeditConfig>;
};

/**
 * Version 4 project document. This is both the editor document and the
 * exported bundle: it embeds the selected light/dark theme cards, layouts, and
 * macros that the project actually uses instead of referencing a built-in
 * library.
 *
 * A layout group is the single inventory of keyboards. Its order is authoring
 * UI only; Trime itself has no page order. `defaultLayoutId` is an optional
 * pointer into the group used by devices that do not bind a layout themselves.
 */
export type ProjectBundle = {
  format: "trime-theme-bundle";
  schemaVersion: 4;
  id: string;
  /** Storage-only timestamp. Stripped from exported bundles. */
  updatedAt?: number;
  meta: ProjectMeta;
  devices: DeviceProfile[];
  schemaBindings: SchemaBinding[];
  /** Optional project default entry. When set it must belong to layoutGroupIds. */
  defaultLayoutId?: string;
  /** Ordered layout group (UI order only). Includes defaultLayoutId when present. */
  layoutGroupIds: string[];
  theme: ThemeSelection;
  /** Preview direction. The compiled light/dark schemes always use theme.light/theme.dark. */
  variant: Variant;
  /** Project-scoped custom theme cards created by copy / new / edit. */
  customThemeCards?: ThemeCardPreset[];
  keyStyles: Record<string, KeyStyle>;
  /** Embedded layout group members plus their landscape variants. */
  layouts: LayoutPreset[];
  /** Embedded macros selected for this project. */
  macros: MacroPreset[];
  metrics?: ProjectMetrics;
  chrome?: ChromeConfig;
  fallbackColors?: Record<string, string>;
  /** Imported preset_keys that cannot be represented as a macro (commands/selects). */
  customPresetKeys?: Record<string, Record<string, unknown>>;
  /**
   * Unmodelled Trime fields preserved verbatim, grouped by section:
   * top, style, window, preedit, tool_bar, liquid_keyboard,
   * preset_color_schemes, preset_keyboards.
   */
  passthrough?: Record<string, unknown>;
};

/** Catalog used only for pickers. It is never exported and never compiled. */
export type PresetLibraries = {
  themeCards: ThemeCardPreset[];
  layouts: LayoutPreset[];
  macros: MacroPreset[];
};
