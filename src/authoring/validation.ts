import type { ProjectBundle } from "./types";
import { LAYOUT_RULES } from "./devicePresets";
import { groupLayouts, isPlaceholder, libraries } from "./utils";

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
  const allLayoutIds = new Set(project.layouts.map((item) => item.id));
  const group = groupLayouts(project);
  const layoutIds = new Set(group.map((item) => item.id));
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
  knownPresets.add("Keyboard_main");
  knownPresets.add("Keyboard_default");

  const variantIds = new Set(
    project.layouts.map((item) => item.landscapeId).filter((value): value is string => Boolean(value)),
  );
  if (group.length === 0) {
    issues.push({ level: "warning", area: "layouts", message: "还没有布局；添加布局并指定默认布局（或给每台设备单独绑定布局）" });
  }
  const inheritingDevices = project.devices.filter((device) => !device.layoutId).length;
  if (group.length > 0 && !project.defaultLayoutId && inheritingDevices > 0) {
    issues.push({ level: "warning", area: "layouts", message: `未设置默认布局；${inheritingDevices} 台未单独绑定布局的设备将无法编译` });
  }
  if (project.defaultLayoutId && !layoutIds.has(project.defaultLayoutId)) {
    issues.push({ level: "error", area: "layouts", message: `默认布局不存在：${project.defaultLayoutId}` });
  }
  for (const layout of project.layouts) {
    if (!variantIds.has(layout.id) && !layoutIds.has(layout.id)) {
      issues.push({ level: "warning", area: "layouts", message: `${layout.name} 未加入布局组；保存或编译时会自动加入` });
    }
    if (!layout.landscapeId) continue;
    if (layout.landscapeId === layout.id) {
      issues.push({ level: "error", area: "layouts", message: `${layout.name} 的横屏变体指向了自己` });
    } else if (!allLayoutIds.has(layout.landscapeId)) {
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

  // Check every embedded layout: group members, device bindings, variants, and
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
    if (device.layoutId && variantIds.has(device.layoutId)) {
      issues.push({ level: "error", area: "devices", message: `device ${device.id} 绑定了横屏变体，应绑定其基础布局：${device.layoutId}` });
    } else if (device.layoutId && !layoutIds.has(device.layoutId)) {
      issues.push({ level: "error", area: "devices", message: `device ${device.id} 引用了不存在的布局：${device.layoutId}` });
    }
    const baseId = device.layoutId ?? project.defaultLayoutId;
    if (!baseId) {
      issues.push({ level: "error", area: "devices", message: `device ${device.id} 未关联布局，且项目未设置默认布局` });
    }
    if (device.orientation === "landscape" && baseId && layoutIds.has(baseId)) {
      const base = group.find((item) => item.id === baseId) ?? libs.layouts.find((item) => item.id === baseId);
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
      if (typeof target === "string" && target && !allLayoutIds.has(target)) {
        issues.push({ level: "error", area: "export", message: `preset_keyboards alias ${id} 引用了不存在的布局：${target}` });
      }
    }
  }

  return issues.slice(0, 80);
}
