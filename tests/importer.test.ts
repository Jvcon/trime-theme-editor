import { describe, expect, it } from "vitest";
import { compileBundle } from "../src/authoring/compiler";
import { importTrimeYaml } from "../src/authoring/importer";

const SOURCE = `
name: Imported Theme
author: Tester
config_version: "3.0"
preset_color_schemes:
  light:
    back_color: 0xFFF8F8F2
    text_color: 0xFF282A36
    key_back_color: 0xFFFFFFFF
  dark:
    back_color: 0xFF282A36
    text_color: 0xFFF8F8F2
    key_back_color: 0xFF44475A
preset_keyboards:
  default:
    name: Test Keyboard
    keys:
      - { click: a, width: 50, label: A }
      - { click: b, width: 50, label: B }
preset_keys:
  macro_hello:
    text: hello
    label: Hello
`;

describe("importTrimeYaml", () => {
  it("returns a v2 bundle with embedded presets", () => {
    const { project } = importTrimeYaml(SOURCE, "trime.yaml");
    expect(project.format).toBe("trime-theme-bundle");
    expect(project.schemaVersion).toBe(2);
    expect(project.theme.id).toContain("imported-card");
    expect(project.layouts.map((layout) => layout.id)).toContain(project.mainLayoutId);
    expect(project.macros.map((macro) => macro.id)).toContain("macro_hello");
  });

  it("compiles the imported bundle without built-in presets", () => {
    const { project } = importTrimeYaml(SOURCE, "trime.yaml");
    const yaml = compileBundle(project);
    expect(yaml).toContain("name: Imported Theme");
    expect(yaml).toContain("macro_hello");
    expect(yaml).toContain("preset_keyboards:");
  });
});
