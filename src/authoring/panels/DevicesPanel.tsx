import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { DEVICE_PRESET_OPTIONS, METRIC_DEFAULTS, applyLandscapeRecipe, isLandscapeRecipe } from "../devicePresets";
import { deviceLabel, resolveLayoutForDevice } from "../resolve";
import type { DeviceKind, FoldState, Orientation, PresetLibraries, ProjectBundle, ProjectMetrics } from "../types";
import { embedLayout, pruneBundleLayouts } from "../utils";

type Props = {
  project: ProjectBundle;
  libs: PresetLibraries;
  mutate: (fn: (draft: ProjectBundle) => void) => void;
  setMessage: (message: string) => void;
  onOpenLayouts: (layoutId: string) => void;
  /** Keep the persistent preview on the device the user just touched. */
  onFocusDevice: (id: string) => void;
};

const DEVICE_METRIC_FIELDS = [
  ["keyHeight", "键高"],
  ["keyboardHeight", "键盘高"],
  ["candidateViewHeight", "候选高"],
  ["horizontalGap", "横向间距"],
  ["verticalGap", "纵向间距"],
  ["popupWidth", "popup 宽"],
  ["popupHeight", "popup 高"],
  ["popupKeyHeight", "popup 键高"],
] as const;

export function DevicesPanel({ project, libs, mutate, setMessage, onOpenLayouts, onFocusDevice }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const variantIds = new Set(
    project.layouts.map((item) => item.landscapeId).filter((value): value is string => Boolean(value)),
  );
  const layoutOptions = libs.layouts.filter((item) => item.pageRole === "main" && !variantIds.has(item.id));

  const addDevice = (index: number) => {
    const preset = DEVICE_PRESET_OPTIONS[index];
    if (!preset) return;
    let createdId = "";
    mutate((draft) => {
      const base = preset.foldState ? `${preset.kind}-${preset.foldState}` : `${preset.kind}-${preset.orientation}`;
      let id = base;
      let suffix = 2;
      while (draft.devices.some((device) => device.id === id)) {
        id = `${base}-${suffix}`;
        suffix += 1;
      }
      draft.devices.push({
        id,
        kind: preset.kind,
        orientation: preset.orientation,
        ...(preset.foldState ? { foldState: preset.foldState } : {}),
      });
      createdId = id;
      pruneBundleLayouts(draft);
    });
    if (createdId) onFocusDevice(createdId);
    setMessage(`已添加 ${preset.label}（继承项目设置）`);
  };

  const updateDevice = (index: number, fn: (device: ProjectBundle["devices"][number]) => void) => {
    const device = project.devices[index];
    mutate((draft) => {
      const target = draft.devices[index];
      if (!target) return;
      fn(target);
      pruneBundleLayouts(draft);
    });
    if (device) onFocusDevice(device.id);
  };

  const removeDevice = (index: number) => {
    if (project.devices.length <= 1) return;
    const remaining = project.devices.filter((_, item) => item !== index);
    mutate((draft) => {
      draft.devices.splice(index, 1);
      pruneBundleLayouts(draft);
    });
    onFocusDevice(remaining[0]?.id ?? "");
    setMessage("已删除设备");
  };

  const setDeviceMainLayout = (index: number, id: string) => {
    const next = id ? libs.layouts.find((item) => item.id === id) : undefined;
    mutate((draft) => {
      const device = draft.devices[index];
      if (!device) return;
      if (!next) {
        delete device.mainLayoutId;
      } else {
        embedLayout(draft, next);
        device.mainLayoutId = next.id;
      }
      pruneBundleLayouts(draft);
    });
    const device = project.devices[index];
    if (device) onFocusDevice(device.id);
  };

  const updateDeviceMetric = (index: number, field: (typeof DEVICE_METRIC_FIELDS)[number][0], raw: string) => {
    mutate((draft) => {
      const device = draft.devices[index];
      if (!device) return;
      const metrics = { ...(device.metrics ?? {}) };
      if (raw === "") delete metrics[field];
      else metrics[field] = Number(raw);
      device.metrics = metrics;
    });
    const device = project.devices[index];
    if (device) onFocusDevice(device.id);
  };

  const resetMetrics = (index: number) => {
    mutate((draft) => {
      const device = draft.devices[index];
      if (device) delete device.metrics;
    });
    const device = project.devices[index];
    if (device) onFocusDevice(device.id);
    setMessage("已恢复为继承项目设置");
  };

  const applyRecipe = (index: number) => {
    mutate((draft) => {
      const device = draft.devices[index];
      if (!device) return;
      device.metrics = applyLandscapeRecipe(draft.metrics);
    });
    const device = project.devices[index];
    if (device) onFocusDevice(device.id);
    setMessage("已应用横屏推荐尺寸（可继续微调）");
  };

  const toggleExpanded = (id: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="h-full overflow-auto p-section">
      <div className="mb-3 flex flex-wrap items-center gap-stack">
        <span className="text-sm font-semibold">设备适配</span>
        <Badge variant="muted">{project.devices.length}</Badge>
        <span className="text-2xs text-muted-foreground">每个设备输出一份 trime.yaml；这里只绑定布局和覆盖尺寸，不重做布局</span>
        <Select className="ml-auto h-control w-40 text-xs" value="" onChange={(event) => { addDevice(Number(event.target.value)); event.target.value = ""; }}>
          <option value="">+ 添加设备</option>
          {DEVICE_PRESET_OPTIONS.map((preset, index) => <option key={preset.label} value={index}>{preset.label}</option>)}
        </Select>
      </div>

      <div className="space-y-2">
        {project.devices.map((device, index) => {
          const boundId = device.mainLayoutId ?? project.mainLayoutId;
          const bound = libs.layouts.find((item) => item.id === boundId);
          const resolved = resolveLayoutForDevice(project, device);
          const variantMissing = device.orientation === "landscape" && bound && !bound.landscapeId;
          const hasOverrides = Object.keys(device.metrics ?? {}).length > 0;
          const recommended = isLandscapeRecipe(device.metrics, project.metrics);
          const mode = !hasOverrides ? "inherit" : recommended ? "recommended" : "custom";
          const open = expanded.has(device.id);

          return (
            <section key={device.id} className="rounded-xl border border-border bg-card p-gutter">
              <div className="flex flex-wrap items-center gap-stack">
                <code className="rounded bg-muted px-1.5 py-0.5 text-2xs">{device.id}</code>
                <span className="text-2xs text-muted-foreground">{deviceLabel(device)}</span>
                <Select className="h-control-sm w-24" value={device.kind} onChange={(event) => updateDevice(index, (draft) => { draft.kind = event.target.value as DeviceKind; if (draft.kind !== "fold") delete draft.foldState; })}>
                  <option value="phone">phone</option>
                  <option value="fold">fold</option>
                  <option value="tablet">tablet</option>
                </Select>
                <Select className="h-control-sm w-28" value={device.orientation} onChange={(event) => updateDevice(index, (draft) => { draft.orientation = event.target.value as Orientation; })}>
                  <option value="portrait">竖屏</option>
                  <option value="landscape">横屏</option>
                </Select>
                {device.kind === "fold" ? (
                  <Select className="h-control-sm w-28" value={device.foldState ?? "unfolded"} onChange={(event) => updateDevice(index, (draft) => { draft.foldState = event.target.value as FoldState; })}>
                    <option value="folded">折叠</option>
                    <option value="unfolded">展开</option>
                  </Select>
                ) : null}
                <Select className="h-control-sm w-52" value={device.mainLayoutId ?? ""} onChange={(event) => setDeviceMainLayout(index, event.target.value)}>
                  <option value="">继承项目主布局（{libs.layouts.find((item) => item.id === project.mainLayoutId)?.name ?? "—"}）</option>
                  {device.mainLayoutId && !layoutOptions.some((item) => item.id === device.mainLayoutId) ? <option value={device.mainLayoutId}>{device.mainLayoutId} · missing</option> : null}
                  {layoutOptions.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.pageRole}{item.landscapeId ? " · 含横屏变体" : ""}</option>)}
                </Select>
                <Button size="sm" variant="ghost" className="ml-auto h-control-sm px-1 text-destructive" disabled={project.devices.length <= 1} onClick={() => removeDevice(index)}><Trash2 /></Button>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-stack rounded-lg border border-border bg-muted/10 px-2 py-1.5 text-2xs">
                <span className="text-muted-foreground">编译布局</span>
                <span className="font-medium">{resolved?.name ?? "—"}</span>
                {variantMissing ? (
                  <>
                    <Badge variant="warning">无横屏变体，沿用竖屏结构</Badge>
                    <Button size="sm" variant="outline" className="h-control-xs text-2xs" onClick={() => bound && onOpenLayouts(bound.id)}>去布局里创建</Button>
                  </>
                ) : device.orientation === "landscape" && bound?.landscapeId ? (
                  <Badge variant="success">自动使用横屏变体</Badge>
                ) : null}
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-1">
                <span className="mr-1 text-2xs text-muted-foreground">尺寸</span>
                <ModeButton active={mode === "inherit"} onClick={() => resetMetrics(index)}>继承项目</ModeButton>
                <ModeButton active={mode === "recommended"} onClick={() => applyRecipe(index)}>横屏推荐</ModeButton>
                <ModeButton active={mode === "custom" || open} onClick={() => toggleExpanded(device.id)}>精细{open ? " ▴" : " ▾"}</ModeButton>
              </div>

              {open ? (
                <div className="mt-2 grid grid-cols-1 gap-stack rounded-lg border border-border bg-muted/10 p-2 sm:grid-cols-4">
                  {DEVICE_METRIC_FIELDS.map(([field, label]) => (
                    <div key={field} className="space-y-1">
                      <Label className="text-3xs text-muted-foreground">{label}</Label>
                      <div className="flex gap-1">
                        <Input
                          className="h-control-sm"
                          type="number"
                          value={device.metrics?.[field] ?? ""}
                          placeholder={`继承 · ${project.metrics?.[field as keyof ProjectMetrics] ?? METRIC_DEFAULTS[field]}`}
                          onChange={(event) => updateDeviceMetric(index, field, event.target.value)}
                        />
                        {device.metrics?.[field] !== undefined ? (
                          <Button size="sm" variant="ghost" className="h-control-sm px-1 text-destructive" title="恢复继承" onClick={() => updateDeviceMetric(index, field, "")}>×</Button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-2 flex flex-wrap gap-3 text-2xs text-muted-foreground">
                  {(["keyboardHeight", "keyHeight", "candidateViewHeight"] as const).map((field) => {
                    const value = device.metrics?.[field];
                    const inherit = project.metrics?.[field] ?? METRIC_DEFAULTS[field];
                    return (
                      <span key={field}>
                        {field === "keyboardHeight" ? "键盘高" : field === "keyHeight" ? "键高" : "候选高"}{" "}
                        <span className={value === undefined ? "" : "text-warning"}>{value ?? inherit}</span>{" "}
                        <span className="text-3xs">{value === undefined ? "← 继承" : "← 覆盖"}</span>
                      </span>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
      </div>

      <p className="mt-3 text-2xs text-muted-foreground">
        设备只保存差异：主布局 + 尺寸覆盖，其余继承项目设置。横屏的结构差异请放到「布局」步骤的横屏变体里；
        横屏通常只需要降低键盘高度、控制行数。
      </p>
    </div>
  );
}

function ModeButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-control border px-1.5 py-0.5 text-2xs transition-colors ${active ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-surface-hover active:bg-surface-active hover:text-foreground"}`}
    >
      {children}
    </button>
  );
}
