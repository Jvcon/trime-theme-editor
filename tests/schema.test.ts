import { describe, expect, it } from "vitest";
import { compileBundle, templateBundle } from "../src/authoring/compiler";
import { TRIME_SCHEMA_VERSION, validateTrimeObject, validateTrimeYaml } from "../src/authoring/schema";

describe("Trime schema validation", () => {
  it("pins the upstream schema version", () => {
    expect(TRIME_SCHEMA_VERSION).toBe("3.3.13");
  });

  it("accepts the default compiled output", () => {
    expect(validateTrimeYaml(compileBundle(templateBundle()))).toEqual([]);
  });

  it("rejects an invalid field type", () => {
    const issues = validateTrimeObject({ name: 123 });
    expect(issues.some((issue) => issue.path === "/name")).toBe(true);
  });

  it("reports YAML parse failures", () => {
    const issues = validateTrimeYaml("name: [");
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain("YAML 解析失败");
  });
});
