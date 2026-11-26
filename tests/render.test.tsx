import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AuthoringApp } from "../src/authoring/AuthoringApp";
import { ImportDialog } from "../src/authoring/ImportDialog";
import { defaultBundle } from "../src/authoring/compiler";
import { BasicPanel } from "../src/authoring/panels/BasicPanel";
import { ExportPanel } from "../src/authoring/panels/ExportPanel";
import { libraries } from "../src/authoring/utils";

const noop = vi.fn();

describe("AuthoringApp", () => {
  it("renders the default v2 bundle without touching IndexedDB", () => {
    const html = renderToStaticMarkup(<AuthoringApp />);
    expect(html).toContain("Trime Theme Editor");
    expect(html).toContain("Keyboard preview");
    expect(html).toContain("26 键");
  });

  it("renders the Basic panel with device and schema-binding editors", () => {
    const project = defaultBundle();
    const html = renderToStaticMarkup(
      <BasicPanel
        project={project}
        projects={[project]}
        libs={libraries(project)}
        dirty={false}
        mutate={noop}
        onSave={noop}
        onNew={noop}
        onOpen={noop}
        onDelete={noop}
        onImportBundle={noop}
        onImportYaml={noop}
        onExportBundle={noop}
        snapshots={[]}
        onSnapshot={noop}
        onRestoreSnapshot={noop}
        onDeleteSnapshot={noop}
        onExportSnapshot={noop}
        onExportSnapshotBundle={noop}
        onImportSnapshotBundle={noop}
      />,
    );
    expect(html).toContain("Devices");
    expect(html).toContain("Schema bindings");
    expect(html).toContain("Fallback colors");
  });

  it("renders schema validation and drift comparison in the Export panel", () => {
    const project = defaultBundle();
    const html = renderToStaticMarkup(<ExportPanel project={project} snapshots={[]} setMessage={noop} />);
    expect(html).toContain("schema 3.3.13");
    expect(html).toContain("Compare with existing trime.yaml");
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
