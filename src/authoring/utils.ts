import { BUILTIN_PRESETS, DEFAULT_LIQUID, DEFAULT_PREEDIT, DEFAULT_TOOLBAR, DEFAULT_WINDOW, KEY_STYLES } from "./presets";
import type { ActionRef, ChromeConfig, ChromePatch, KeyStyle, LayoutPreset, LiquidConfig, MacroPreset, PresetLibraries, ProjectBundle, ThemeCardPreset } from "./types";

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
    themeCards: mergeById([bundle.theme], BUILTIN_PRESETS.themeCards),
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

function fallbackTheme(): ThemeCardPreset {
  return structuredClone(BUILTIN_PRESETS.themeCards[0]);
}

function fallbackLayouts(): LayoutPreset[] {
  return BUILTIN_PRESETS.layouts.slice(0, 3).map((item) => structuredClone(item));
}

/**
 * Normalizes a v2 bundle in place and returns it. No v1 migration exists by
 * design: this project has no production data to preserve.
 */
export function normalizeBundle(input: ProjectBundle): ProjectBundle {
  const bundle = structuredClone(input);
  bundle.format = "trime-theme-bundle";
  bundle.schemaVersion = 2;
  bundle.id = bundle.id || "trime-theme";
  bundle.meta = {
    ...bundle.meta,
    name: bundle.meta?.name || "Untitled Trime Theme",
    author: bundle.meta?.author || "",
    configVersion: bundle.meta?.configVersion || "3.0",
  };
  bundle.theme = bundle.theme ?? fallbackTheme();
  bundle.variant = bundle.variant === "light" ? "light" : "dark";
  bundle.keyStyles = bundle.keyStyles ?? defaultKeyStyles();
  bundle.macros = Array.isArray(bundle.macros) ? bundle.macros : [];
  bundle.layouts = Array.isArray(bundle.layouts) && bundle.layouts.length > 0 ? bundle.layouts : fallbackLayouts();
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

export function tokenValue(card: ThemeCardPreset, variant: "light" | "dark", token: string | undefined, state = "tokens"): string {
  if (!token) return "transparent";
  if (state !== "tokens") {
    const group = card.variants[variant].states[state];
    if (group?.[token]) return group[token];
  }
  if (card.variants[variant].tokens[token]) return card.variants[variant].tokens[token];
  const [group, key] = token.includes(".") ? token.split(".", 2) : ["tokens", token];
  if (group !== "tokens") return card.variants[variant].states[group]?.[key] ?? card.variants[variant].tokens[token] ?? "transparent";
  return "transparent";
}

export function keyStyleColors(card: ThemeCardPreset, variant: "light" | "dark", keyStyles: Record<string, KeyStyle>, styleId: string) {
  const style = keyStyles[styleId] ?? keyStyles.default;
  return {
    background: tokenValue(card, variant, style.background),
    text: tokenValue(card, variant, style.text),
    border: tokenValue(card, variant, style.border ?? style.background),
    symbol: tokenValue(card, variant, style.symbol ?? style.text),
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

export function cloneLayout(layout: LayoutPreset, name: string): LayoutPreset {
  return {
    ...structuredClone(layout),
    id: `custom-${layout.id}-${Date.now()}`,
    name,
    builtin: false,
    version: 1,
  };
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
  return { ...structuredClone(macro), id: `custom-${macro.id}-${Date.now()}`, name, builtin: false, version: 1 };
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
  return {
    ...structuredClone(card),
    id: `custom-${card.id}-${Date.now()}`,
    name,
    builtin: false,
    version: 1,
  };
}

export function newThemeCard(name: string): ThemeCardPreset {
  const base = BUILTIN_PRESETS.themeCards[0];
  return { ...cloneThemeCard(base, name), id: `custom-card-${Date.now()}` };
}

export function slug(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-").replace(/^-+|-+$/g, "") || "trime";
}
