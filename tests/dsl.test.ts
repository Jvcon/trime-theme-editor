import { describe, expect, it } from "vitest";
import { expandThemeDsl, ThemeDslError } from "../src/authoring/dsl";

describe("expandThemeDsl", () => {
  it("expands local includes and recursively merges sibling mappings", () => {
    const root = {
      preset_keyboards: {
        base: { name: "Base", keys: [{ click: "a" }], style: { height: 44, gap: 1 } },
        alias: {
          __include: "/preset_keyboards/base",
          name: "Alias",
          style: { gap: 2 },
        },
      },
    };
    const expanded = expandThemeDsl(root, "trime") as { preset_keyboards: Record<string, any> };
    expect(expanded.preset_keyboards.alias.name).toBe("Alias");
    expect(expanded.preset_keyboards.alias.keys).toEqual([{ click: "a" }]);
    expect(expanded.preset_keyboards.alias.style).toEqual({ height: 44, gap: 2 });
  });

  it("applies __patch after __include", () => {
    const root = {
      preset_keyboards: {
        base: { name: "Base", keys: [], lock: true },
        patched: {
          __include: "/preset_keyboards/base",
          __patch: { lock: false, name: "Patched" },
        },
      },
    };
    const expanded = expandThemeDsl(root, "trime") as typeof root;
    expect(expanded.preset_keyboards.patched).toMatchObject({ name: "Patched", lock: false, keys: [] });
  });

  it("resolves external resources by file id", () => {
    const root = { __include: "extra:/preset_keyboards/base", extra_top: 1 };
    const expanded = expandThemeDsl(root, "main", {
      "extra.yaml": { preset_keyboards: { base: { name: "Extra", keys: [{ click: "x" }] } } },
    }) as Record<string, unknown>;
    expect(expanded.extra_top).toBe(1);
    expect(expanded.name).toBe("Extra");
    expect(expanded.keys).toEqual([{ click: "x" }]);
  });

  it("allows optional references that do not resolve", () => {
    const expanded = expandThemeDsl({ __include: "/missing?", keep: true }, "trime") as Record<string, unknown>;
    expect(expanded).toEqual({ keep: true });
  });

  it("reports circular references", () => {
    const root = {
      a: { __include: "/b" },
      b: { __include: "/a" },
    };
    expect(() => expandThemeDsl(root, "trime")).toThrow(ThemeDslError);
    try {
      expandThemeDsl(root, "trime");
    } catch (error) {
      expect((error as ThemeDslError).kind).toBe("unresolved");
    }
  });

  it("rejects unsupported directives", () => {
    expect(() => expandThemeDsl({ __merge: {} }, "trime")).toThrow(ThemeDslError);
  });
});
