import { describe, expect, it } from "vitest";
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
    bundle.theme.variants.dark.tokens.primary = "#123456";
    expect(compileBundle(bundle)).toContain("0xFF123456");
  });

  it("keeps only the main layout and referenced pages", () => {
    const bundle = defaultBundle();
    bundle.layouts.push({
      kind: "layout",
      id: "unused",
      name: "Unused",
      version: 1,
      builtin: false,
      pageRole: "number",
      rows: [],
    });
    const normalized = normalizeBundle(bundle);
    expect(normalized.layouts.map((layout) => layout.id)).toEqual(["qwerty26", "number", "symbols"]);
    expect(normalized.pageIds).toEqual(["number", "symbols"]);
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
