import { describe, expect, it } from "vitest";
import YAML from "yaml";
import { blankBundle, compileBundle, templateBundle, stringifyTrime } from "../src/authoring/compiler";
import { normalizeBundle } from "../src/authoring/utils";

describe("compileBundle", () => {
  it("is deterministic for the same bundle", () => {
    const bundle = templateBundle();
    expect(compileBundle(bundle)).toBe(compileBundle(bundle));
  });

  it("is deterministic after a JSON round trip", () => {
    const bundle = templateBundle();
    const roundTripped = JSON.parse(JSON.stringify(bundle));
    expect(compileBundle(roundTripped)).toBe(compileBundle(bundle));
  });

  it("matches the committed golden output", async () => {
    const yaml = compileBundle(templateBundle());
    await expect(yaml).toMatchFileSnapshot("../fixtures/golden/default-26.yaml");
  });

  it("compiles only from the embedded theme", () => {
    const bundle = templateBundle();
    bundle.variant = "dark";
    bundle.theme.dark.tokens.primary = "#123456";
    expect(compileBundle(bundle)).toContain("0xFF123456");
  });

  it("compiles spacer slots as invisible width-only gaps", () => {
    const bundle = templateBundle();
    const layout = bundle.layouts[0];
    layout.rows[0].keys.push({ kind: "placeholder", width: 6.789 });
    const yaml = YAML.parse(compileBundle(bundle)) as {
      preset_keyboards: Record<string, { keys: Array<Record<string, unknown>> }>;
    };
    const spacer = yaml.preset_keyboards[layout.id].keys.find((key) => key.width === 6.789);
    expect(spacer).toEqual({ width: 6.789 });
  });

  it("normalizes legacy empty-click spacers into placeholders", () => {
    const bundle = templateBundle();
    const layout = bundle.layouts[0];
    layout.rows[0].keys.push({ style: "off", width: 6.789, click: { kind: "text", value: "" } });
    const normalized = normalizeBundle(bundle);
    const slot = normalized.layouts[0].rows[0].keys[normalized.layouts[0].rows[0].keys.length - 1];
    expect(slot).toEqual({ kind: "placeholder", width: 6.789 });
  });

  it("compiles an empty project without inventing a layout", () => {
    const yaml = YAML.parse(compileBundle(blankBundle())) as {
      preset_keyboards?: Record<string, unknown>;
      preset_keys?: Record<string, unknown>;
      style?: { keyboards?: string[] };
    };
    expect(yaml.preset_keyboards ?? {}).toEqual({});
    expect(yaml.preset_keys?.Keyboard_main).toBeUndefined();
    expect(yaml.style?.keyboards).toEqual([]);
  });

  it("keeps every embedded base in the ordered layout group", () => {
    const bundle = templateBundle();
    bundle.layouts.push({
      kind: "layout",
      id: "unused-builtin",
      name: "Unused built-in",
      version: 1,
      builtin: true,
      role: "number",
      rows: [],
    });
    const normalized = normalizeBundle(bundle);
    expect(normalized.layoutGroupIds).toEqual(["qwerty26", "number", "symbols", "unused-builtin"]);
    expect(normalized.defaultLayoutId).toBe("qwerty26");
    expect(normalized.layouts.map((layout) => layout.id)).toEqual(["qwerty26", "number", "symbols", "unused-builtin"]);

    const authored = normalizeBundle(templateBundle());
    authored.layouts.push({
      kind: "layout",
      id: "authored",
      name: "Authored",
      version: 1,
      builtin: false,
      role: "number",
      rows: [],
    });
    expect(normalizeBundle(authored).layoutGroupIds).toContain("authored");
  });

  it("remaps legacy page actions to the page cloned from that preset", () => {
    const bundle = templateBundle();
    const number = bundle.layouts.find((layout) => layout.id === "number");
    if (!number) throw new Error("missing number layout");
    const clone = { ...structuredClone(number), id: "custom-number-1700000000000", builtin: false };
    bundle.layouts = bundle.layouts.filter((layout) => layout.id !== "number");
    bundle.layouts.push(clone);
    bundle.layoutGroupIds = bundle.layoutGroupIds.map((id) => (id === "number" ? clone.id : id));

    const main = bundle.layouts.find((layout) => layout.id === "qwerty26");
    const key = main?.rows[0]?.keys[0];
    if (!key) throw new Error("missing qwerty26 key");
    key.click = { kind: "page", id: "number" };

    const normalized = normalizeBundle(bundle);
    expect(normalized.layouts.find((layout) => layout.id === clone.id)?.sourcePresetId).toBe("number");
    expect(normalized.layouts.find((layout) => layout.id === "qwerty26")?.rows[0].keys[0].click)
      .toEqual({ kind: "page", id: clone.id });
  });

  it("keeps compiled output stable when migrating a v3 document", () => {
    const v4 = templateBundle();
    const v3 = structuredClone(v4) as unknown as Record<string, unknown>;
    v3.schemaVersion = 3;
    v3.mainLayoutId = v4.defaultLayoutId;
    v3.pageIds = v4.layoutGroupIds.filter((id) => id !== v4.defaultLayoutId);
    delete v3.defaultLayoutId;
    delete v3.layoutGroupIds;
    v3.devices = v4.devices.map((device) => {
      const copy = { ...device, mainLayoutId: device.layoutId } as Record<string, unknown>;
      delete copy.layoutId;
      return copy;
    });
    v3.layouts = v4.layouts.map((layout) => {
      const copy = { ...layout, pageRole: layout.role } as Record<string, unknown>;
      delete copy.role;
      return copy;
    });
    expect(compileBundle(v3 as never)).toBe(compileBundle(v4));
  });

  it("migrates v3 mainLayoutId/pageIds into the v4 layout group", () => {
    const legacy = structuredClone(templateBundle()) as unknown as Record<string, unknown>;
    legacy.schemaVersion = 3;
    legacy.mainLayoutId = "qwerty26";
    legacy.pageIds = ["number", "symbols"];
    legacy.devices = [{ id: "phone", kind: "phone", orientation: "portrait", mainLayoutId: "qwerty26" }];
    delete legacy.layoutGroupIds;
    delete legacy.defaultLayoutId;
    const migrated = normalizeBundle(legacy as never);
    expect(migrated.schemaVersion).toBe(4);
    expect(migrated.defaultLayoutId).toBe("qwerty26");
    expect(migrated.layoutGroupIds).toEqual(["qwerty26", "number", "symbols"]);
    expect(migrated.devices[0]?.layoutId).toBe("qwerty26");
    expect(migrated.devices[0]).not.toHaveProperty("mainLayoutId");
    expect(migrated).not.toHaveProperty("mainLayoutId");
    expect(migrated).not.toHaveProperty("pageIds");
  });
});

describe("stringifyTrime", () => {
  it("sorts map keys independently of insertion order", () => {
    expect(stringifyTrime({ b: 1, a: 2 })).toBe(stringifyTrime({ a: 2, b: 1 }));
  });

  it("keeps array order", () => {
    expect(stringifyTrime({ keys: ["b", "a"] })).toContain("  - b\n  - a");
  });
});
