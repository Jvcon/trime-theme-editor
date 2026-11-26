import type { ProjectBundle } from "./types";
import { LAYOUT_RULES } from "./devicePresets";
import { isPlaceholder, libraries } from "./utils";

export type IssueArea = "theme" | "layouts" | "interface" | "devices" | "export";

export type Issue = {
  level: "error" | "warning";
  message: string;
  area: IssueArea;
};

/**
 * Project-level consistency checks shared by the stepper and the export page.
 * Schema validation stays separate because it is per compiled device.
 */
export function validateProject(project: ProjectBundle): Issue[] {
  const issues: Issue[] = [];
  const macroIds = new Set(project.macros.map((item) => item.id));
  const layoutIds = new Set(project.layouts.map((item) => item.id));
  // "main" is a compiler-provided page target (Keyboard_main), not a layout.
  const pageTargets = new Set<string>([...layoutIds, "main"]);
  const libs = libraries(project);
  const sanitize = (value: string) => value.replace(/[^A-Za-z0-9_]/g, "_");
  const knownPresets = new Set<string>([
    "Keyboard_main", "Keyboard_default", "liquid_keyboard_exit", "space1", "Return1",
    "liquid_keyboard_clipboard", ...Object.keys(project.customPresetKeys ?? {}),
    ...project.macros.map((item) => `macro_${sanitize(item.id)}`),
  ]);
  for (const layout of project.layouts) knownPresets.add(`Keyboard_${sanitize(layout.id)}`);
  for (const id of [project.mainLayoutId, ...project.pageIds]) knownPresets.add(`Keyboard_${sanitize(id)}`);

  const variantIds = new Set(
    project.layouts.map((item) => item.landscapeId).filter((value): value is string => Boolean(value)),
  );
  for (const layout of project.layouts) {
    if (!layout.landscapeId) continue;
    if (layout.landscapeId === layout.id) {
      issues.push({ level: "error", area: "layouts", message: `${layout.name} 的横屏变体指向了自己` });
    } else if (!layoutIds.has(layout.landscapeId)) {
      issues.push({ level: "error", area: "layouts", message: `${layout.name} 的横屏变体不存在：${layout.landscapeId}` });
    }
    if (variantIds.has(layout.id)) {
      issues.push({ level: "warning", area: "layouts", message: `${layout.name} 既是横屏变体，又声明了自己的横屏变体；只解析一层` });
    }
  }

  const liquidTabs = project.chrome?.liquid.tabs ?? [];
  const tabIds = new Set<string>();
  for (const tab of liquidTabs) {
    if (!tab.id) issues.push({ level: "error", area: "interface", message: "liquid tab id 不能为空" });
    if (tabIds.has(tab.id)) issues.push({ level: "error", area: "interface", message: `liquid tab id 重复：${tab.id}` });
    tabIds.add(tab.id);
    knownPresets.add(`liquid_keyboard_${sanitize(tab.id)}`);
    if (tab.type === "SINGLE" && !tab.keys?.length) {
      issues.push({ level: "warning", area: "interface", message: `liquid tab ${tab.id} 是 SINGLE 但没有 keys` });
    }
    if (tab.type === "SYMBOL" && !tab.symbols?.length) {
      issues.push({ level: "warning", area: "interface", message: `liquid tab ${tab.id} 是 SYMBOL 但没有 symbols` });
    }
  }
  const toolbarButtons = project.chrome ? [project.chrome.toolbar.primaryButton, ...project.chrome.toolbar.buttons] : [];
  for (const button of toolbarButtons) {
    if (button.action.startsWith("liquid_keyboard_") && !knownPresets.has(button.action)) {
      issues.push({ level: "warning", area: "interface", message: `toolbar 引用了不存在的 liquid action：${button.action}` });
    }
  }

  if (!project.layouts.some((item) => item.id === project.mainLayoutId)) {
    issues.push({ level: "error", area: "layouts", message: `主布局不存在：${project.mainLayoutId}` });
  }
  for (const id of project.pageIds) {
    if (!layoutIds.has(id)) issues.push({ level: "error", area: "layouts", message: `页面引用的布局不存在：${id}` });
    if (id === project.mainLayoutId) issues.push({ level: "warning", area: "layouts", message: `页面与主布局重复：${id}` });
  }

  // Check every embedded layout: main, pages, device bindings, variants, and
  // schema-binding targets. Pruning keeps the bundle small, so this is safe.
  for (const layout of project.layouts) {
    layout.rows.forEach((row, rowIndex) => {
      const sum = row.keys.reduce((total, key) => total + (key.width || 0), 0);
      if (Math.abs(sum - 100) > LAYOUT_RULES.rowWidthTolerance) {
        issues.push({ level: "warning", area: "layouts", message: `${layout.name} 第 ${rowIndex + 1} 行宽度合计 ${sum.toFixed(1)}%，不是 100%（可用 Fit 100% 修正）` });
      }
      row.keys.forEach((key, keyIndex) => {
        if (isPlaceholder(key)) return;
        for (const behavior of ["click", "long_click", "double_click", "swipe_up", "swipe_down", "swipe_left", "swipe_right"] as const) {
          const action = key[behavior];
          if (action?.kind === "macro" && !macroIds.has(action.id)) {
            issues.push({ level: "error", area: "layouts", message: `${layout.name} 第 ${rowIndex + 1} 行第 ${keyIndex + 1} 键的 ${behavior} 引用了不存在的宏：${action.id}` });
          }
          if (action?.kind === "page" && !pageTargets.has(action.id)) {
            issues.push({ level: "error", area: "layouts", message: `${layout.name} 第 ${rowIndex + 1} 行第 ${keyIndex + 1} 键的 ${behavior} 引用了不存在的页面：${action.id}` });
          }
          if (action?.kind === "preset" && !knownPresets.has(action.value)) {
            issues.push({ level: "error", area: "layouts", message: `${layout.name} 第 ${rowIndex + 1} 行第 ${keyIndex + 1} 键的 ${behavior} 引用了不存在的 preset_key：${action.value}` });
          }
        }
        if (!key.click && !(key.label === undefined && key.style === "off")) {
          issues.push({ level: "warning", area: "layouts", message: `${layout.name} 第 ${rowIndex + 1} 行第 ${keyIndex + 1} 键没有 click 行为` });
        }
        if (!key.style || !project.keyStyles[key.style]) {
          issues.push({ level: "warning", area: "layouts", message: `${layout.name} 第 ${rowIndex + 1} 行第 ${keyIndex + 1} 键引用了不存在的 style type：${key.style ?? "（空）"}` });
        }
      });
    });
  }

  const deviceIds = new Set<string>();
  for (const device of project.devices) {
    if (deviceIds.has(device.id)) {
      issues.push({ level: "error", area: "devices", message: `device id 重复：${device.id}` });
    }
    deviceIds.add(device.id);
    if (device.mainLayoutId && !layoutIds.has(device.mainLayoutId)) {
      issues.push({ level: "error", area: "devices", message: `device ${device.id} 引用了不存在的布局：${device.mainLayoutId}` });
    }
    if (device.orientation === "landscape") {
      const baseId = device.mainLayoutId ?? project.mainLayoutId;
      const base = libs.layouts.find((item) => item.id === baseId);
      if (base && !base.landscapeId) {
        issues.push({
          level: "warning",
          area: "devices",
          message: `${device.kind} 横屏设备 ${device.id} 绑定的「${base.name}」没有横屏变体，将沿用竖屏结构`,
        });
      }
    }
  }

  const aliases = new Set<string>();
  for (const binding of project.schemaBindings) {
    if (!binding.schemaId.trim()) {
      issues.push({ level: "warning", area: "export", message: "schema binding 没有 schema_id" });
    }
    if (!layoutIds.has(binding.layoutId)) {
      issues.push({ level: "error", area: "export", message: `schema ${binding.schemaId || "(empty)"} 引用了不存在的布局：${binding.layoutId}` });
    }
    const alias = binding.alias?.trim() || `schema_${sanitize(binding.schemaId || binding.layoutId)}`;
    if (alias === "default" || layoutIds.has(alias)) {
      issues.push({ level: "error", area: "export", message: `schema alias 与键盘 id 冲突：${alias}` });
    }
    if (aliases.has(alias)) {
      issues.push({ level: "error", area: "export", message: `schema alias 重复：${alias}` });
    }
    aliases.add(alias);
  }

  const rawKeyboards = project.passthrough?.preset_keyboards;
  if (rawKeyboards && typeof rawKeyboards === "object" && !Array.isArray(rawKeyboards)) {
    for (const [id, value] of Object.entries(rawKeyboards as Record<string, unknown>)) {
      const entry = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
      const target = entry?.import_preset;
      if (typeof target === "string" && target && !layoutIds.has(target)) {
        issues.push({ level: "error", area: "export", message: `preset_keyboards alias ${id} 引用了不存在的布局：${target}` });
      }
    }
  }

  return issues.slice(0, 80);
}
