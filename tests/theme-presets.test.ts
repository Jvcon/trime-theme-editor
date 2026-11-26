import { describe, expect, it } from "vitest";
import YAML from "yaml";
import { compileBundle, defaultBundle } from "../src/authoring/compiler";
import { BUILTIN_PRESETS } from "../src/authoring/presets";
import { normalizeBundle, REQUIRED_THEME_TOKENS } from "../src/authoring/utils";

const card = (id: string) => {
  const found = BUILTIN_PRESETS.themeCards.find((item) => item.id === id);
  if (!found) throw new Error(`missing theme card: ${id}`);
  return found;
};

describe("built-in theme cards", () => {
  it("ships the upstream palettes as independent single-scheme cards", () => {
    const ids = BUILTIN_PRESETS.themeCards.map((item) => item.id);
    expect(ids).toEqual(expect.arrayContaining([
      "dracula", "alucard",
      "catppuccin-latte", "catppuccin-frappe", "catppuccin-macchiato", "catppuccin-mocha",
      "solarized-light", "solarized-dark",
      "material-light", "material-dark",
      "nord-light", "nord-dark",
    ]));
    for (const item of BUILTIN_PRESETS.themeCards) {
      expect(item).not.toHaveProperty("variants");
      expect(item.builtin).toBe(true);
      for (const token of REQUIRED_THEME_TOKENS) {
        expect(item.tokens[token]).toMatch(/^#[0-9a-fA-F]{6}$/);
      }
      expect(item.states.hover.surface).toBe(item.tokens.surfaceAlt);
      expect(item.states.pressed.surface).toBe(item.tokens.primary);
      expect(item.states.disabled.text).toBe(item.tokens.textMuted);
    }
  });

  it("uses the official Dracula, Catppuccin, and Solarized key colors", () => {
    expect(card("dracula").tokens).toMatchObject({
      bg: "#282a36", surface: "#44475a", text: "#f8f8f2", primary: "#bd93f9", accent: "#ff79c6",
    });
    expect(card("alucard").tokens).toMatchObject({
      bg: "#fffbeb", text: "#1f1f1f", primary: "#644ac9", accent: "#a3144d",
    });
    expect(card("catppuccin-latte").tokens).toMatchObject({
      bg: "#dce0e8", surface: "#eff1f5", text: "#4c4f69", primary: "#8839ef",
    });
    expect(card("catppuccin-mocha").tokens).toMatchObject({
      bg: "#11111b", surface: "#1e1e2e", text: "#cdd6f4", primary: "#cba6f7",
    });
    expect(card("solarized-dark").tokens).toMatchObject({
      bg: "#002b36", surface: "#073642", text: "#93a1a1", primary: "#268bd2",
    });
    expect(card("solarized-light").tokens).toMatchObject({
      bg: "#fdf6e3", surface: "#eee8d5", text: "#657b83", primary: "#268bd2",
    });
  });
});

describe("light/dark theme selection", () => {
  it("compiles the selected light and dark cards independently", () => {
    const bundle = defaultBundle();
    bundle.theme.light = structuredClone(card("catppuccin-latte"));
    bundle.theme.dark = structuredClone(card("catppuccin-mocha"));
    const yaml = YAML.parse(compileBundle(bundle)) as {
      preset_color_schemes: Record<string, { back_color: string; name: string }>;
    };
    expect(yaml.preset_color_schemes.light.back_color).toBe("0xFFDCE0E8");
    expect(yaml.preset_color_schemes.light.name).toBe("Catppuccin Latte");
    expect(yaml.preset_color_schemes.dark.back_color).toBe("0xFF11111B");
    expect(yaml.preset_color_schemes.dark.name).toBe("Catppuccin Mocha");
  });

  it("does not let a light edit change the dark scheme", () => {
    const bundle = defaultBundle();
    bundle.theme.dark = structuredClone(card("solarized-dark"));
    bundle.theme.light.tokens.bg = "#123456";
    const yaml = YAML.parse(compileBundle(bundle)) as {
      preset_color_schemes: Record<string, { back_color: string }>;
    };
    expect(yaml.preset_color_schemes.light.back_color).toBe("0xFF123456");
    expect(yaml.preset_color_schemes.dark.back_color).toBe("0xFF002B36");
  });

  it("emits only Trime-supported style keys into color schemes", () => {
    const bundle = defaultBundle();
    bundle.keyStyles["custom-1"] = {
      id: "custom-1",
      name: "Custom",
      background: "accent",
      text: "onPrimary",
    };
    const yaml = YAML.parse(compileBundle(bundle)) as {
      preset_color_schemes: Record<string, Record<string, string>>;
    };
    for (const scheme of [yaml.preset_color_schemes.light, yaml.preset_color_schemes.dark]) {
      expect(scheme.key_back_color).toBeTruthy();
      expect(scheme.off_key_back_color).toBeTruthy();
      for (const key of [
        "modifier_back_color",
        "enter_back_color",
        "space_back_color",
        "style_custom_1_back_color",
      ]) {
        expect(scheme).not.toHaveProperty(key);
      }
    }
  });
});

describe("v2 theme migration", () => {
  it("splits legacy variants and keeps built-in values", () => {
    const legacy = structuredClone(defaultBundle()) as unknown as Record<string, unknown>;
    legacy.schemaVersion = 2;
    legacy.theme = {
      kind: "theme-card",
      id: "legacy",
      name: "Legacy",
      version: 1,
      builtin: true,
      variants: {
        light: { tokens: structuredClone(card("alucard").tokens), states: structuredClone(card("alucard").states) },
        dark: { tokens: structuredClone(card("dracula").tokens), states: structuredClone(card("dracula").states) },
      },
    };
    delete legacy.customThemeCards;

    const normalized = normalizeBundle(legacy as never);
    expect(normalized.schemaVersion).toBe(3);
    expect(normalized.theme.light.id).toBe("alucard");
    expect(normalized.theme.light.builtin).toBe(true);
    expect(normalized.theme.dark.id).toBe("dracula");
    expect(normalized.theme.dark.builtin).toBe(true);
    expect(normalized.customThemeCards).toEqual([]);
  });

  it("keeps selected custom cards in the project library", () => {
    const bundle = defaultBundle();
    bundle.theme.light = {
      ...structuredClone(card("alucard")),
      id: "custom-light",
      name: "Mine",
      builtin: false,
    };
    delete bundle.customThemeCards;
    const normalized = normalizeBundle(bundle);
    expect(normalized.customThemeCards?.map((item) => item.id)).toContain("custom-light");
    expect(normalized.customThemeCards?.find((item) => item.id === "custom-light")?.name).toBe("Mine");
  });

  it("preserves edited legacy variants as custom cards", () => {
    const legacy = structuredClone(defaultBundle()) as unknown as Record<string, unknown>;
    legacy.schemaVersion = 2;
    legacy.theme = {
      kind: "theme-card",
      id: "legacy",
      name: "Legacy",
      version: 1,
      builtin: true,
      variants: {
        light: {
          tokens: { ...structuredClone(card("alucard").tokens), primary: "#123456" },
          states: structuredClone(card("alucard").states),
        },
        dark: { tokens: structuredClone(card("dracula").tokens), states: structuredClone(card("dracula").states) },
      },
    };
    delete legacy.customThemeCards;

    const normalized = normalizeBundle(legacy as never);
    expect(normalized.theme.light.id).toBe("split-legacy-light");
    expect(normalized.theme.light.builtin).toBe(false);
    expect(normalized.theme.light.tokens.primary).toBe("#123456");
    expect(normalized.customThemeCards?.map((item) => item.id)).toContain("split-legacy-light");
    expect(normalizeBundle(normalized)).toEqual(normalized);
  });
});
