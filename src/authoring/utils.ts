import { BUILTIN_PRESETS, DEFAULT_LIQUID, DEFAULT_PREEDIT, DEFAULT_TOOLBAR, DEFAULT_WINDOW, KEY_STYLES } from "./presets";
import { LAYOUT_RULES } from "./devicePresets";
import type { ActionRef, ChromeConfig, ChromePatch, KeySlot, KeyStyle, LayoutPreset, LayoutRole, LayoutRow, LiquidConfig, MacroPreset, PresetLibraries, ProjectBundle, ThemeCardPreset, ThemeSelection } from "./types";

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

/**
 * Trime does not create a Key for a slot without a click token, so the slot is
 * a pure layout gap. Legacy bundles modelled it as an empty text click +
 * off style; both forms resolve to a placeholder here.
 */
export function isPlaceholder(slot: KeySlot): boolean {
  return slot.kind === "placeholder"
    || (slot.click?.kind === "text" && slot.click.value === "");
}

/** Collapses legacy spacers and drops key-only fields from placeholders. */
export function normalizeKeySlot(slot: KeySlot): KeySlot {
  if (!isPlaceholder(slot)) {
    if (slot.kind === "key") {
      const { kind: _kind, ...rest } = slot;
      return rest;
    }
    return slot;
  }
  return {
    kind: "placeholder",
    width: slot.width ?? 0,
    ...(slot.id ? { id: slot.id } : {}),
    ...(slot.passthrough ? { passthrough: slot.passthrough } : {}),
  };
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

type WidthRow = { keys: Array<{ width: number }> };

/**
 * Key widths are relative weights: 10 means one standard key. Trime itself
 * interprets a width as a share of 100, so rows are normalized when previewing
 * and compiling, not while editing.
 */
export function rowWeightTotal(row: WidthRow): number {
  return row.keys.reduce((sum, key) => sum + Math.max(0, key.width || 0), 0);
}

/** Visual percentage of each key in a row. Zero-weight rows fall back to equal shares. */
export function rowPercentages(row: WidthRow): number[] {
  if (row.keys.length === 0) return [];
  const total = rowWeightTotal(row);
  if (total <= 0) return row.keys.map(() => 100 / row.keys.length);
  return row.keys.map((key) => (Math.max(0, key.width || 0) / total) * 100);
}

/**
 * Largest-remainder split of 100 into integer percentages. Used by the optional
 * "integer widths" export mode and by the row calibration action.
 */
export function integerRowWidths(row: WidthRow): number[] {
  const percentages = rowPercentages(row);
  if (percentages.length === 0) return [];
  // More than 100 slots cannot all get an integer share of 100.
  if (percentages.length > 100) return percentages.map((value) => Number(value.toFixed(3)));

  const widths = percentages.map((value) => Math.max(0, Math.floor(value)));
  let remainder = 100 - widths.reduce((sum, value) => sum + value, 0);
  const order = percentages
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);
  let cursor = 0;
  while (remainder > 0 && order.length > 0) {
    widths[order[cursor % order.length].index] += 1;
    remainder -= 1;
    cursor += 1;
  }

  // Every slot needs a visible width; borrow from the widest slot.
  for (let index = 0; index < widths.length; index += 1) {
    if (widths[index] > 0) continue;
    let donor = 0;
    for (let other = 1; other < widths.length; other += 1) {
      if (widths[other] > widths[donor]) donor = other;
    }
    if (widths[donor] > 1) {
      widths[donor] -= 1;
      widths[index] = 1;
    }
  }
  return widths;
}

/** Round a row's weights so the row is an integer split of 100. */
export function fitRowWidths(row: WidthRow): void {
  const widths = integerRowWidths(row);
  row.keys.forEach((key, index) => { key.width = widths[index]; });
}

export function fitLayoutRows(layout: LayoutPreset): void {
  for (const row of layout.rows) fitRowWidths(row);
}

export function reflowLayoutRows(layout: LayoutPreset, target = 100): void {
  // Flatten keys using their visual share, then repack into 100% rows.
  const keys: Array<{ key: KeySlot; width: number }> = [];
  for (const row of layout.rows) {
    const percentages = rowPercentages(row);
    row.keys.forEach((key, index) => {
      keys.push({ key, width: Math.max(0.01, percentages[index]) });
    });
  }
  const height = layout.rows.find((row) => row.height)?.height ?? 52;
  const rows: LayoutRow[] = [];
  let current: LayoutRow = { height, keys: [] };
  let used = 0;
  for (const item of keys) {
    if (current.keys.length > 0 && used + item.width > target + 0.5) {
      fitRowWidths(current);
      rows.push(current);
      current = { height, keys: [] };
      used = 0;
    }
    item.key.width = item.width;
    current.keys.push(item.key);
    used += item.width;
  }
  if (current.keys.length > 0) {
    fitRowWidths(current);
    rows.push(current);
  }
  if (rows.length === 0) rows.push({ height, keys: [{ style: "default", width: 10, click: { kind: "char", value: "a" }, label: "A" }] });
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

const KEY_BEHAVIORS = [
  "click", "long_click", "double_click", "swipe_up", "swipe_down", "swipe_left", "swipe_right",
] as const;

type PageAction = Extract<ActionRef, { kind: "page" }>;

function eachPageAction(bundle: ProjectBundle, callback: (action: PageAction) => void): void {
  for (const layout of bundle.layouts) {
    for (const row of layout.rows) {
      for (const key of row.keys) {
        for (const behavior of KEY_BEHAVIORS) {
          const action = (key as unknown as Record<string, ActionRef | undefined>)[behavior];
          if (action?.kind === "page") callback(action as PageAction);
        }
      }
    }
  }
}

/** Copies a catalog preset into the project as a stable, user-owned page. */
function materializeLayout(bundle: ProjectBundle, layout: LayoutPreset): LayoutPreset {
  if (!Array.isArray(bundle.layoutGroupIds)) bundle.layoutGroupIds = [];
  const existing = bundle.layouts.find((item) => item.id === layout.id);
  if (existing) {
    if (existing.builtin) {
      existing.sourcePresetId = existing.sourcePresetId ?? existing.id;
      existing.builtin = false;
    }
    return existing;
  }
  const copy = structuredClone(layout);
  if (copy.builtin) {
    copy.sourcePresetId = copy.sourcePresetId ?? copy.id;
    copy.builtin = false;
  }
  bundle.layouts.push(copy);
  return copy;
}

/**
 * A preset's Page actions point at page ids. When a preset fills a page, make
 * those actions resolve to the project's pages: remap to an existing page with
 * the same provenance, or instantiate the referenced built-in page.
 */
function ensurePageDependencies(
  bundle: ProjectBundle,
  roots: LayoutPreset[],
  addMissing: boolean,
): LayoutPreset[] {
  if (!Array.isArray(bundle.layoutGroupIds)) bundle.layoutGroupIds = [];
  const variantIds = new Set(
    bundle.layouts.map((item) => item.landscapeId).filter((value): value is string => Boolean(value)),
  );
  const queue = [...roots];
  const scanned = new Set<string>();
  const added: LayoutPreset[] = [];
  while (queue.length > 0) {
    const page = queue.shift();
    if (!page || scanned.has(page.id)) continue;
    scanned.add(page.id);
    for (const row of page.rows) {
      for (const key of row.keys) {
        for (const behavior of KEY_BEHAVIORS) {
          const action = (key as unknown as Record<string, ActionRef | undefined>)[behavior];
          if (!action || action.kind !== "page" || !action.id || action.id === "main") continue;
          const owner = bundle.layouts.find((item) => item.landscapeId === action.id);
          if (owner) {
            action.id = owner.id;
            if (!scanned.has(owner.id)) queue.push(owner);
            continue;
          }
          const existing = bundle.layouts.find((item) => item.id === action.id);
          if (existing) {
            if (!variantIds.has(existing.id) && !bundle.layoutGroupIds.includes(existing.id)) {
              bundle.layoutGroupIds.push(existing.id);
            }
            if (!scanned.has(existing.id)) queue.push(existing);
            continue;
          }
          const sourceMatches = bundle.layouts.filter(
            (item) => item.sourcePresetId === action.id && !variantIds.has(item.id),
          );
          const groupMatches = sourceMatches.filter((item) => bundle.layoutGroupIds.includes(item.id));
          const sourcePage = groupMatches.length === 1 ? groupMatches[0] : sourceMatches.length === 1 ? sourceMatches[0] : undefined;
          if (sourcePage) {
            action.id = sourcePage.id;
            if (!bundle.layoutGroupIds.includes(sourcePage.id)) bundle.layoutGroupIds.push(sourcePage.id);
            if (!scanned.has(sourcePage.id)) queue.push(sourcePage);
            continue;
          }
          if (!addMissing) continue;
          const preset = BUILTIN_PRESETS.layouts.find((item) => item.id === action.id && item.builtin);
          if (!preset) continue;
          const materialized = materializeLayout(bundle, preset);
          const materializedIsVariant = bundle.layouts.some((item) => item.landscapeId === materialized.id);
          if (!materializedIsVariant && !bundle.layoutGroupIds.includes(materialized.id)) {
            bundle.layoutGroupIds.push(materialized.id);
          }
          added.push(materialized);
          queue.push(materialized);
        }
      }
    }
  }
  return added;
}

/** Rewrites dangling Page actions to a page that was cloned from that preset. */
function remapLegacyPageTargets(bundle: ProjectBundle, validIds: Set<string>): void {
  const variantIds = new Set(
    bundle.layouts.map((item) => item.landscapeId).filter((value): value is string => Boolean(value)),
  );
  eachPageAction(bundle, (action) => {
    if (action.id === "main" || validIds.has(action.id)) return;
    const owner = bundle.layouts.find((item) => item.landscapeId === action.id);
    if (owner) {
      action.id = owner.id;
      return;
    }
    const matches = bundle.layouts.filter(
      (item) => item.sourcePresetId === action.id && !variantIds.has(item.id),
    );
    const groupMatches = matches.filter((item) => validIds.has(item.id));
    if (groupMatches.length === 1) action.id = groupMatches[0].id;
    else if (matches.length === 1) action.id = matches[0].id;
  });
}

/**
 * Adds a catalog layout to the bundle and its ordered layout group. Built-ins
 * are copied into project-owned pages, and Page actions in the preset are
 * linked to the pages they reference.
 */
export function embedLayout(bundle: ProjectBundle, layout: LayoutPreset): LayoutPreset {
  const target = materializeLayout(bundle, layout);
  const isVariant = bundle.layouts.some((item) => item.landscapeId === target.id);
  if (!isVariant && !bundle.layoutGroupIds.includes(target.id)) {
    bundle.layoutGroupIds.push(target.id);
  }
  ensurePageDependencies(bundle, [target], true);
  return target;
}

/**
 * Rebuilds the layout inventory. Every embedded base layout belongs to the
 * group by definition, so nothing can compile without being visible in the UI.
 * Landscape variants stay attached to their base and never become group items.
 */
export function pruneBundleLayouts(bundle: ProjectBundle): void {
  const byId = new Map(bundle.layouts.map((item) => [item.id, item]));
  const variantIds = new Set(
    bundle.layouts.map((item) => item.landscapeId).filter((value): value is string => Boolean(value)),
  );
  const group: string[] = [];
  const push = (id: string | undefined) => {
    if (!id || group.includes(id) || variantIds.has(id) || !byId.has(id)) return;
    group.push(id);
  };
  for (const id of bundle.layoutGroupIds ?? []) push(id);
  for (const layout of bundle.layouts) push(layout.id);
  for (const device of bundle.devices ?? []) push(device.layoutId);
  for (const binding of bundle.schemaBindings ?? []) push(binding.layoutId);

  bundle.layoutGroupIds = group;
  if (bundle.defaultLayoutId && !group.includes(bundle.defaultLayoutId)) {
    delete bundle.defaultLayoutId;
  }

  const bases: LayoutPreset[] = [];
  const variants: LayoutPreset[] = [];
  for (const id of group) {
    const base = byId.get(id);
    if (!base) continue;
    if (base.landscapeId) {
      const variant = byId.get(base.landscapeId);
      if (!variant || variant.id === base.id || group.includes(variant.id)) {
        delete base.landscapeId;
      } else {
        variants.push(variant);
      }
    }
    bases.push(base);
  }
  bundle.layouts = [...bases, ...variants];
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
    const legacyDevice = device as typeof device & { mainLayoutId?: string };
    const layoutId = String(legacyDevice.layoutId ?? legacyDevice.mainLayoutId ?? "").trim();
    output.push({
      id,
      kind,
      orientation,
      ...(foldState ? { foldState } : {}),
      ...(device.metrics ? { metrics: device.metrics } : {}),
      ...(layoutId ? { layoutId } : {}),
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

function themeStates(states: Record<string, Record<string, string>>): Record<string, Record<string, string>> {
  const next = structuredClone(states);
  // hover was never rendered by Trime; drop it from stored and imported cards.
  delete next.hover;
  return next;
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
    states: themeStates({ ...structuredClone(fallback.states), ...structuredClone(value.states) }),
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
    states: themeStates(colorSet.states),
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

function normalizeLayoutRole(layout: LayoutPreset & { pageRole?: unknown }): LayoutRole {
  if (layout.role === "letters" || layout.role === "number" || layout.role === "symbols") return layout.role;
  if (layout.pageRole === "number" || layout.pageRole === "symbols") return layout.pageRole;
  if (/number|num|123|digit/i.test(layout.id)) return "number";
  if (/symbol|punct|emoji/i.test(layout.id)) return "symbols";
  return "letters";
}

/**
 * Normalizes a v2, v3, or v4 bundle and returns it. v2 cards held a
 * light/dark pair; v3 split them into single-scheme cards; v4 replaces
 * mainLayoutId/pageIds with an ordered layout group and an optional default.
 */
export function normalizeBundle(input: ProjectBundle): ProjectBundle {
  const bundle = structuredClone(input);
  bundle.format = "trime-theme-bundle";
  bundle.schemaVersion = 4;
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
  // disabled is no longer a key-style layer; off is the disabled/off role.
  for (const style of Object.values(bundle.keyStyles)) {
    delete (style as KeyStyle & { disabled?: unknown }).disabled;
  }
  bundle.macros = Array.isArray(bundle.macros) ? bundle.macros : [];
  bundle.layouts = Array.isArray(bundle.layouts) ? bundle.layouts : [];
  for (const layout of bundle.layouts) {
    for (const row of Array.isArray(layout.rows) ? layout.rows : []) {
      row.keys = (Array.isArray(row.keys) ? row.keys : []).map(normalizeKeySlot);
    }
    layout.role = normalizeLayoutRole(layout as LayoutPreset & { pageRole?: unknown });
    delete (layout as LayoutPreset & { pageRole?: unknown }).pageRole;
    if (layout.builtin) {
      layout.sourcePresetId = layout.sourcePresetId ?? layout.id;
      layout.builtin = false;
    } else if (!layout.sourcePresetId) {
      // Old bundles cloned an edited built-in to `custom-<preset>-<timestamp>`.
      const legacyClone = /^custom-(.+)-(\d{10,})$/.exec(layout.id);
      if (legacyClone && BUILTIN_PRESETS.layouts.some((item) => item.id === legacyClone[1] && item.builtin)) {
        layout.sourcePresetId = legacyClone[1];
      }
    }
  }
  // Landscape variants are an additive, optional field. Drop dangling or
  // self-referencing ids so the bundle stays self-contained.
  const layoutIds = new Set(bundle.layouts.map((item) => item.id));
  for (const layout of bundle.layouts) {
    if (layout.landscapeId && (layout.landscapeId === layout.id || !layoutIds.has(layout.landscapeId))) {
      delete layout.landscapeId;
    }
  }
  const variantOwner = new Map<string, string>();
  for (const layout of bundle.layouts) {
    if (layout.landscapeId) variantOwner.set(layout.landscapeId, layout.id);
  }

  // v3 stored a main layout plus pages. v4 uses one ordered group that
  // includes the default. Every embedded base is a group member so the UI
  // inventory matches what compiles.
  const legacy = input as ProjectBundle & { mainLayoutId?: string; pageIds?: string[] };
  const legacyDefault = legacy.defaultLayoutId ?? legacy.mainLayoutId;
  const legacyGroup = Array.isArray(legacy.layoutGroupIds) ? legacy.layoutGroupIds : undefined;
  const legacyPages = Array.isArray(legacy.pageIds) ? legacy.pageIds : [];
  const variantIds = new Set([...variantOwner.keys()]);
  const group: string[] = [];
  const addToGroup = (id: string | undefined) => {
    if (!id || group.includes(id) || variantIds.has(id) || !layoutIds.has(id)) return;
    group.push(id);
  };
  if (legacyGroup) {
    for (const id of legacyGroup) addToGroup(id);
  } else {
    addToGroup(legacyDefault);
    for (const id of legacyPages) addToGroup(id);
  }
  for (const layout of bundle.layouts) addToGroup(layout.id);
  bundle.layoutGroupIds = group;
  if (legacyDefault && group.includes(legacyDefault)) bundle.defaultLayoutId = legacyDefault;
  else delete bundle.defaultLayoutId;
  delete (bundle as ProjectBundle & { mainLayoutId?: string }).mainLayoutId;
  delete (bundle as ProjectBundle & { pageIds?: string[] }).pageIds;
  remapLegacyPageTargets(bundle, new Set(bundle.layoutGroupIds));

  bundle.devices = normalizeDevices(bundle.devices);
  for (const device of bundle.devices) {
    if (device.layoutId && variantOwner.has(device.layoutId)) {
      device.layoutId = variantOwner.get(device.layoutId);
    }
  }
  bundle.schemaBindings = (Array.isArray(bundle.schemaBindings) ? bundle.schemaBindings : [])
    .map((binding) => {
      const layoutId = String(binding.layoutId ?? "");
      return {
        schemaId: String(binding.schemaId ?? "").trim(),
        layoutId: variantOwner.get(layoutId) ?? layoutId,
        ...(binding.alias ? { alias: String(binding.alias).trim() } : {}),
      };
    })
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
    case "page": return action.id === "main"
      ? "默认布局（按设备解析）"
      : libs?.layouts.find((item) => item.id === action.id)?.name ?? `Page ${action.id}`;
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

export function keyStyleColors(card: ThemeCardPreset, keyStyles: Record<string, KeyStyle>, styleId?: string) {
  const style = (styleId ? keyStyles[styleId] : undefined) ?? keyStyles.default;
  return {
    background: tokenValue(card, style.background),
    text: tokenValue(card, style.text),
    border: tokenValue(card, style.border ?? style.background),
    symbol: tokenValue(card, style.symbol ?? style.text),
  };
}

/** Project default entry, or undefined when devices bind their own layouts. */
export function defaultLayout(bundle: ProjectBundle): LayoutPreset | undefined {
  if (!bundle.defaultLayoutId) return undefined;
  return bundle.layouts.find((item) => item.id === bundle.defaultLayoutId);
}

export function findLayout(bundle: ProjectBundle, id: string, libs = libraries(bundle)): LayoutPreset | undefined {
  return libs.layouts.find((item) => item.id === id);
}

/** Ordered layout group. Order is authoring UI only. */
export function groupLayouts(bundle: ProjectBundle): LayoutPreset[] {
  const byId = new Map(bundle.layouts.map((item) => [item.id, item]));
  return (bundle.layoutGroupIds ?? [])
    .map((id) => byId.get(id))
    .filter((item): item is LayoutPreset => Boolean(item));
}

/** Group members other than the optional project default. */
export function pageLayouts(bundle: ProjectBundle): LayoutPreset[] {
  return groupLayouts(bundle).filter((item) => item.id !== bundle.defaultLayoutId);
}

/** Layout to select when opening the layout step. */
export function firstLayoutId(bundle: ProjectBundle): string {
  return bundle.defaultLayoutId ?? bundle.layoutGroupIds[0] ?? "";
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
  // A variant is not a page target; keep provenance on the base only.
  delete clone.sourcePresetId;
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
    role: "letters",
    rows: [
      {
        height: 52,
        keys: [
          { style: "default", width: 10, click: { kind: "char", value: "q" }, label: "Q" },
          { style: "default", width: 10, click: { kind: "char", value: "w" }, label: "W" },
          { style: "default", width: 10, click: { kind: "char", value: "e" }, label: "E" },
          { style: "default", width: 10, click: { kind: "char", value: "r" }, label: "R" },
          { style: "default", width: 10, click: { kind: "char", value: "t" }, label: "T" },
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
