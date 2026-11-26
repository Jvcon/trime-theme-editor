import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import YAML from "yaml";
import { compileBundle } from "../src/authoring/compiler";
import { importTrimeYaml } from "../src/authoring/importer";
import { validateTrimeYaml } from "../src/authoring/schema";

function fixture(name: string): string {
  return readFileSync(new URL(`../fixtures/trime/${name}`, import.meta.url), "utf8");
}

const PASSTHROUGH_SOURCE = `
name: Passthrough Theme
author: Tester
config_version: "3.0"
custom_top: hello
style:
  key_height: 44
  custom_style_metric: 7
window:
  custom_window_flag: true
  insets: { vertical: 2, horizontal: 3, custom_inset: 1 }
preedit:
  custom_preedit: 9
tool_bar:
  custom_toolbar: 1
  buttons:
    - action: menu_keyboard
      custom_button: 2
      background: { normal: x, custom_bg: 3 }
liquid_keyboard:
  custom_liquid: 4
preset_color_schemes:
  light:
    back_color: 0xFF000000
    text_color: 0xFFFFFFFF
    custom_scheme: 1
  dark:
    back_color: 0xFF111111
    text_color: 0xFFEEEEEE
    custom_scheme: 2
fallback_colors:
  custom_fallback: custom_top
preset_keyboards:
  default:
    name: Test
    lock: true
    custom_layout: 5
    keys:
      - { click: a, width: 20, key_back_color: "bh1", key_text_color: "th1", custom_key: 6 }
      - { click: b, width: 20, key_text_size: 18 }
preset_keys:
  macro_hello:
    text: hello
    label: Hello
    custom_preset: 7
`;

describe("lossless import", () => {
  it("imports the upstream trime.yaml with local __include entries", () => {
    const result = importTrimeYaml(fixture("trime.yaml"), "trime.yaml");
    expect(result.report.mapped.length).toBeGreaterThan(0);
    expect(result.project.layouts.length).toBeGreaterThan(10);
    expect(result.project.layouts.some((layout) => layout.id === "letter")).toBe(true);
    expect(result.project.layouts.some((layout) => layout.id === "scj6")).toBe(true);

    const defaultLayout = result.project.layouts.find((layout) => layout.id === "default");
    const firstKey = defaultLayout?.rows[0]?.keys[0];
    expect(firstKey?.click?.kind).toBe("char");
    expect(firstKey?.long_click?.kind).toBe("char");

    const yaml = YAML.parse(compileBundle(result.project));
    expect(yaml.preset_keyboards.letter).toBeTruthy();
    expect(yaml.preset_keyboards.scj6).toBeTruthy();
    expect(Object.keys(yaml.preset_color_schemes).length).toBeGreaterThan(2);
    expect(result.project.macros.some((macro) => macro.token === "BRIGHTNESS_DOWN")).toBe(true);
    expect(yaml.preset_keys.BRIGHTNESS_DOWN).toBeTruthy();
    expect(validateTrimeYaml(compileBundle(result.project))).toEqual([]);
  });

  it("imports tongwenfeng.trime.yaml without dropping key-level fields", () => {
    const result = importTrimeYaml(fixture("tongwenfeng.trime.yaml"), "tongwenfeng.trime.yaml");
    expect(result.project.layouts.length).toBeGreaterThan(10);
    const colored = result.project.layouts
      .flatMap((layout) => layout.rows.flatMap((row) => row.keys))
      .find((key) => key.key_back_color);
    expect(colored?.key_back_color).toBeTruthy();
    expect(() => compileBundle(result.project)).not.toThrow();
    // The upstream tongwenfeng fixture uses a scalar button_font while the
    // pinned schema expects an array; validation should surface it.
    const issues = validateTrimeYaml(compileBundle(result.project));
    expect(issues.some((issue) => issue.path === "/tool_bar/button_font")).toBe(true);
  });

  it("preserves unmodelled fields through passthrough and keeps row widths", () => {
    const result = importTrimeYaml(PASSTHROUGH_SOURCE, "passthrough.yaml");
    expect(result.report.passthrough.length).toBeGreaterThan(0);

    const yaml = YAML.parse(compileBundle(result.project));
    expect(yaml.custom_top).toBe("hello");
    expect(yaml.style.custom_style_metric).toBe(7);
    expect(yaml.window.custom_window_flag).toBe(true);
    expect(yaml.window.insets.custom_inset).toBe(1);
    expect(yaml.preedit.custom_preedit).toBe(9);
    expect(yaml.tool_bar.custom_toolbar).toBe(1);
    expect(yaml.tool_bar.buttons[0].custom_button).toBe(2);
    expect(yaml.tool_bar.buttons[0].background.custom_bg).toBe(3);
    expect(yaml.liquid_keyboard.custom_liquid).toBe(4);
    expect(yaml.preset_color_schemes.light.custom_scheme).toBe(1);
    expect(yaml.fallback_colors.custom_fallback).toBe("custom_top");
    expect(yaml.preset_keyboards.default.custom_layout).toBe(5);
    expect(yaml.preset_keyboards.default.lock).toBe(true);
    expect(yaml.preset_keyboards.default.keys[0].width).toBe(20);
    expect(yaml.preset_keyboards.default.keys[0].key_back_color).toBe("bh1");
    expect(yaml.preset_keyboards.default.keys[0].key_text_color).toBe("th1");
    expect(yaml.preset_keyboards.default.keys[0].custom_key).toBe(6);
    expect(yaml.preset_keyboards.default.keys[1].key_text_size).toBe(18);
    expect(yaml.preset_keys.macro_hello.custom_preset).toBe(7);
  });

  it("resolves external includes from multi-file input", () => {
    const source = `
name: Multi
preset_color_schemes:
  light: { back_color: 0xFF000000 }
  dark: { back_color: 0xFF111111 }
preset_keyboards:
  default:
    __include: "extra:/preset_keyboards/base"
    name: Main
`;
    const resources = {
      "extra.yaml": `
preset_keyboards:
  base:
    keys:
      - { click: a, width: 100 }
`,
    };
    const result = importTrimeYaml(source, "trime.yaml", {}, resources);
    const yaml = YAML.parse(compileBundle(result.project));
    expect(result.project.defaultLayoutId).toBe("default");
    expect(yaml.preset_keyboards.qwerty26).toBeUndefined();
    expect(yaml.preset_keyboards.default.keys[0].click).toBe("a");
  });

  it("reports DSL failures instead of silently dropping them", () => {
    const source = `
name: Broken
preset_keyboards:
  default:
    __include: "missing:/foo"
`;
    const result = importTrimeYaml(source, "broken.yaml");
    expect(result.report.needsReview.some((entry) => entry.includes("DSL 展开失败"))).toBe(true);
  });
});
