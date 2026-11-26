import { describe, expect, it } from "vitest";
import YAML from "yaml";
import { compileBundle, defaultBundle, stringifyTrime } from "../src/authoring/compiler";
import { normalizeBundle } from "../src/authoring/utils";

describe("compileBundle", () => {
  it("is deterministic for the same bundle", () => {
    const bundle = defaultBundle();
    expect(compileBundle(bundle)).toBe(compileBundle(bundle));
  });

  it("is deterministic after a JSON round trip", () => {
    const bundle = defaultBundle();
    const roundTripped = JSON.parse(JSON.stringify(bundle));
    expect(compileBundle(roundTripped)).toBe(compileBundle(bundle));
  });

  it("matches the committed golden output", async () => {
    const yaml = compileBundle(defaultBundle());
    await expect(yaml).toMatchFileSnapshot("../fixtures/golden/default-26.yaml");
  });

  it("compiles only from the embedded theme", () => {
    const bundle = defaultBundle();
    bundle.variant = "dark";
    bundle.theme.dark.tokens.primary = "#123456";
    expect(compileBundle(bundle)).toContain("0xFF123456");
  });

  it("compiles spacer slots as invisible width-only gaps", () => {
    const bundle = defaultBundle();
    const layout = bundle.layouts[0];
    layout.rows[0].keys.push({ kind: "placeholder", width: 6.789 });
    const yaml = YAML.parse(compileBundle(bundle)) as {
      preset_keyboards: Record<string, { keys: Array<Record<string, unknown>> }>;
    };
    const spacer = yaml.preset_keyboards[layout.id].keys.find((key) => key.width === 6.789);
    expect(spacer).toEqual({ width: 6.789 });
  });

  it("normalizes legacy empty-click spacers into placeholders", () => {
    const bundle = defaultBundle();
    const layout = bundle.layouts[0];
    layout.rows[0].keys.push({ style: "off", width: 6.789, click: { kind: "text", value: "" } });
    const normalized = normalizeBundle(bundle);
    const slot = normalized.layouts[0].rows[0].keys[normalized.layouts[0].rows[0].keys.length - 1];
    expect(slot).toEqual({ kind: "placeholder", width: 6.789 });
  });

  it("prunes unused built-in layouts but keeps authored ones", () => {
    const bundle = defaultBundle();
    bundle.layouts.push({
      kind: "layout",
      id: "unused-builtin",
      name: "Unused built-in",
      version: 1,
      builtin: true,
      pageRole: "number",
      rows: [],
    });
    const normalized = normalizeBundle(bundle);
    expect(normalized.layouts.map((layout) => layout.id)).toEqual(["qwerty26", "number", "symbols"]);
    expect(normalized.pageIds).toEqual(["number", "symbols"]);

    const authored = normalizeBundle(defaultBundle());
    authored.layouts.push({
      kind: "layout",
      id: "authored",
      name: "Authored",
      version: 1,
      builtin: false,
      pageRole: "number",
      rows: [],
    });
    expect(normalizeBundle(authored).layouts.map((layout) => layout.id)).toContain("authored");
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
