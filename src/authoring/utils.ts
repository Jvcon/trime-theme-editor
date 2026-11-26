import { BUILTIN_PRESETS, DEFAULT_LIQUID, DEFAULT_PREEDIT, DEFAULT_TOOLBAR, DEFAULT_WINDOW, KEY_STYLES } from "./presets";
import { LAYOUT_RULES } from "./devicePresets";
import type { ActionRef, ChromeConfig, ChromePatch, KeyStyle, LayoutPreset, LiquidConfig, MacroPreset, PresetLibraries, ProjectBundle, ThemeCardPreset, ThemeSelection } from "./types";

function mergeById<T extends { id: string }>(...groups: T[][]): T[] {
  const seen = new Set<string>();
  const output: T[] = [];
  for (const group of groups) {
    for (const item of group) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      output.push(item);
    }
  }
  return output;
}

/**
 * UI catalog: embedded bundle presets first, then built-ins for the pickers.
 * Compilation never reads this catalog; it only reads the bundle.
 */
export function libraries(bundle: ProjectBundle): PresetLibraries {
  return {
    themeCards: mergeById(
      [bundle.theme.light, bundle.theme.dark],
      bundle.customThemeCards ?? [],
      BUILTIN_PRESETS.themeCards,
    ),
    layouts: mergeById(bundle.layouts, BUILTIN_PRESETS.layouts),
    macros: mergeById(bundle.macros, BUILTIN_PRESETS.macros),
  };
}

export function defaultKeyStyles(): Record<string, KeyStyle> {
  return structuredClone(KEY_STYLES) as unknown as Record<string, KeyStyle>;
}

export function defaultChrome(): ChromeConfig {
  return structuredClone({
    toolbar: DEFAULT_TOOLBAR,
    liquid: DEFAULT_LIQUID,
    window: DEFAULT_WINDOW,
    preedit: DEFAULT_PREEDIT,
  });
}

export function normalizeChrome(input: ChromePatch | undefined): ChromeConfig {
  const base = defaultChrome();
  if (!input) return base;
  return {
    toolbar: {
      ...base.toolbar,
      ...(input.toolbar ?? {}),
      primaryButton: { ...base.toolbar.primaryButton, ...(input.toolbar?.primaryButton ?? {}) },
      buttons: Array.isArray(input.toolbar?.buttons) ? input.toolbar.buttons : base.toolbar.buttons,
    },
    liquid: normalizeLiquid(input.liquid, base.liquid),
    window: { ...base.window, ...(input.window ?? {}) },
    preedit: { ...base.preedit, ...(input.preedit ?? {}) },
  };
}

export function fitRowWidths(row: { keys: Array<{ width: number }> }): void {
  const total = row.keys.reduce((sum, key) => sum + Math.max(0, key.width || 0), 0);
  if (row.keys.length === 0) return;
  if (total <= 0) {
    for (const key of row.keys) key.width = Number((100 / row.keys.length).toFixed(3));
    return;
  }
  for (const key of row.keys) {
    key.width = Number((((key.width || 0) / total) * 100).toFixed(3));
  }
}

export function fitLayoutRows(layout: LayoutPreset): void {
  for (const row of layout.rows) fitRowWidths(row);
}

export function reflowLayoutRows(layout: LayoutPreset, target = 100): void {
  const keys = layout.rows.flatMap((row) => row.keys);
  const height = layout.rows.find((row) => row.height)?.height ?? 52;
  const rows: LayoutPreset["rows"] = [];
  let current = { height, keys: [] as LayoutPreset["rows"][number]["keys"] };
  let used = 0;
  for (const key of keys) {
    const width = Math.max(0.01, key.width || 10);
    if (current.keys.length > 0 && used + width > target + 0.5) {
      fitRowWidths(current);
      rows.push(current);
      current = { height, keys: [] };
      used = 0;
    }
    current.keys.push(key);
    used += width;
  }
  if (current.keys.length > 0) {
    fitRowWidths(current);
    rows.push(current);
  }
  if (rows.length === 0) rows.push({ height, keys: [{ style: "default", width: 100, click: { kind: "char", value: "a" }, label: "A" }] });
  layout.rows = rows;
}

function normalizeLiquid(input: Partial<LiquidConfig> | undefined, base: LiquidConfig): LiquidConfig {
  if (!input) return base;
  const tabs = (Array.isArray(input.tabs) ? input.tabs : base.tabs)
    .filter((tab) => tab && typeof tab.id === "string" && tab.id)
    .map((tab) => ({
      ...tab,
      name: tab.name || tab.id,
      type: (["SINGLE", "HISTORY", "TABS", "SYMBOL"] as const).includes(tab.type) ? tab.type : "SINGLE",
      ...(Array.isArray(tab.keys) ? { keys: tab.keys.map(String) } : {}),
      ...(Array.isArray(tab.symbols) ? { symbols: tab.symbols.map((item) => ({ label: String(item.label ?? ""), command: String(item.command ?? "") })) } : {}),
    }));
  return {
    ...base,
    ...input,
    fixedBar: { ...base.fixedBar, ...(input.fixedBar ?? {}), keys: Array.isArray(input.fixedBar?.keys) ? input.fixedBar.keys.map(String) : base.fixedBar.keys },
    tabs,
  };
}

/** Adds a catalog layout to the bundle without replacing an existing id. */
export function embedLayout(bundle: ProjectBundle, layout: LayoutPreset): LayoutPreset {
  const existing = bundle.layouts.find((item) => item.id === layout.id);
  if (existing) return existing;
  const copy = structuredClone(layout);
  bundle.layouts.push(copy);
  return copy;
}

export function pruneBundleLayouts(bundle: ProjectBundle): void {
  const main = bundle.layouts.find((item) => item.id === bundle.mainLayoutId) ?? bundle.layouts[0];
  if (!main) return;
  bundle.mainLayoutId = main.id;
  const pages = bundle.pageIds
    .map((id) => bundle.layouts.find((item) => item.id === id))
    .filter((item): item is LayoutPreset => item !== undefined && item.id !== main.id);
  bundle.pageIds = pages.map((item) => item.id);

  // Keep layouts referenced by devices and schema bindings, not just the
  // current main layout and its pages. They still need to be compiled into
  // preset_keyboards so alias lookups resolve.
  const keep = new Set<string>([main.id, ...bundle.pageIds]);
  for (const device of bundle.devices ?? []) {
    if (device.mainLayoutId) keep.add(device.mainLayoutId);
  }
  for (const binding of bundle.schemaBindings ?? []) {
    if (binding.layoutId) keep.add(binding.layoutId);
  }
  // Landscape variants are referenced by their base layout, not by pages or
  // devices directly; keep them or every prune would delete the variant.
  for (const layout of bundle.layouts) {
    if (layout.landscapeId && keep.has(layout.id)) keep.add(layout.landscapeId);
  }
  // Never auto-delete layouts the author created or edited. Switching the main
  // layout, changing a device, etc. must not discard the previous custom work.
  // Explicit actions (delete layout / remove page) filter them out before this.
  const authored = new Set<string>(bundle.layouts.filter((item) => !item.builtin).map((item) => item.id));
  for (const layout of bundle.layouts) {
    if (!layout.landscapeId) continue;
    if (authored.has(layout.id)) authored.add(layout.landscapeId);
    if (authored.has(layout.landscapeId)) authored.add(layout.id);
  }
  for (const id of authored) keep.add(id);

  const extras = bundle.layouts.filter((item) => keep.has(item.id) && item.id !== main.id && !bundle.pageIds.includes(item.id));
  bundle.layouts = [main, ...pages, ...extras];
}

const DEVICE_KINDS = ["phone", "fold", "tablet"] as const;
const ORIENTATIONS = ["portrait", "landscape"] as const;
const FOLD_STATES = ["folded", "unfolded"] as const;

function normalizeDevices(input: ProjectBundle["devices"] | undefined): ProjectBundle["devices"] {
  const devices = Array.isArray(input) ? input : [];
  const seen = new Set<string>();
  const output: ProjectBundle["devices"] = [];
  for (const device of devices) {
    if (!device) continue;
    const kind = DEVICE_KINDS.includes(device.kind) ? device.kind : "phone";
    const orientation = ORIENTATIONS.includes(device.orientation) ? device.orientation : "portrait";
    const foldState = kind === "fold" && device.foldState && FOLD_STATES.includes(device.foldState)
      ? device.foldState
      : undefined;
    let id = String(device.id || "").trim().replace(/[^A-Za-z0-9_-]/g, "-").replace(/^-+|-+$/g, "")
      || `${kind}-${foldState ?? orientation}`;
    if (seen.has(id)) {
      let index = 2;
      while (seen.has(`${id}-${index}`)) index += 1;
      id = `${id}-${index}`;
    }
    seen.add(id);
    output.push({
      id,
      kind,
      orientation,
      ...(foldState ? { foldState } : {}),
      ...(device.metrics ? { metrics: device.metrics } : {}),
      ...(device.mainLayoutId ? { mainLayoutId: device.mainLayoutId } : {}),
    });
  }
  return output.length > 0 ? output : [{ id: "phone", kind: "phone", orientation: "portrait" }];
}

export const REQUIRED_THEME_TOKENS = [
  "bg", "surface", "surfaceAlt", "border", "text", "textMuted",
  "primary", "onPrimary", "accent", "danger", "success", "warning",
] as const;

type LegacyThemeVariant = {
  tokens: Record<string, string>;
  states: Record<string, Record<string, string>>;
};

type LegacyThemeCard = {
  kind?: "theme-card";
  id: string;
  name: string;
  version?: number;
  builtin?: boolean;
  variants: Partial<Record<"light" | "dark", LegacyThemeVariant>>;
};

function builtinTheme(id: string, appearance: "light" | "dark"): ThemeCardPreset {
  const found = BUILTIN_PRESETS.themeCards.find((card) => card.id === id)
    ?? BUILTIN_PRESETS.themeCards.find((card) => card.appearance === appearance)
    ?? BUILTIN_PRESETS.themeCards[0];
  return structuredClone(found);
}

export function defaultThemeSelection(): ThemeSelection {
  return {
    light: builtinTheme("alucard", "light"),
    dark: builtinTheme("dracula", "dark"),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isLegacyThemeCard(value: unknown): value is LegacyThemeCard {
  return isRecord(value) && isRecord(value.variants);
}

function isThemeCard(value: unknown): value is ThemeCardPreset {
  return isRecord(value) && isRecord(value.tokens) && isRecord(value.states);
}

function sameTokens(left: Record<string, string>, right: Record<string, string>): boolean {
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  for (const key of keys) if (left[key] !== right[key]) return false;
  return true;
}

function normalizeCard(value: unknown, fallback: ThemeCardPreset, appearance?: "light" | "dark"): ThemeCardPreset {
  if (!isThemeCard(value)) return structuredClone(fallback);
  const id = String(value.id || fallback.id);
  const known = value.builtin === true
    ? BUILTIN_PRESETS.themeCards.find((item) => item.id === id)
    : undefined;
  const resolvedAppearance = value.appearance === "light" || value.appearance === "dark"
    ? value.appearance
    : known?.appearance ?? appearance;
  const family = typeof value.family === "string" && value.family ? value.family : known?.family;
  return {
    kind: "theme-card",
    id,
    name: String(value.name || fallback.name),
    version: 1,
    builtin: value.builtin === true,
    ...(resolvedAppearance ? { appearance: resolvedAppearance } : {}),
    ...(family ? { family } : {}),
    tokens: { ...structuredClone(fallback.tokens), ...structuredClone(value.tokens) },
    states: { ...structuredClone(fallback.states), ...structuredClone(value.states) },
  };
}

function splitLegacyVariant(legacy: LegacyThemeCard, variant: "light" | "dark"): ThemeCardPreset {
  const colorSet = legacy.variants[variant] ?? legacy.variants[variant === "light" ? "dark" : "light"];
  const fallback = builtinTheme(variant === "light" ? "alucard" : "dracula", variant);
  if (!colorSet) return fallback;
  const matched = BUILTIN_PRESETS.themeCards.find((card) => sameTokens(card.tokens, colorSet.tokens));
  if (matched) return { ...structuredClone(matched), appearance: matched.appearance ?? variant };
  return {
    kind: "theme-card",
    id: `split-${legacy.id || "theme"}-${variant}`,
    name: `${legacy.name || "Theme"} ${variant === "light" ? "Light" : "Dark"}`,
    version: 1,
    builtin: false,
    appearance: variant,
    tokens: structuredClone(colorSet.tokens),
    states: structuredClone(colorSet.states),
  };
}

function normalizeTheme(input: unknown): { theme: ThemeSelection; custom: ThemeCardPreset[] } {
  const fallback = defaultThemeSelection();
  if (!input) return { theme: fallback, custom: [] };

  if (isLegacyThemeCard(input)) {
    const light = splitLegacyVariant(input, "light");
    const dark = splitLegacyVariant(input, "dark");
    const custom = [light, dark].filter((card) => !card.builtin);
    return { theme: { light, dark }, custom };
  }

  // A bare card is malformed but easy to recover: use it for both directions.
  if (isThemeCard(input)) {
    const light = normalizeCard(input, fallback.light, "light");
    const dark = normalizeCard(input, fallback.dark, "dark");
    return { theme: { light, dark }, custom: [] };
  }

  const candidate = isRecord(input) ? input : {};
  return {
    theme: {
      light: normalizeCard(candidate.light, fallback.light, "light"),
      dark: normalizeCard(candidate.dark, fallback.dark, "dark"),
    },
    custom: [],
  };
}

function fallbackLayouts(): LayoutPreset[] {
  return BUILTIN_PRESETS.layouts.slice(0, 3).map((item) => structuredClone(item));
}

/**
 * Normalizes a v2 or v3 bundle in place and returns it. v2 cards held a
 * light/dark pair; v3 splits them into independent single-scheme cards.
 */
export function normalizeBundle(input: ProjectBundle): ProjectBundle {
  const bundle = structuredClone(input);
  bundle.format = "trime-theme-bundle";
  bundle.schemaVersion = 3;
  bundle.id = bundle.id || "trime-theme";
  bundle.meta = {
    ...bundle.meta,
    name: bundle.meta?.name || "Untitled Trime Theme",
    author: bundle.meta?.author || "",
    configVersion: bundle.meta?.configVersion || "3.0",
  };
  const normalizedTheme = normalizeTheme((input as unknown as { theme?: unknown }).theme);
  bundle.theme = normalizedTheme.theme;
  bundle.variant = bundle.variant === "light" ? "light" : "dark";

  // Keep project-scoped custom cards, plus any custom card used by a slot.
  const custom = new Map<string, ThemeCardPreset>();
  for (const card of [...(Array.isArray(input.customThemeCards) ? input.customThemeCards : []), ...normalizedTheme.custom]) {
    if (!isThemeCard(card) || card.builtin === true) continue;
    const normalized = normalizeCard(card, card, card.appearance);
    custom.set(normalized.id, normalized);
  }
  for (const card of [bundle.theme.light, bundle.theme.dark]) {
    if (card.builtin) continue;
    if (!custom.has(card.id)) custom.set(card.id, structuredClone(card));
  }
  bundle.customThemeCards = [...custom.values()];

  bundle.keyStyles = bundle.keyStyles ?? defaultKeyStyles();
  bundle.macros = Array.isArray(bundle.macros) ? bundle.macros : [];
  bundle.layouts = Array.isArray(bundle.layouts) && bundle.layouts.length > 0 ? bundle.layouts : fallbackLayouts();
  // Landscape variants are an additive, optional field. Drop dangling or
  // self-referencing ids so the bundle stays self-contained.
  const layoutIds = new Set(bundle.layouts.map((item) => item.id));
  for (const layout of bundle.layouts) {
    if (layout.landscapeId && (layout.landscapeId === layout.id || !layoutIds.has(layout.landscapeId))) {
      delete layout.landscapeId;
    }
  }
  bundle.mainLayoutId = bundle.mainLayoutId || bundle.layouts.find((item) => item.pageRole === "main")?.id || bundle.layouts[0].id;
  bundle.pageIds = (Array.isArray(bundle.pageIds) ? bundle.pageIds : []).filter((id) => id !== bundle.mainLayoutId);
  bundle.devices = normalizeDevices(bundle.devices);
  bundle.schemaBindings = (Array.isArray(bundle.schemaBindings) ? bundle.schemaBindings : [])
    .map((binding) => ({
      schemaId: String(binding.schemaId ?? "").trim(),
      layoutId: String(binding.layoutId ?? ""),
      ...(binding.alias ? { alias: String(binding.alias).trim() } : {}),
    }))
    .filter((binding) => Boolean(binding.layoutId));
  bundle.chrome = normalizeChrome(bundle.chrome);
  bundle.customPresetKeys = bundle.customPresetKeys ?? {};
  bundle.passthrough = bundle.passthrough ?? {};
  pruneBundleLayouts(bundle);
  return bundle;
}

/** Export form: no storage timestamp, so the bundle is stable and diffable. */
export function portableBundle(bundle: ProjectBundle): ProjectBundle {
  const copy = normalizeBundle(bundle);
  delete copy.updatedAt;
  return copy;
}

export function actionLabel(action: ActionRef | undefined, libs?: PresetLibraries): string {
  if (!action) return "—";
  switch (action.kind) {
    case "char": return action.value || "∅";
    case "text": return action.value || "∅";
    case "key": return action.value;
    case "macro": return libs?.macros.find((item) => item.id === action.id)?.name ?? action.id;
    case "page": return libs?.layouts.find((item) => item.id === action.id)?.name ?? `Page ${action.id}`;
    case "toggle": return `Toggle ${action.value}`;
    case "command": return `Command ${action.value}`;
    case "preset": return action.value;
  }
}

export function tokenValue(card: ThemeCardPreset, token: string | undefined, state = "tokens"): string {
  if (!token) return "transparent";
  if (state !== "tokens") {
    const group = card.states[state];
    if (group?.[token]) return group[token];
  }
  if (card.tokens[token]) return card.tokens[token];
  const [group, key] = token.includes(".") ? token.split(".", 2) : ["tokens", token];
  if (group !== "tokens") return card.states[group]?.[key] ?? card.tokens[token] ?? "transparent";
  return "transparent";
}

export function keyStyleColors(card: ThemeCardPreset, keyStyles: Record<string, KeyStyle>, styleId: string) {
  const style = keyStyles[styleId] ?? keyStyles.default;
  return {
    background: tokenValue(card, style.background),
    text: tokenValue(card, style.text),
    border: tokenValue(card, style.border ?? style.background),
    symbol: tokenValue(card, style.symbol ?? style.text),
  };
}

export function mainLayout(bundle: ProjectBundle, libs = libraries(bundle)): LayoutPreset {
  return libs.layouts.find((item) => item.id === bundle.mainLayoutId)
    ?? bundle.layouts.find((item) => item.id === bundle.mainLayoutId)
    ?? libs.layouts[0];
}

export function findLayout(bundle: ProjectBundle, id: string, libs = libraries(bundle)): LayoutPreset | undefined {
  return libs.layouts.find((item) => item.id === id);
}

export function pages(bundle: ProjectBundle, libs = libraries(bundle)): LayoutPreset[] {
  const main = mainLayout(bundle, libs);
  const result: LayoutPreset[] = [main];
  for (const id of bundle.pageIds ?? []) {
    const layout = libs.layouts.find((item) => item.id === id);
    if (layout && layout.id !== main.id) result.push(layout);
  }
  return result;
}

export function uniqueId(prefix: string, taken: string[]): string {
  let index = 1;
  let id = `${prefix}-${index}`;
  while (taken.includes(id)) {
    index += 1;
    id = `${prefix}-${index}`;
  }
  return id;
}

/**
 * Adds a landscape variant for `base` and returns the new layout id.
 * The base is embedded first so built-in presets are never mutated.
 */
export function addLandscapeVariant(bundle: ProjectBundle, base: LayoutPreset): string | undefined {
  const embedded = embedLayout(bundle, base);
  const source = bundle.layouts.find((item) => item.id === embedded.id);
  if (!source) return undefined;
  const taken = bundle.layouts.map((item) => item.id);
  const baseId = `${source.id}${LAYOUT_RULES.landscapeSuffix}`;
  let id = baseId;
  let suffix = 2;
  while (taken.includes(id)) {
    id = `${baseId}-${suffix}`;
    suffix += 1;
  }
  const clone: LayoutPreset = {
    ...structuredClone(source),
    id,
    name: `${source.name} · 横屏`,
    builtin: false,
    version: 1,
  };
  delete clone.landscapeId;
  bundle.layouts.push(clone);
  source.landscapeId = id;
  pruneBundleLayouts(bundle);
  return id;
}

export function removeLandscapeVariant(bundle: ProjectBundle, variantId: string): string | undefined {
  const owner = bundle.layouts.find((item) => item.landscapeId === variantId);
  if (!owner) return undefined;
  delete owner.landscapeId;
  bundle.layouts = bundle.layouts.filter((item) => item.id !== variantId);
  pruneBundleLayouts(bundle);
  return owner.id;
}

export function cloneLayout(layout: LayoutPreset, name: string): LayoutPreset {
  const clone: LayoutPreset = {
    ...structuredClone(layout),
    id: `custom-${layout.id}-${Date.now()}`,
    name,
    builtin: false,
    version: 1,
  };
  // A duplicate must not share (or claim) the source's landscape variant.
  delete clone.landscapeId;
  return clone;
}

export function newLayout(name: string): LayoutPreset {
  return {
    kind: "layout",
    id: `custom-layout-${Date.now()}`,
    name,
    version: 1,
    builtin: false,
    pageRole: "main",
    rows: [
      {
        height: 52,
        keys: [
          { style: "default", width: 20, click: { kind: "char", value: "q" }, label: "Q" },
          { style: "default", width: 20, click: { kind: "char", value: "w" }, label: "W" },
          { style: "default", width: 20, click: { kind: "char", value: "e" }, label: "E" },
          { style: "default", width: 20, click: { kind: "char", value: "r" }, label: "R" },
          { style: "default", width: 20, click: { kind: "char", value: "t" }, label: "T" },
        ],
      },
    ],
  };
}

export function cloneMacro(macro: MacroPreset, name: string): MacroPreset {
  const copy = { ...structuredClone(macro), id: `custom-${macro.id}-${Date.now()}`, name, builtin: false, version: 1 };
  // A duplicated imported macro must not keep the original preset token.
  delete copy.token;
  return copy;
}

export function newMacro(name: string): MacroPreset {
  return {
    kind: "macro",
    id: `custom-macro-${Date.now()}`,
    name,
    version: 1,
    builtin: false,
    steps: [{ type: "text", value: "" }],
  };
}

export function cloneThemeCard(card: ThemeCardPreset, name: string): ThemeCardPreset {
  const copy = structuredClone(card);
  copy.id = `custom-${card.id}-${Date.now()}`;
  copy.name = name;
  copy.builtin = false;
  copy.version = 1;
  // A copy belongs to the "custom" picker group, not the source family.
  delete copy.family;
  return copy;
}

export function newThemeCard(name: string, base = BUILTIN_PRESETS.themeCards[0]): ThemeCardPreset {
  return { ...cloneThemeCard(base, name), id: `custom-card-${Date.now()}` };
}

export function slug(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-").replace(/^-+|-+$/g, "") || "trime";
}
