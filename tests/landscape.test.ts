import { describe, expect, it } from "vitest";
import YAML from "yaml";
import { compileBundle, defaultBundle } from "../src/authoring/compiler";
import { BUILTIN_PRESETS } from "../src/authoring/presets";
import { resolveLayoutForDevice } from "../src/authoring/resolve";
import { validateTrimeYaml } from "../src/authoring/schema";
import { validateProject } from "../src/authoring/validation";
import type { ProjectBundle } from "../src/authoring/types";
import { addLandscapeVariant, normalizeBundle, pruneBundleLayouts, removeLandscapeVariant } from "../src/authoring/utils";

function landscapeBundle(): ProjectBundle {
  const bundle = defaultBundle();
  const base = bundle.layouts.find((layout) => layout.id === "qwerty26");
  if (!base) throw new Error("missing qwerty26");
  const variant = structuredClone(base);
  variant.id = "qwerty26-landscape";
  variant.name = "qwerty26 · 横屏";
  variant.builtin = false;
  variant.rows = variant.rows.slice(0, -1);
  bundle.layouts.push(variant);
  base.landscapeId = variant.id;
  bundle.devices = [
    { id: "phone-portrait", kind: "phone", orientation: "portrait" },
    { id: "phone-landscape", kind: "phone", orientation: "landscape" },
  ];
  return bundle;
}

describe("landscape layout variants", () => {
  it("resolves the base layout for portrait devices", () => {
    const bundle = landscapeBundle();
    const layout = resolveLayoutForDevice(bundle, bundle.devices[0]);
    expect(layout?.id).toBe("qwerty26");
  });

  it("resolves the nearest variant for landscape devices", () => {
    const bundle = landscapeBundle();
    const layout = resolveLayoutForDevice(bundle, bundle.devices[1]);
    expect(layout?.id).toBe("qwerty26-landscape");
    expect(layout?.rows).toHaveLength(3);
  });

  it("compiles the variant into default and Keyboard_main", () => {
    const bundle = landscapeBundle();
    const yaml = YAML.parse(compileBundle(bundle, "phone-landscape"));
    expect(yaml.preset_keys.Keyboard_main.select).toBe("qwerty26-landscape");
    expect(yaml.preset_keyboards.default.import_preset).toBe("qwerty26-landscape");
    expect(yaml.preset_keyboards["qwerty26-landscape"]).toBeTruthy();
    expect(yaml.style.keyboards).toContain("qwerty26-landscape");
  });

  it("produces schema-valid landscape output", () => {
    const yaml = compileBundle(landscapeBundle(), "phone-landscape");
    expect(validateTrimeYaml(yaml)).toEqual([]);
  });

  it("points schema aliases at the variant for landscape devices", () => {
    const bundle = landscapeBundle();
    bundle.schemaBindings = [{ schemaId: "luna_pinyin", layoutId: "qwerty26" }];
    const portrait = YAML.parse(compileBundle(bundle, "phone-portrait"));
    const landscape = YAML.parse(compileBundle(bundle, "phone-landscape"));
    expect(portrait.preset_keyboards.schema_luna_pinyin.import_preset).toBe("qwerty26");
    expect(landscape.preset_keyboards.schema_luna_pinyin.import_preset).toBe("qwerty26-landscape");
  });

  it("falls back to the base layout and warns when no variant exists", () => {
    const bundle = landscapeBundle();
    const base = bundle.layouts.find((layout) => layout.id === "qwerty26");
    if (base) delete base.landscapeId;
    const yaml = YAML.parse(compileBundle(bundle, "phone-landscape"));
    expect(yaml.preset_keys.Keyboard_main.select).toBe("qwerty26");

    const issues = validateProject(bundle);
    expect(issues.some((issue) => issue.level === "warning" && issue.area === "devices" && issue.message.includes("没有横屏变体"))).toBe(true);
    expect(issues.some((issue) => issue.level === "error")).toBe(false);
  });

  it("keeps variants through pruning", () => {
    const bundle = landscapeBundle();
    const normalized = normalizeBundle(bundle);
    expect(normalized.layouts.map((layout) => layout.id)).toContain("qwerty26-landscape");
    pruneBundleLayouts(normalized);
    expect(normalized.layouts.map((layout) => layout.id)).toContain("qwerty26-landscape");
  });

  it("drops dangling landscape ids during normalization", () => {
    const bundle = landscapeBundle();
    const base = bundle.layouts.find((layout) => layout.id === "qwerty26");
    if (base) base.landscapeId = "missing-layout";
    const normalized = normalizeBundle(bundle);
    expect(normalized.layouts.find((layout) => layout.id === "qwerty26")?.landscapeId).toBeUndefined();
  });

  it("reports a nested variant as a warning, not an error", () => {
    const bundle = landscapeBundle();
    const variant = bundle.layouts.find((layout) => layout.id === "qwerty26-landscape");
    if (variant) variant.landscapeId = "qwerty26";
    const issues = validateProject(bundle);
    expect(issues.some((issue) => issue.level === "warning" && issue.message.includes("只解析一层"))).toBe(true);
    expect(issues.some((issue) => issue.level === "error")).toBe(false);
  });
});

describe("variant authoring helpers", () => {  it("creates a variant, keeps it through pruning, and removes it cleanly", () => {
    const bundle = defaultBundle();
    const base = bundle.layouts.find((layout) => layout.id === "qwerty26");
    if (!base) throw new Error("missing qwerty26");
    const builtin = BUILTIN_PRESETS.layouts.find((layout) => layout.id === "qwerty26");
    const catalogSnapshot = JSON.stringify(builtin);

    const id = addLandscapeVariant(bundle, builtin ?? base);
    expect(id).toBe("qwerty26-landscape");
    expect(bundle.layouts.find((layout) => layout.id === "qwerty26")?.landscapeId).toBe(id);
    expect(JSON.stringify(BUILTIN_PRESETS.layouts.find((layout) => layout.id === "qwerty26"))).toBe(catalogSnapshot);

    pruneBundleLayouts(bundle);
    expect(bundle.layouts.some((layout) => layout.id === id)).toBe(true);

    const owner = removeLandscapeVariant(bundle, id ?? "");
    expect(owner).toBe("qwerty26");
    expect(bundle.layouts.some((layout) => layout.id === id)).toBe(false);
    expect(bundle.layouts.find((layout) => layout.id === "qwerty26")?.landscapeId).toBeUndefined();
  });

  it("suffixes duplicate variant ids instead of clashing", () => {
    const bundle = defaultBundle();
    const base = bundle.layouts.find((layout) => layout.id === "qwerty26");
    if (!base) throw new Error("missing qwerty26");
    const first = addLandscapeVariant(bundle, base);
    const second = addLandscapeVariant(bundle, base);
    expect(first).toBe("qwerty26-landscape");
    expect(second).toBe("qwerty26-landscape-2");
    expect(bundle.layouts.map((layout) => layout.id)).toContain("qwerty26-landscape-2");
  });
});

describe("layout retention when switching the main layout", () => {
  function customizedMain() {
    const bundle = defaultBundle();
    const base = bundle.layouts.find((layout) => layout.id === "qwerty26");
    if (!base) throw new Error("missing qwerty26");
    const custom = {
      ...structuredClone(base),
      id: "custom-qwerty26",
      name: "26 键（自定义）",
      builtin: false,
    };
    custom.rows[0].height = 61;
    bundle.layouts = bundle.layouts.filter((layout) => layout.id !== "qwerty26");
    bundle.layouts.push(custom);
    bundle.mainLayoutId = custom.id;
    const qwerty18 = BUILTIN_PRESETS.layouts.find((layout) => layout.id === "qwerty18");
    if (qwerty18) bundle.layouts.push(structuredClone(qwerty18));
    bundle.mainLayoutId = "qwerty18";
    return bundle;
  }

  it("keeps the previous customized main instead of pruning it", () => {
    const bundle = customizedMain();
    pruneBundleLayouts(bundle);
    const custom = bundle.layouts.find((layout) => layout.id === "custom-qwerty26");
    expect(custom?.rows[0]?.height).toBe(61);
    expect(bundle.mainLayoutId).toBe("qwerty18");
  });

  it("survives normalization and a JSON round trip", () => {
    const bundle = customizedMain();
    const normalized = normalizeBundle(bundle);
    expect(normalized.layouts.some((layout) => layout.id === "custom-qwerty26")).toBe(true);
    const roundTripped = normalizeBundle(JSON.parse(JSON.stringify(normalized)));
    expect(roundTripped.layouts.some((layout) => layout.id === "custom-qwerty26")).toBe(true);
  });

  it("still prunes unused built-in layouts", () => {
    const bundle = defaultBundle();
    const qwerty18 = BUILTIN_PRESETS.layouts.find((layout) => layout.id === "qwerty18");
    if (qwerty18) bundle.layouts.push(structuredClone(qwerty18));
    pruneBundleLayouts(bundle);
    expect(bundle.layouts.some((layout) => layout.id === "qwerty18")).toBe(false);
  });

  it("keeps a built-in base that owns an authored landscape variant", () => {
    const bundle = defaultBundle();
    const base = bundle.layouts.find((layout) => layout.id === "qwerty26");
    if (!base) throw new Error("missing qwerty26");
    const variantId = addLandscapeVariant(bundle, base);
    const qwerty18 = BUILTIN_PRESETS.layouts.find((layout) => layout.id === "qwerty18");
    if (qwerty18) bundle.layouts.push(structuredClone(qwerty18));
    bundle.mainLayoutId = "qwerty18";
    pruneBundleLayouts(bundle);
    expect(bundle.layouts.some((layout) => layout.id === "qwerty26")).toBe(true);
    expect(bundle.layouts.some((layout) => layout.id === variantId)).toBe(true);
  });
});
