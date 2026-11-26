import Ajv from "ajv";
import YAML from "yaml";
import trimeSchema from "../../fixtures/trime/trime-schema.json";

/** Trime release the bundled schema and fixtures are pinned to. */
export const TRIME_SCHEMA_VERSION = "3.3.13";

export type SchemaIssue = {
  path: string;
  message: string;
};

const ajv = new Ajv({ allErrors: true, strict: false });
const validateTrime = ajv.compile(trimeSchema);

export function validateTrimeObject(doc: unknown): SchemaIssue[] {
  if (validateTrime(doc)) return [];
  return (validateTrime.errors ?? []).slice(0, 50).map((error) => ({
    path: error.instancePath || "/",
    message: error.message ?? "invalid value",
  }));
}

export function validateTrimeYaml(source: string): SchemaIssue[] {
  try {
    return validateTrimeObject(YAML.parse(source));
  } catch (error) {
    return [{ path: "/", message: `YAML 解析失败：${error instanceof Error ? error.message : String(error)}` }];
  }
}
