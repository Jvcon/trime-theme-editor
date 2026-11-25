export type Variant = "light" | "dark";

export type ThemeCardPreset = {
  kind: "theme-card";
  id: string;
  name: string;
  version: number;
  builtin: boolean;
  variants: Record<Variant, {
    tokens: Record<string, string>;
    states: Record<string, Record<string, string>>;
  }>;
};

export type KeyStyle = {
  id: string;
  name: string;
  background: string;
  text: string;
  symbol?: string;
  border?: string;
  pressed?: Partial<Record<"background" | "text" | "symbol" | "border", string>>;
  disabled?: Partial<Record<"background" | "text" | "symbol" | "border", string>>;
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
  id?: string;
  label?: string;
  label_symbol?: string;
  hint?: string;
  style: string;
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
};

export type LayoutRow = {
  height?: number;
  keys: KeySlot[];
};

export type LayoutPreset = {
  kind: "layout";
  id: string;
  name: string;
  version: number;
  builtin: boolean;
  pageRole: "main" | "number" | "symbols";
  rows: LayoutRow[];
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
  /** Per-device overrides. Phase 1 only stores them; compilation uses the shared values. */
  metrics?: Partial<ProjectMetrics>;
  mainLayoutId?: string;
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
 * Version 2 project document. This is both the editor document and the
 * exported bundle: it embeds the theme card, layouts, and macros that the
 * project actually uses instead of referencing a built-in library.
 */
export type ProjectBundle = {
  format: "trime-theme-bundle";
  schemaVersion: 2;
  id: string;
  /** Storage-only timestamp. Stripped from exported bundles. */
  updatedAt?: number;
  meta: ProjectMeta;
  devices: DeviceProfile[];
  schemaBindings: SchemaBinding[];
  mainLayoutId: string;
  /** Layout ids composed as switchable pages, besides the main layout. */
  pageIds: string[];
  theme: ThemeCardPreset;
  variant: Variant;
  keyStyles: Record<string, KeyStyle>;
  /** Embedded main layout plus every page referenced by pageIds. */
  layouts: LayoutPreset[];
  /** Embedded macros selected for this project. */
  macros: MacroPreset[];
  metrics?: ProjectMetrics;
  chrome?: ChromeConfig;
  /** Imported preset_keys that cannot be represented as a macro (commands/selects). */
  customPresetKeys?: Record<string, Record<string, unknown>>;
  /** Unmodelled Trime fields preserved verbatim. */
  passthrough?: Record<string, unknown>;
};

/** Catalog used only for pickers. It is never exported and never compiled. */
export type PresetLibraries = {
  themeCards: ThemeCardPreset[];
  layouts: LayoutPreset[];
  macros: MacroPreset[];
};
