import type { ProjectBundle } from "./types";
import { compileBundle } from "./compiler";
import { validateTrimeYaml } from "./schema";
import { defaultChrome, libraries, REQUIRED_THEME_TOKENS } from "./utils";
import { validateProject, type Issue } from "./validation";

export type StepId = "theme" | "layouts" | "interface" | "devices" | "export";

export type StepOptions = {
  /** Compile and schema-check every device. Only enable on the export step. */
  schema?: boolean;
};

export type StepState = "error" | "warning" | "done" | "default";

export type StepStatus = {
  id: StepId;
  label: string;
  optional: boolean;
  state: StepState;
  /** Human-readable "why", always populated. */
  reasons: string[];
  /** Short positive summary shown next to the step. */
  summary: string;
};

export const STEP_ORDER: StepId[] = ["theme", "layouts", "interface", "devices", "export"];

function stateFromIssues(issues: Issue[]): StepState {
  if (issues.some((issue) => issue.level === "error")) return "error";
  if (issues.length > 0) return "warning";
  return "done";
}

function reasonsFromIssues(issues: Issue[], fallback: string): string[] {
  if (issues.length === 0) return [fallback];
  const shown = issues.slice(0, 3).map((issue) => issue.message);
  if (issues.length > 3) shown.push(`还有 ${issues.length - 3} 项`);
  return shown;
}

/**
 * Explainable completion state for every step. Pure function: the stepper,
 * step headers, and export summary all read the same source.
 */
export function stepStatuses(project: ProjectBundle, options: StepOptions = {}): StepStatus[] {
  const libs = libraries(project);
  const issues = validateProject(project);
  const byArea = (area: Issue["area"]) => issues.filter((issue) => issue.area === area);
  const exportIssues: Issue[] = [...issues];
  if (options.schema) {
    for (const device of project.devices) {
      const schemaIssues = validateTrimeYaml(compileBundle(project, device.id));
      if (schemaIssues.length > 0) {
        exportIssues.push({ level: "error", area: "export", message: `${device.id}：schema ${schemaIssues.length} 个错误` });
      }
    }
  }

  const themeIssues: Issue[] = [];
  for (const variant of ["light", "dark"] as const) {
    const selected = project.theme?.[variant];
    if (!selected?.tokens) {
      themeIssues.push({ level: "error", area: "theme", message: `${variant === "light" ? "浅色" : "深色"}方案无法解析` });
      continue;
    }
    const missing = REQUIRED_THEME_TOKENS.filter((token) => !selected.tokens[token]);
    if (missing.length > 0) {
      themeIssues.push({ level: "error", area: "theme", message: `${selected.name} 缺少 token：${missing.join(", ")}` });
    }
  }
  const themeSummary = project.theme
    ? `浅色 ${project.theme.light.name} · 深色 ${project.theme.dark.name}`
    : "未选择色卡";

  const layoutIssues = byArea("layouts");
  const interfaceIssues = byArea("interface");
  const deviceIssues = byArea("devices");
  const main = libs.layouts.find((item) => item.id === project.mainLayoutId);
  const landscapeCount = project.devices.filter((device) => device.orientation === "landscape").length;

  const chromeIsDefault = JSON.stringify(project.chrome ?? defaultChrome()) === JSON.stringify(defaultChrome());

  return [
    {
      id: "theme",
      label: "主题",
      optional: false,
      state: stateFromIssues(themeIssues),
      reasons: reasonsFromIssues(themeIssues, `已选 ${themeSummary}`),
      summary: themeSummary,
    },
    {
      id: "layouts",
      label: "布局",
      optional: false,
      state: stateFromIssues(layoutIssues),
      reasons: reasonsFromIssues(layoutIssues, `主布局 ${main?.name ?? "—"} · ${project.pageIds.length} 个页面`),
      summary: main ? `${main.name} · ${project.pageIds.length} 页` : "未选择主布局",
    },
    {
      id: "interface",
      label: "界面",
      optional: true,
      state: chromeIsDefault ? "default" : stateFromIssues(interfaceIssues),
      reasons: reasonsFromIssues(interfaceIssues, chromeIsDefault ? "未修改，使用默认 toolbar / window / preedit" : "已自定义界面配置"),
      summary: chromeIsDefault ? "使用默认" : "已自定义",
    },
    {
      id: "devices",
      label: "设备",
      optional: false,
      state: project.devices.length === 0
        ? "error"
        : stateFromIssues(deviceIssues),
      reasons: reasonsFromIssues(
        deviceIssues,
        project.devices.length === 0 ? "至少需要一个设备" : `${project.devices.length} 个设备已绑定布局`,
      ),
      summary: project.devices.length === 0
        ? "未配置"
        : `${project.devices.length} 个设备 · ${landscapeCount} 横屏`,
    },
    {
      id: "export",
      label: "检查与导出",
      optional: false,
      state: stateFromIssues(exportIssues),
      reasons: reasonsFromIssues(exportIssues, "项目级检查通过；schema 在导出页按设备校验"),
      summary: exportIssues.length === 0 ? "项目级检查通过" : `${exportIssues.length} 项待处理`,
    },
  ];
}

export function currentStepReason(status: StepStatus): string {
  return status.reasons[0] ?? "";
}
