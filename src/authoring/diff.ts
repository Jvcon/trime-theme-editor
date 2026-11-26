import type { ProjectBundle } from "./types";
import { libraries, normalizeBundle, pages } from "./utils";

export type DiffEntry = {
  kind: "added" | "removed" | "changed";
  path: string;
  before?: string;
  after?: string;
};

export type DiffSection = {
  id: string;
  title: string;
  entries: DiffEntry[];
  truncated: number;
};

type Shape = Record<string, unknown>;

function shape(projectInput: ProjectBundle): Shape {
  const project = normalizeBundle(projectInput);
  const libs = libraries(project);
  const layouts = project.layouts.map((layout) => [layout.id, layout]);
  const macros = project.macros.map((macro) => [macro.id, macro]);
  const tabs = (project.chrome?.liquid.tabs ?? []).map((tab) => [tab.id, tab]);
  return {
    meta: project.meta,
    theme: project.theme,
    customThemeCards: project.customThemeCards ?? [],
    variant: project.variant,
    mainLayoutId: project.mainLayoutId,
    // Page order is meaningful, so keep pageIds as an array.
    pageIds: project.pageIds,
    devices: project.devices,
    schemaBindings: project.schemaBindings,
    keyStyles: project.keyStyles,
    layouts: Object.fromEntries(layouts),
    macros: Object.fromEntries(macros),
    metrics: project.metrics ?? {},
    customPresetKeys: project.customPresetKeys ?? {},
    passthrough: project.passthrough ?? {},
    chrome: project.chrome ? {
      toolbar: project.chrome.toolbar,
      liquid: {
        ...project.chrome.liquid,
        // Key tabs by id so reordering does not look like token changes.
        tabs: Object.fromEntries(tabs),
        tabOrder: project.chrome.liquid.tabs.map((tab) => tab.id),
      },
      window: project.chrome.window,
      preedit: project.chrome.preedit,
    } : {},
    // Effective page composition, including the main layout.
    effective: {
      pages: pages(project, libs).map((layout) => layout.id),
    },
  };
}

function flatten(value: unknown, prefix: string, output: Record<string, string>): void {
  if (value === undefined) return;
  if (value === null) {
    output[prefix || "root"] = "null";
    return;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return;
    value.forEach((item, index) => flatten(item, `${prefix}[${index}]`, output));
    return;
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).filter(([key]) => key !== "updatedAt");
    if (entries.length === 0) return;
    for (const [key, item] of entries) flatten(item, prefix ? `${prefix}.${key}` : key, output);
    return;
  }
  output[prefix || "root"] = String(value);
}

const SECTIONS: Array<{ id: string; title: string; match: (path: string) => boolean }> = [
  { id: "meta", title: "Meta", match: (path) => path.startsWith("meta.") },
  { id: "theme", title: "Theme cards", match: (path) => path.startsWith("theme.") || path.startsWith("customThemeCards") || path.startsWith("variant") },
  { id: "styles", title: "Key styles", match: (path) => path.startsWith("keyStyles") },
  { id: "layouts", title: "Layouts", match: (path) => path.startsWith("mainLayoutId") || path.startsWith("pageIds") || path.startsWith("layouts.") || path.startsWith("effective.pages") },
  { id: "macros", title: "Macros", match: (path) => path.startsWith("macros.") },
  { id: "devices", title: "Devices", match: (path) => path.startsWith("devices") || path.startsWith("schemaBindings") },
  { id: "interface", title: "Interface", match: (path) => path.startsWith("chrome") },
  { id: "metrics", title: "Metrics", match: (path) => path.startsWith("metrics") },
  { id: "presets", title: "Preset keys", match: (path) => path.startsWith("customPresetKeys") },
  { id: "other", title: "Other", match: () => true },
];

function sectionOf(path: string): string {
  return SECTIONS.find((section) => section.match(path))?.id ?? "other";
}

function humanize(path: string): string {
  return path
    .replace(/^chrome\./, "interface.")
    .replace(/^effective\./, "");
}

const DISPLAY_LIMIT = 250;

export function diffBundles(beforeInput: ProjectBundle, afterInput: ProjectBundle): DiffSection[] {
  const before: Record<string, string> = {};
  const after: Record<string, string> = {};
  flatten(shape(beforeInput), "", before);
  flatten(shape(afterInput), "", after);
  const paths = Array.from(new Set([...Object.keys(before), ...Object.keys(after)])).sort();
  const rawEntries: DiffEntry[] = [];

  for (const path of paths) {
    const oldValue = before[path];
    const newValue = after[path];
    if (oldValue === newValue) continue;
    const kind: DiffEntry["kind"] = oldValue === undefined ? "added" : newValue === undefined ? "removed" : "changed";
    rawEntries.push({
      kind,
      path,
      ...(oldValue !== undefined ? { before: oldValue } : {}),
      ...(newValue !== undefined ? { after: newValue } : {}),
    });
  }

  // Collapse added/removed layouts, macros, and liquid tabs into one row
  // instead of emitting every nested field.
  const collapsed = new Map<string, DiffEntry["kind"]>();
  for (const entry of rawEntries) {
    if (entry.kind === "changed") continue;
    const match = /^(layouts|macros|chrome\.liquid\.tabs)\.[^.]+\.id$/.exec(entry.path);
    if (!match) continue;
    collapsed.set(entry.path.slice(0, -3), entry.kind);
  }

  const filtered = rawEntries.filter((entry) => {
    for (const root of collapsed.keys()) {
      if (entry.path === `${root}.id`) return false;
      if (entry.path.startsWith(`${root}.`)) return false;
    }
    return true;
  });
  for (const [root, kind] of collapsed) {
    filtered.push({ kind, path: root, ...(kind === "removed" ? { before: "removed" } : { after: "added" }) });
  }

  const grouped = new Map<string, DiffEntry[]>();
  for (const entry of filtered) {
    const display: DiffEntry = { ...entry, path: humanize(entry.path) };
    const section = sectionOf(entry.path);
    const list = grouped.get(section) ?? [];
    list.push(display);
    grouped.set(section, list);
  }

  const sections: DiffSection[] = [];
  for (const section of SECTIONS) {
    const entries = (grouped.get(section.id) ?? []).sort((a, b) => a.path.localeCompare(b.path));
    if (entries.length === 0) continue;
    sections.push({
      id: section.id,
      title: section.title,
      entries: entries.slice(0, DISPLAY_LIMIT),
      truncated: Math.max(0, entries.length - DISPLAY_LIMIT),
    });
  }
  return sections;
}
