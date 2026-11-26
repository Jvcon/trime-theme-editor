import { compileBundle } from "./compiler";
import type { ProjectBundle } from "./types";
import { normalizeBundle, portableBundle } from "./utils";

export const EDITOR_VERSION = "0.4.0";

export type ManifestDevice = {
  id: string;
  kind: ProjectBundle["devices"][number]["kind"];
  orientation: ProjectBundle["devices"][number]["orientation"];
  foldState?: ProjectBundle["devices"][number]["foldState"];
  path: string;
  sha256: string;
};

export type BundleManifest = {
  schemaVersion: 1;
  editorVersion: string;
  projectHash: string;
  devices: ManifestDevice[];
};

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * Builds a deterministic manifest for every device profile. It deliberately
 * has no timestamp so the same bundle and editor version produce the same
 * manifest bytes.
 */
export async function buildManifest(input: ProjectBundle): Promise<BundleManifest> {
  const bundle = normalizeBundle(input);
  const devices = await Promise.all(bundle.devices.map(async (device) => {
    const yaml = compileBundle(bundle, device.id);
    return {
      id: device.id,
      kind: device.kind,
      orientation: device.orientation,
      ...(device.foldState ? { foldState: device.foldState } : {}),
      path: `${device.id}/trime.yaml`,
      sha256: await sha256(yaml),
    };
  }));
  return {
    schemaVersion: 1,
    editorVersion: EDITOR_VERSION,
    projectHash: await sha256(JSON.stringify(portableBundle(bundle))),
    devices,
  };
}
