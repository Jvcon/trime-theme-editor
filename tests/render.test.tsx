import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AuthoringApp } from "../src/authoring/AuthoringApp";
import { ImportDialog } from "../src/authoring/ImportDialog";
import { defaultBundle } from "../src/authoring/compiler";
import { AdvancedDrawer } from "../src/authoring/components/AdvancedDrawer";
import { PreviewRail } from "../src/authoring/components/PreviewRail";
import { ProjectDrawer } from "../src/authoring/components/ProjectDrawer";
import { DevicesPanel } from "../src/authoring/panels/DevicesPanel";
import { ExportPanel } from "../src/authoring/panels/ExportPanel";
import { ThemesPanel } from "../src/authoring/panels/ThemesPanel";
import { libraries } from "../src/authoring/utils";

const noop = vi.fn();

describe("AuthoringApp", () => {
  it("renders the default v3 bundle without touching IndexedDB", () => {
    const html = renderToStaticMarkup(<AuthoringApp />);
    expect(html).toContain("Trime Theme Editor");
    expect(html).toContain("项目信息");
    expect(html).toContain("色卡");
    expect(html).toContain("预览");
    for (const label of ["主题", "布局", "界面", "设备", "检查与导出"]) expect(html).toContain(label);
    expect(html).toContain("可选");
    expect(html).not.toContain("Basic");
  });

  it("renders the theme step with independent light and dark scheme pickers", () => {
    const project = defaultBundle();
    const html = renderToStaticMarkup(
      <ThemesPanel
        project={project}
        libs={libraries(project)}
        mutate={noop}
        setMessage={noop}
      />,
    );
    expect(html).toContain("浅色方案");
    expect(html).toContain("深色方案");
    expect(html).toContain("Alucard");
    expect(html).toContain("Dracula");
    expect(html).not.toContain("内置");
    expect(html).toContain("修改任意颜色时会自动复制为自定义方案");
    expect(html).toContain("浅色 · Alucard");
    expect(html).toContain("深色 · Dracula");
    expect(html).toContain("切换后同步右侧预览");
  });

  it("offers a light/dark switch inside the preview rail", () => {
    const project = defaultBundle();
    const html = renderToStaticMarkup(
      <PreviewRail
        project={project}
        libs={libraries(project)}
        deviceId={project.devices[0]?.id ?? "phone"}
        onDeviceId={noop}
        orientation="portrait"
        onOrientation={noop}
        onVariant={noop}
        onCollapse={noop}
      />,
    );
    expect(html).toContain("预览");
    expect(html).toContain("浅色");
    expect(html).toContain("深色");
  });

  it("labels user-edited schemes as custom without showing a built-in badge", () => {
    const project = defaultBundle();
    project.theme.light = {
      ...structuredClone(project.theme.light),
      id: "custom-light",
      name: "My Light",
      builtin: false,
    };
    const html = renderToStaticMarkup(
      <ThemesPanel
        project={project}
        libs={libraries(project)}
        mutate={noop}
        setMessage={noop}
      />,
    );
    expect(html).toContain("自定义");
    expect(html).toContain("My Light");
    expect(html).not.toContain("内置");
  });

  it("renders the device step with layout binding and adaptation modes", () => {
    const project = defaultBundle();
    const html = renderToStaticMarkup(
      <DevicesPanel
        project={project}
        libs={libraries(project)}
        mutate={noop}
        setMessage={noop}
        onOpenLayouts={noop}
        onFocusDevice={noop}
      />,
    );
    expect(html).toContain("设备适配");
    expect(html).toContain("编译布局");
    expect(html).toContain("横屏推荐");
  });

  it("renders the project drawer and the advanced drawer", () => {
    const project = defaultBundle();
    const drawer = renderToStaticMarkup(
      <ProjectDrawer
        open
        onClose={noop}
        project={project}
        projects={[project]}
        snapshots={[]}
        onSave={noop}
        onNew={noop}
        onOpen={noop}
        onDelete={noop}
        onImportBundle={noop}
        onImportYaml={noop}
        onExportBundle={noop}
        onSnapshot={noop}
        onRestoreSnapshot={noop}
        onDeleteSnapshot={noop}
        onExportSnapshot={noop}
        onExportSnapshotBundle={noop}
        onImportSnapshotBundle={noop}
        onOpenMacros={noop}
        onOpenAdvanced={noop}
      />,
    );
    expect(drawer).toContain("项目列表");
    expect(drawer).toContain("快照");

    const advanced = renderToStaticMarkup(
      <AdvancedDrawer
        open
        onClose={noop}
        project={project}
        libs={libraries(project)}
        mutate={noop}
        setMessage={noop}
      />,
    );
    expect(advanced).toContain("输入法绑定");
    expect(advanced).toContain("概要");
  });

  it("renders schema validation and drift comparison in the Export panel", () => {
    const project = defaultBundle();
    const html = renderToStaticMarkup(<ExportPanel project={project} snapshots={[]} setMessage={noop} />);
    expect(html).toContain("检查与导出");
    expect(html).toContain("schema 3.3.13");
    expect(html).toContain("更多工具 · 与现有 trime.yaml 对比");
    expect(html).toContain("Manifest");
  });

  it("renders the import report categories", () => {
    const source = `
name: Test
preset_color_schemes:
  light: { back_color: 0xFF000000 }
preset_keyboards:
  default:
    keys:
      - { click: a, width: 100 }
`;
    const html = renderToStaticMarkup(
      <ImportDialog source={source} fileName="trime.yaml" onApply={noop} onCancel={noop} />,
    );
    expect(html).toContain("Import trime.yaml");
    expect(html).toContain("Mapped");
    expect(html).toContain("Apply import");
  });
});
