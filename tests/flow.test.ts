import { describe, expect, it } from "vitest";
import { defaultBundle } from "../src/authoring/compiler";
import { stepStatuses } from "../src/authoring/flow";
import { devicesUsingLayout, impactLabel } from "../src/authoring/impact";
import type { ProjectBundle } from "../src/authoring/types";
import { validateProject } from "../src/authoring/validation";

describe("step statuses", () => {
  it("keeps the default bundle ready and explainable", () => {
    expect(validateProject(defaultBundle())).toEqual([]);
    const statuses = stepStatuses(defaultBundle());
    expect(statuses.find((status) => status.id === "layouts")?.state).toBe("done");
    expect(statuses.find((status) => status.id === "export")?.state).toBe("done");
  });

  it("covers every step with an explainable reason", () => {
    const statuses = stepStatuses(defaultBundle());
    expect(statuses.map((status) => status.id)).toEqual(["theme", "layouts", "interface", "devices", "export"]);
    for (const status of statuses) expect(status.reasons.length).toBeGreaterThan(0);
    expect(statuses.find((status) => status.id === "theme")?.state).toBe("done");
    expect(statuses.find((status) => status.id === "interface")?.state).toBe("default");
    expect(statuses.find((status) => status.id === "devices")?.state).not.toBe("error");
  });

  it("summarises both selected schemes and reports missing tokens", () => {
    const project = defaultBundle();
    const theme = stepStatuses(project).find((status) => status.id === "theme");
    expect(theme?.summary).toBe("浅色 Alucard · 深色 Dracula");
    expect(theme?.reasons.join(" ")).not.toContain("内置");

    delete project.theme.light.tokens.border;
    const broken = stepStatuses(project).find((status) => status.id === "theme");
    expect(broken?.state).toBe("error");
    expect(broken?.reasons.join(" ")).toContain("border");
  });

  it("marks a missing main layout as an error", () => {
    const project = defaultBundle();
    project.mainLayoutId = "missing-layout";
    const layouts = stepStatuses(project).find((status) => status.id === "layouts");
    expect(layouts?.state).toBe("error");
    expect(layouts?.reasons.join(" ")).toContain("主布局不存在");
  });

  it("warns when a landscape device has no variant", () => {
    const project = defaultBundle();
    project.devices = [{ id: "phone-landscape", kind: "phone", orientation: "landscape" }];
    const devices = stepStatuses(project).find((status) => status.id === "devices");
    expect(devices?.state).toBe("warning");
    expect(devices?.reasons.join(" ")).toContain("没有横屏变体");
  });
});

describe("impact hints", () => {
  function withVariant(): ProjectBundle {
    const project = defaultBundle();
    const base = project.layouts.find((layout) => layout.id === "qwerty26");
    if (!base) throw new Error("missing qwerty26");
    const variant = structuredClone(base);
    variant.id = "qwerty26-landscape";
    variant.name = "qwerty26 · 横屏";
    variant.builtin = false;
    project.layouts.push(variant);
    base.landscapeId = variant.id;
    project.devices = [
      { id: "phone-portrait", kind: "phone", orientation: "portrait" },
      { id: "phone-landscape", kind: "phone", orientation: "landscape" },
      { id: "tablet-portrait", kind: "tablet", orientation: "portrait" },
    ];
    return project;
  }

  it("lists devices bound to a base layout", () => {
    const project = withVariant();
    expect(devicesUsingLayout(project, "qwerty26").map((device) => device.id)).toEqual([
      "phone-portrait",
      "phone-landscape",
      "tablet-portrait",
    ]);
  });

  it("only lists landscape devices for a variant", () => {
    const project = withVariant();
    expect(devicesUsingLayout(project, "qwerty26-landscape").map((device) => device.id)).toEqual([
      "phone-landscape",
    ]);
    expect(impactLabel(devicesUsingLayout(project, "qwerty26-landscape"))).toContain("影响 1 个设备");
  });
});
