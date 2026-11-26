import type { DeviceProfile, ProjectBundle } from "./types";
import { deviceLabel } from "./resolve";

/**
 * Reverse index: which device adaptations compile with this layout.
 * A landscape variant is only "used" by landscape devices; a base layout is
 * used by every device bound to it (including landscape devices that fall back).
 */
export function devicesUsingLayout(project: ProjectBundle, layoutId: string): DeviceProfile[] {
  const owner = project.layouts.find((item) => item.landscapeId === layoutId);
  const isVariant = Boolean(owner);
  const baseId = owner?.id ?? layoutId;
  return project.devices.filter((device) => {
    const bound = device.layoutId ?? project.defaultLayoutId;
    if (bound !== baseId) return false;
    return isVariant ? device.orientation === "landscape" : true;
  });
}

export function impactLabel(devices: DeviceProfile[]): string {
  if (devices.length === 0) return "当前没有设备使用";
  const names = devices.slice(0, 3).map((device) => deviceLabel(device, true));
  const suffix = devices.length > 3 ? ` 等 ${devices.length} 个` : "";
  return `影响 ${devices.length} 个设备：${names.join("、")}${suffix}`;
}
