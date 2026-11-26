import type { DeviceProfile, LayoutPreset, ProjectBundle, ProjectMetrics } from "./types";

const KIND_LABELS: Record<DeviceProfile["kind"], string> = {
  phone: "Phone",
  fold: "Fold",
  tablet: "Tablet",
};

const ORIENTATION_LABELS: Record<DeviceProfile["orientation"], string> = {
  portrait: "竖屏",
  landscape: "横屏",
};

const FOLD_LABELS: Record<NonNullable<DeviceProfile["foldState"]>, string> = {
  folded: "折叠",
  unfolded: "展开",
};

/** Short, human-facing device name. Set `withId` for warnings and lists. */
export function deviceLabel(device: DeviceProfile, withId = false): string {
  const kind = KIND_LABELS[device.kind] ?? device.kind;
  const state = device.foldState ? FOLD_LABELS[device.foldState] : ORIENTATION_LABELS[device.orientation];
  return withId ? `${kind} · ${state} (${device.id})` : `${kind} · ${state}`;
}

/** The portrait/base layout behind a landscape variant, if any. */
export function baseLayoutOf(bundle: ProjectBundle, layoutId: string): LayoutPreset | undefined {
  const direct = bundle.layouts.find((item) => item.id === layoutId);
  if (direct) {
    const owner = bundle.layouts.find((item) => item.landscapeId === layoutId);
    return owner ?? direct;
  }
  return bundle.layouts.find((item) => item.landscapeId === layoutId);
}

export function isLandscapeVariant(bundle: ProjectBundle, layoutId: string): boolean {
  return bundle.layouts.some((item) => item.landscapeId === layoutId);
}

/**
 * Resolves the layout a device compiles with. Landscape uses the base
 * layout's variant when present, otherwise falls back to the base layout.
 */
export function resolveLayoutForDevice(bundle: ProjectBundle, device?: DeviceProfile): LayoutPreset | undefined {
  const baseId = device?.mainLayoutId ?? bundle.mainLayoutId;
  const base = bundle.layouts.find((item) => item.id === baseId) ?? bundle.layouts[0];
  if (!base) return undefined;
  if (device?.orientation !== "landscape" || !base.landscapeId) return base;
  return bundle.layouts.find((item) => item.id === base.landscapeId) ?? base;
}

export function mergeMetrics(base: ProjectMetrics | undefined, override: Partial<ProjectMetrics> | undefined): ProjectMetrics {
  const output: ProjectMetrics = { ...(base ?? {}) };
  for (const key of Object.keys(override ?? {}) as Array<keyof ProjectMetrics>) {
    const value = override?.[key];
    if (value !== undefined) output[key] = value;
  }
  return output;
}

export function resolveMetrics(bundle: ProjectBundle, device?: DeviceProfile): ProjectMetrics {
  return mergeMetrics(bundle.metrics, device?.metrics);
}
