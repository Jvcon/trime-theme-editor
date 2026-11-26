import { describe, expect, it } from "vitest";
import YAML from "yaml";
import { compileBundle, defaultBundle } from "../src/authoring/compiler";
import { buildManifest, EDITOR_VERSION } from "../src/authoring/manifest";
import { BUILTIN_PRESETS } from "../src/authoring/presets";
import type { ProjectBundle } from "../src/authoring/types";
import pkg from "../package.json";

function matrixBundle(): ProjectBundle {
  const bundle = defaultBundle();
  const qwerty18 = BUILTIN_PRESETS.layouts.find((layout) => layout.id === "qwerty18");
  if (qwerty18) bundle.layouts.push(structuredClone(qwerty18));
  bundle.metrics = { keyHeight: 50, keyboardHeight: 260 };
  bundle.devices = [
    { id: "phone-portrait", kind: "phone", orientation: "portrait" },
    { id: "phone-landscape", kind: "phone", orientation: "landscape", metrics: { keyHeight: 40, keyboardHeight: 200 } },
    { id: "tablet-portrait", kind: "tablet", orientation: "portrait", mainLayoutId: "qwerty18" },
    { id: "fold-folded", kind: "fold", orientation: "portrait", foldState: "folded" },
    { id: "fold-unfolded", kind: "fold", orientation: "portrait", foldState: "unfolded" },
  ];
  bundle.schemaBindings = [
    { schemaId: "luna_pinyin", layoutId: "qwerty26" },
    { schemaId: "cangjie5", layoutId: "qwerty18", alias: "cangjie_keys" },
    { schemaId: "double_pinyin", layoutId: "qwerty26" },
  ];
  return bundle;
}

describe("device profiles", () => {
  it("applies per-device metric overrides", () => {
    const bundle = matrixBundle();
    const portrait = YAML.parse(compileBundle(bundle, "phone-portrait"));
    const landscape = YAML.parse(compileBundle(bundle, "phone-landscape"));
    expect(portrait.style.key_height).toBe(50);
    expect(portrait.style.keyboard_height).toBe(260);
    expect(landscape.style.key_height).toBe(40);
    expect(landscape.style.keyboard_height).toBe(200);
  });

  it("uses the device main layout override", () => {
    const bundle = matrixBundle();
    const tablet = YAML.parse(compileBundle(bundle, "tablet-portrait"));
    expect(tablet.preset_keys.Keyboard_main.select).toBe("qwerty18");
    expect(tablet.preset_keyboards.default.import_preset).toBe("qwerty18");
    expect(tablet.preset_keyboards.qwerty18).toBeTruthy();
  });

  it("compiles fold folded and unfolded profiles", () => {
    const bundle = matrixBundle();
    const folded = YAML.parse(compileBundle(bundle, "fold-folded"));
    const unfolded = YAML.parse(compileBundle(bundle, "fold-unfolded"));
    expect(folded.preset_keys.Keyboard_main.select).toBe("qwerty26");
    expect(unfolded.preset_keys.Keyboard_main.select).toBe("qwerty26");
  });

  it("is deterministic per device", () => {
    const bundle = matrixBundle();
    expect(compileBundle(bundle, "tablet-portrait")).toBe(compileBundle(bundle, "tablet-portrait"));
  });
});

describe("schema bindings", () => {
  it("emits alias keyboards with import_preset", () => {
    const bundle = matrixBundle();
    const tablet = YAML.parse(compileBundle(bundle, "tablet-portrait"));
    expect(tablet.preset_keyboards.cangjie_keys).toEqual({ import_preset: "qwerty18" });
    expect(tablet.preset_keyboards.schema_luna_pinyin).toEqual({ import_preset: "qwerty26" });
    expect(tablet.preset_keyboards.schema_double_pinyin).toEqual({ import_preset: "qwerty26" });
    expect(tablet.style.keyboards).toContain("cangjie_keys");
    expect(tablet.style.keyboards).toContain("schema_luna_pinyin");
    expect(tablet.style.keyboards).toContain("schema_double_pinyin");
  });

  it("keeps a layout that is only referenced by a schema binding", () => {
    const bundle = defaultBundle();
    const qwerty18 = BUILTIN_PRESETS.layouts.find((layout) => layout.id === "qwerty18");
    if (qwerty18) bundle.layouts.push(structuredClone(qwerty18));
    bundle.schemaBindings = [{ schemaId: "cangjie5", layoutId: "qwerty18" }];
    const yaml = YAML.parse(compileBundle(bundle));
    expect(yaml.preset_keyboards.schema_cangjie5).toEqual({ import_preset: "qwerty18" });
  });
});

describe("manifest", () => {
  it("uses the package version", () => {
    expect(EDITOR_VERSION).toBe(pkg.version);
  });

  it("lists every device with a deterministic sha256", async () => {
    const bundle = matrixBundle();
    const manifest = await buildManifest(bundle);
    expect(manifest.editorVersion).toBe(EDITOR_VERSION);
    expect(manifest.projectHash).toMatch(/^[0-9a-f]{64}$/);
    expect(manifest.devices.map((device) => device.id)).toEqual([
      "phone-portrait",
      "phone-landscape",
      "tablet-portrait",
      "fold-folded",
      "fold-unfolded",
    ]);
    expect(manifest.devices[0].path).toBe("phone-portrait/trime.yaml");
    expect(manifest.devices[0].sha256).toMatch(/^[0-9a-f]{64}$/);
    await expect(buildManifest(bundle)).resolves.toEqual(manifest);
  });
});
