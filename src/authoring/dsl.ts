/**
 * Expands the subset of the librime config DSL used by Trime themes.
 *
 * Supported:
 * - `__include: /local/path`
 * - `__include: file[.yaml]:/path`
 * - trailing `?` on an include/patch reference to mark it optional
 * - sibling keys overriding an included mapping (recursive mapping merge)
 * - `__patch: /path` and `__patch: { key: value }`
 *
 * Anything outside this subset raises [ThemeDslError] instead of guessing,
 * so the import report can surface it as "needs review".
 */

export type ResourceMap = Record<string, unknown>;

export class ThemeDslError extends Error {
  readonly kind: "unsupported" | "unresolved";

  constructor(message: string, kind: "unsupported" | "unresolved") {
    super(message);
    this.name = "ThemeDslError";
    this.kind = kind;
  }
}

type Dict = Record<string, unknown>;

type Context = {
  resources: Map<string, unknown>;
  expanding: Set<string>;
  expandNode: (node: unknown, resourceId: string, root: unknown) => unknown;
  reference: (value: unknown, resourceId: string, root: unknown) => unknown;
};

function isDict(value: unknown): value is Dict {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeResourceId(id: string): string {
  return id.replace(/\.ya?ml$/i, "");
}

function checkPlainKey(key: string): void {
  if (key.startsWith("__") && key !== "__include" && key !== "__patch") {
    throw new ThemeDslError(`unsupported directive '${key}'`, "unsupported");
  }
  if (key.includes("/") || key.endsWith("+") || key.endsWith("=")) {
    throw new ThemeDslError(`unsupported patch path '${key}'`, "unsupported");
  }
}

function findLocal(root: unknown, path: string): unknown {
  let current: unknown = root;
  for (const segment of path.split("/")) {
    if (!segment) continue;
    if (isDict(current)) {
      current = current[segment];
    } else if (Array.isArray(current)) {
      const index = Number(segment);
      current = Number.isInteger(index) ? current[index] : undefined;
    } else {
      return undefined;
    }
    if (current === undefined) return undefined;
  }
  return current;
}

function mergeMaps(base: Dict, overrides: Dict): Dict {
  const merged: Dict = { ...base };
  for (const [key, value] of Object.entries(overrides)) {
    // librime leaves the included node untouched for a key without a value.
    if (value === null || value === undefined) continue;
    const existing = merged[key];
    if (isDict(existing) && isDict(value)) {
      merged[key] = mergeMaps(existing, value);
    } else if (isDict(value) && existing !== undefined && existing !== null && !isDict(existing)) {
      throw new ThemeDslError(`cannot merge a mapping into the non-mapping sibling key '${key}'`, "unsupported");
    } else {
      merged[key] = value;
    }
  }
  return merged;
}

function applyPatch(
  base: unknown,
  patch: unknown,
  ctx: Context,
  resourceId: string,
  root: unknown,
): unknown {
  let patchMap: Dict;
  if (isDict(patch)) {
    patchMap = patch;
  } else if (typeof patch === "string") {
    const target = ctx.reference(patch, resourceId, root);
    if (target === undefined) return base;
    if (!isDict(target)) throw new ThemeDslError("'__patch' target is not a mapping", "unsupported");
    patchMap = target;
  } else {
    throw new ThemeDslError("unsupported '__patch' value", "unsupported");
  }
  if (!isDict(base)) throw new ThemeDslError("cannot '__patch' a non-mapping node", "unsupported");
  const patched: Dict = { ...base };
  for (const [key, value] of Object.entries(patchMap)) {
    checkPlainKey(key);
    patched[key] = ctx.expandNode(value, resourceId, root);
  }
  return patched;
}

export function expandThemeDsl(root: unknown, resourceId = "theme", resources: ResourceMap = {}): unknown {
  const map = new Map<string, unknown>();
  for (const [id, value] of Object.entries(resources)) {
    map.set(normalizeResourceId(id), value);
  }
  map.set(normalizeResourceId(resourceId), root);

  const ctx: Context = {
    resources: map,
    expanding: new Set<string>(),
    expandNode: (node, currentId, currentRoot) => expandNode(node, currentId, currentRoot, ctx),
    reference: (value, currentId, currentRoot) => reference(value, currentId, currentRoot, ctx),
  };
  return ctx.expandNode(root, normalizeResourceId(resourceId), root);
}

function expandNode(node: unknown, resourceId: string, root: unknown, ctx: Context): unknown {
  if (Array.isArray(node)) {
    return node.map((item) => ctx.expandNode(item, resourceId, root));
  }
  if (!isDict(node)) return node;

  const include = node.__include;
  const patch = node.__patch;
  const overrides: Dict = {};
  for (const [key, value] of Object.entries(node)) {
    if (key === "__include" || key === "__patch") continue;
    checkPlainKey(key);
    overrides[key] = ctx.expandNode(value, resourceId, root);
  }

  let result: unknown = overrides;
  if (include !== undefined) {
    const included = ctx.reference(include, resourceId, root);
    if (included !== undefined) {
      if (Object.keys(overrides).length === 0) {
        result = included;
      } else if (isDict(included)) {
        result = mergeMaps(included, overrides);
      } else {
        throw new ThemeDslError("cannot merge sibling keys into a non-mapping '__include' target", "unsupported");
      }
    }
  }
  if (patch !== undefined) {
    result = applyPatch(result, patch, ctx, resourceId, root);
  }
  return result;
}

function reference(value: unknown, resourceId: string, root: unknown, ctx: Context): unknown {
  if (typeof value !== "string") {
    throw new ThemeDslError("'__include'/'__patch' expects a path", "unsupported");
  }
  const optional = value.endsWith("?");
  const path = optional ? value.slice(0, -1) : value;
  const separator = path.indexOf(":");
  let targetResource: string;
  let localPath: string;
  if (separator === -1) {
    targetResource = resourceId;
    localPath = path;
  } else if (separator === 0) {
    targetResource = resourceId;
    localPath = path.slice(1);
  } else {
    targetResource = normalizeResourceId(path.slice(0, separator));
    localPath = path.slice(separator + 1);
  }
  const normalized = localPath.replace(/^\/+/, "");
  const key = `${targetResource}:${normalized}`;
  if (ctx.expanding.has(key)) {
    throw new ThemeDslError(`circular reference to '${key}'`, "unresolved");
  }
  ctx.expanding.add(key);
  try {
    const sameResource = targetResource === normalizeResourceId(resourceId);
    const fileRoot = sameResource ? root : ctx.resources.get(targetResource);
    if (fileRoot === undefined) {
      if (optional) return undefined;
      throw new ThemeDslError(`resource '${targetResource}' not found`, "unresolved");
    }
    const target = findLocal(fileRoot, normalized);
    if (target === undefined) {
      if (optional) return undefined;
      throw new ThemeDslError(`'${key}' not found`, "unresolved");
    }
    return ctx.expandNode(target, targetResource, fileRoot);
  } finally {
    ctx.expanding.delete(key);
  }
}
