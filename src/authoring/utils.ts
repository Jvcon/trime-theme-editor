import { BUILTIN_PRESETS, DEFAULT_LIQUID, DEFAULT_PREEDIT, DEFAULT_TOOLBAR, DEFAULT_WINDOW, KEY_STYLES } from "./presets";
import type { ActionRef, ChromeConfig, ChromePatch, KeyStyle, LayoutPreset, LiquidConfig, MacroPreset, PresetLibraries, ProjectDoc, ThemeCardPreset } from "./types";

export function libraries(project: ProjectDoc): PresetLibraries {
  return {
    themeCards: [...BUILTIN_PRESETS.themeCards, ...(project.customThemeCards ?? [])],
    layouts: [...BUILTIN_PRESETS.layouts, ...(project.customLayouts ?? [])],
    macros: [...BUILTIN_PRESETS.macros, ...(project.customMacros ?? [])],
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

export function normalizeProject(input: ProjectDoc): ProjectDoc {
  const project = structuredClone(input);
  project.meta = {
    ...project.meta,
    name: project.meta?.name || "Untitled Trime Theme",
    author: project.meta?.author || "",
    configVersion: project.meta?.configVersion || "3.0",
  };
  project.pageIds = (project.pageIds ?? ["number", "symbols"]).filter((id) => id !== project.layoutId);
  project.macroIds = project.macroIds ?? [];
  project.keyStyles = project.keyStyles ?? defaultKeyStyles();
  project.chrome = normalizeChrome(project.chrome);
  project.customLayouts = project.customLayouts ?? [];
  project.customMacros = project.customMacros ?? [];
  project.customThemeCards = project.customThemeCards ?? [];
  project.customPresetKeys = project.customPresetKeys ?? {};
  return project;
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

export function mainLayout(project: ProjectDoc, libs = libraries(project)): LayoutPreset {
  return libs.layouts.find((item) => item.id === project.layoutId) ?? libs.layouts[0];
}

export function findLayout(project: ProjectDoc, id: string, libs = libraries(project)): LayoutPreset | undefined {
  return libs.layouts.find((item) => item.id === id);
}

export function pages(project: ProjectDoc, libs = libraries(project)): LayoutPreset[] {
  const main = mainLayout(project, libs);
  const result: LayoutPreset[] = [main];
  for (const id of project.pageIds ?? []) {
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
