import { useState } from "react";
import { Download, Plus, Save, Trash2, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { DeviceKind, FoldState, Orientation, PresetLibraries, ProjectBundle } from "../types";
import type { Snapshot } from "../storage";
import { embedLayout, pages, pruneBundleLayouts } from "../utils";

type Props = {
  project: ProjectBundle;
  projects: ProjectBundle[];
  libs: PresetLibraries;
  dirty: boolean;
  mutate: (fn: (draft: ProjectBundle) => void) => void;
  onSave: () => void;
  onNew: () => void;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onImportBundle: (file: File) => void;
  onImportYaml: (files: File[]) => void;
  onExportBundle: () => void;
  snapshots: Snapshot[];
  onSnapshot: (label: string) => void;
  onRestoreSnapshot: (snapshot: Snapshot) => void;
  onDeleteSnapshot: (key: string) => void;
  onExportSnapshot: (snapshot: Snapshot, format: "json" | "yaml") => void;
  onExportSnapshotBundle: () => void;
  onImportSnapshotBundle: (file: File) => void;
};

const DEVICE_PRESETS: Array<{ label: string; kind: DeviceKind; orientation: Orientation; foldState?: FoldState }> = [
  { label: "Phone · portrait", kind: "phone", orientation: "portrait" },
  { label: "Phone · landscape", kind: "phone", orientation: "landscape" },
  { label: "Tablet · portrait", kind: "tablet", orientation: "portrait" },
  { label: "Tablet · landscape", kind: "tablet", orientation: "landscape" },
  { label: "Fold · folded", kind: "fold", orientation: "portrait", foldState: "folded" },
  { label: "Fold · unfolded", kind: "fold", orientation: "portrait", foldState: "unfolded" },
];

const DEVICE_METRIC_FIELDS = [
  ["keyHeight", "Key height", 52],
  ["keyboardHeight", "Keyboard height", 270],
  ["candidateViewHeight", "Candidate height", 44],
  ["horizontalGap", "Horizontal gap", 2],
  ["verticalGap", "Vertical gap", 3],
  ["popupWidth", "Popup width", 44],
  ["popupHeight", "Popup height", 56],
  ["popupKeyHeight", "Popup key height", 48],
] as const;

function sanitizeId(value: string) {
  return value.replace(/[^A-Za-z0-9_-]/g, "-").replace(/^-+|-+$/g, "") || "device";
}

function bindingAlias(binding: ProjectBundle["schemaBindings"][number]): string {
  return binding.alias?.trim() || `schema_${sanitizeId(binding.schemaId || binding.layoutId)}`;
}

export function BasicPanel({ project, projects, libs, dirty, mutate, onSave, onNew, onOpen, onDelete, onImportBundle, onImportYaml, onExportBundle, snapshots, onSnapshot, onRestoreSnapshot, onDeleteSnapshot, onExportSnapshot, onExportSnapshotBundle, onImportSnapshotBundle }: Props) {
  const [snapshotLabel, setSnapshotLabel] = useState("");
  const card = project.theme;
  const main = project.layouts.find((item) => item.id === project.mainLayoutId);
  const allPages = pages(project, libs);

  const selectThemeCard = (id: string) => {
    const next = libs.themeCards.find((item) => item.id === id);
    if (!next) return;
    mutate((draft) => {
      draft.theme = structuredClone(next);
    });
  };

  const selectMainLayout = (id: string) => {
    const next = libs.layouts.find((item) => item.id === id);
    if (!next) return;
    mutate((draft) => {
      embedLayout(draft, next);
      draft.mainLayoutId = next.id;
      draft.pageIds = draft.pageIds.filter((pageId) => pageId !== next.id);
      pruneBundleLayouts(draft);
    });
  };

  const mainLayouts = libs.layouts.filter((item) => item.pageRole === "main");

  const addDevice = (index: number) => {
    const preset = DEVICE_PRESETS[index];
    if (!preset) return;
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
      pruneBundleLayouts(draft);
    });
  };

  const updateDevice = (index: number, fn: (device: ProjectBundle["devices"][number]) => void) => {
    mutate((draft) => {
      const device = draft.devices[index];
      if (!device) return;
      fn(device);
      pruneBundleLayouts(draft);
    });
  };

  const removeDevice = (index: number) => {
    if (project.devices.length <= 1) return;
    mutate((draft) => {
      draft.devices.splice(index, 1);
      pruneBundleLayouts(draft);
    });
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
  };

  const addBinding = () => {
    mutate((draft) => {
      draft.schemaBindings.push({ schemaId: "", layoutId: draft.mainLayoutId, alias: "" });
      pruneBundleLayouts(draft);
    });
  };

  const updateBinding = (index: number, patch: { schemaId?: string; alias?: string }) => {
    mutate((draft) => {
      const binding = draft.schemaBindings[index];
      if (!binding) return;
      if (patch.schemaId !== undefined) binding.schemaId = patch.schemaId;
      if (patch.alias !== undefined) binding.alias = patch.alias;
    });
  };

  const setBindingLayout = (index: number, id: string) => {
    const next = libs.layouts.find((item) => item.id === id);
    if (!next) return;
    mutate((draft) => {
      const binding = draft.schemaBindings[index];
      if (!binding) return;
      embedLayout(draft, next);
      binding.layoutId = next.id;
      pruneBundleLayouts(draft);
    });
  };

  const removeBinding = (index: number) => {
    mutate((draft) => {
      draft.schemaBindings.splice(index, 1);
      pruneBundleLayouts(draft);
    });
  };

  return (
    <div className="h-full overflow-auto p-5">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <section className="rounded-xl border border-border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold">Theme meta</h2>
          <div className="space-y-2">
            <Field label="Name"><Input value={project.meta.name} onChange={(event) => mutate((draft) => { draft.meta.name = event.target.value; })} /></Field>
            <Field label="Author"><Input value={project.meta.author} onChange={(event) => mutate((draft) => { draft.meta.author = event.target.value; })} /></Field>
            <Field label="Description"><Input value={project.meta.description ?? ""} onChange={(event) => mutate((draft) => { draft.meta.description = event.target.value; })} /></Field>
            <Field label="Config version"><Input value={project.meta.configVersion} onChange={(event) => mutate((draft) => { draft.meta.configVersion = event.target.value; })} /></Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Theme card">
                <Select value={card.id} onChange={(event) => selectThemeCard(event.target.value)}>
                  {libs.themeCards.map((item) => <option key={item.id} value={item.id}>{item.name}{item.builtin ? " · builtin" : " · custom"}</option>)}
                </Select>
              </Field>
              <Field label="Variant">
                <Select value={project.variant} onChange={(event) => mutate((draft) => { draft.variant = event.target.value as "light" | "dark"; })}>
                  <option value="light">light</option>
                  <option value="dark">dark</option>
                </Select>
              </Field>
            </div>
            <Field label="Main layout">
              <Select value={project.mainLayoutId} onChange={(event) => selectMainLayout(event.target.value)}>
                {libs.layouts.filter((item) => item.pageRole === "main").map((item) => <option key={item.id} value={item.id}>{item.name}{item.builtin ? " · builtin" : " · custom"}</option>)}
              </Select>
            </Field>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-4">
          <div className="mb-3 flex items-center gap-2">
            <h2 className="text-sm font-semibold">Projects · IndexedDB</h2>
            <Badge variant={dirty ? "warning" : "success"}>{dirty ? "unsaved" : "saved"}</Badge>
            <div className="ml-auto flex gap-1">
              <Button size="sm" variant="outline" onClick={onNew}><Plus />New</Button>
              <Button size="sm" variant="secondary" onClick={onSave}><Save />Save</Button>
            </div>
          </div>
          <div className="mb-2 space-y-1">
            {projects.map((item) => (
              <div key={item.id} className={`flex items-center gap-1 rounded border px-2 py-1 text-xs ${item.id === project.id ? "border-primary bg-primary/5" : "border-border"}`}>
                <button type="button" className="min-w-0 flex-1 truncate text-left" onClick={() => onOpen(item.id)}>{item.meta.name}</button>
                <span className="text-[9px] text-muted-foreground">{item.id}</span>
                <button type="button" className="text-red-300" onClick={() => onDelete(item.id)}><Trash2 className="size-3" /></button>
              </div>
            ))}
            {projects.length === 0 ? <p className="py-2 text-[10px] text-muted-foreground">还没有保存的项目，点击 Save 写入 IndexedDB。</p> : null}
          </div>
          <div className="flex flex-wrap gap-1">
            <label className="inline-flex h-8 cursor-pointer items-center gap-1 rounded border border-border px-2 text-xs hover:bg-muted">
              <Upload className="size-3" /> Import bundle
              <input type="file" accept=".json,application/json" hidden onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) onImportBundle(file);
              }} />
            </label>
            <Button size="sm" variant="outline" onClick={onExportBundle}><Download />Export bundle</Button>
            <label className="inline-flex h-8 cursor-pointer items-center gap-1 rounded border border-border px-2 text-xs hover:bg-muted">
              <Upload className="size-3" /> Import trime.yaml
              <input type="file" accept=".yaml,.yml,text/yaml" multiple hidden onChange={(event) => {
                const files = Array.from(event.target.files ?? []);
                event.target.value = "";
                if (files.length > 0) onImportYaml(files);
              }} />
            </label>
          </div>
          <p className="mt-2 text-[10px] text-muted-foreground">v2 bundle 只包含当前项目实际使用的色卡、布局和宏，可直接入库、diff、复现。导入 trime.yaml 时可多选主文件与 `__include` 引用到的文件；展开后会生成 import report。</p>
        </section>

        <section className="rounded-xl border border-border bg-card p-4 xl:col-span-2">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold">Devices</h2>
            <Badge variant="muted">{project.devices.length}</Badge>
            <span className="text-[10px] text-muted-foreground">每个 device 输出一份 trime.yaml；共享内容只写一次</span>
            <Select className="ml-auto h-8 w-40 text-xs" value="" onChange={(event) => { addDevice(Number(event.target.value)); event.target.value = ""; }}>
              <option value="">+ Add device</option>
              {DEVICE_PRESETS.map((preset, index) => <option key={preset.label} value={index}>{preset.label}</option>)}
            </Select>
          </div>
          <div className="space-y-2">
            {project.devices.map((device, index) => (
              <div key={device.id} className="rounded-lg border border-border bg-muted/10 p-2">
                <div className="flex flex-wrap items-center gap-2">
                  <code className="rounded bg-muted px-1.5 py-0.5 text-[10px]">{device.id}</code>
                  <Select className="h-7 w-24" value={device.kind} onChange={(event) => updateDevice(index, (draft) => { draft.kind = event.target.value as DeviceKind; if (draft.kind !== "fold") delete draft.foldState; })}>
                    <option value="phone">phone</option>
                    <option value="fold">fold</option>
                    <option value="tablet">tablet</option>
                  </Select>
                  <Select className="h-7 w-28" value={device.orientation} onChange={(event) => updateDevice(index, (draft) => { draft.orientation = event.target.value as Orientation; })}>
                    <option value="portrait">portrait</option>
                    <option value="landscape">landscape</option>
                  </Select>
                  {device.kind === "fold" ? (
                    <Select className="h-7 w-28" value={device.foldState ?? "unfolded"} onChange={(event) => updateDevice(index, (draft) => { draft.foldState = event.target.value as FoldState; })}>
                      <option value="folded">folded</option>
                      <option value="unfolded">unfolded</option>
                    </Select>
                  ) : null}
                  <Select className="h-7 w-40" value={device.mainLayoutId ?? ""} onChange={(event) => setDeviceMainLayout(index, event.target.value)}>
                    <option value="">Inherit main layout</option>
                    {device.mainLayoutId && !mainLayouts.some((item) => item.id === device.mainLayoutId) ? <option value={device.mainLayoutId}>{device.mainLayoutId} · missing</option> : null}
                    {mainLayouts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </Select>
                  <Button size="sm" variant="ghost" className="ml-auto h-7 px-1 text-red-300" disabled={project.devices.length <= 1} onClick={() => removeDevice(index)}><Trash2 /></Button>
                </div>
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-4">
                  {DEVICE_METRIC_FIELDS.map(([field, label, fallback]) => (
                    <Field key={field} label={label}>
                      <Input
                        className="h-7"
                        type="number"
                        value={device.metrics?.[field] ?? ""}
                        placeholder={`inherit · ${fallback}`}
                        onChange={(event) => updateDeviceMetric(index, field, event.target.value)}
                      />
                    </Field>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[10px] text-muted-foreground">device 只保存差异：主布局与 metrics 覆盖，其余继承项目级设置。</p>
        </section>

        <section className="rounded-xl border border-border bg-card p-4 xl:col-span-2">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold">Schema bindings</h2>
            <Badge variant="muted">{project.schemaBindings.length}</Badge>
            <span className="text-[10px] text-muted-foreground">schema_id → keyset，输出 alias keyboard（import_preset）</span>
            <Button size="sm" variant="outline" className="ml-auto h-8" onClick={addBinding}><Plus />Add binding</Button>
          </div>
          {project.schemaBindings.length === 0 ? (
            <p className="py-2 text-[10px] text-muted-foreground">还没有 schema 绑定。添加后会在 preset_keyboards 里生成 alias，例如 <code>schema_luna_pinyin: import_preset: qwerty26</code>。</p>
          ) : (
            <div className="space-y-2">
              {project.schemaBindings.map((binding, index) => (
                <div key={index} className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/10 p-2">
                  <Input className="h-7 w-44" value={binding.schemaId} placeholder="schema_id（如 luna_pinyin）" onChange={(event) => updateBinding(index, { schemaId: event.target.value })} />
                  <Select className="h-7 w-40" value={binding.layoutId} onChange={(event) => setBindingLayout(index, event.target.value)}>
                    {!mainLayouts.some((item) => item.id === binding.layoutId) ? <option value={binding.layoutId}>{binding.layoutId} · missing</option> : null}
                    {mainLayouts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </Select>
                  <Input className="h-7 w-40" value={binding.alias ?? ""} placeholder="alias（可留空自动生成）" onChange={(event) => updateBinding(index, { alias: event.target.value })} />
                  <code className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{bindingAlias(binding)}</code>
                  <Button size="sm" variant="ghost" className="ml-auto h-7 px-1 text-red-300" onClick={() => removeBinding(index)}><Trash2 /></Button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-xl border border-border bg-card p-4 xl:col-span-2">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold">Snapshots · IndexedDB</h2>
            <Badge variant="muted">{snapshots.length} / 20</Badge>
            <span className="text-[10px] text-muted-foreground">Save 前自动快照；可恢复、导出或删除</span>
            <div className="ml-auto flex items-center gap-1">
              <Input className="h-8 w-44" placeholder="快照名称（可选）" value={snapshotLabel} onChange={(event) => setSnapshotLabel(event.target.value)} />
              <Button size="sm" variant="outline" onClick={() => { onSnapshot(snapshotLabel); setSnapshotLabel(""); }}><Plus />Take snapshot</Button>
            </div>
          </div>
          <div className="mb-2 flex flex-wrap gap-1">
            <Button size="sm" variant="outline" className="h-8" onClick={onExportSnapshotBundle}><Download />Export snapshot bundle</Button>
            <label className="inline-flex h-8 cursor-pointer items-center gap-1 rounded border border-border px-2 text-xs hover:bg-muted">
              <Upload className="size-3" /> Import snapshot bundle
              <input type="file" accept=".json,application/json" hidden onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) onImportSnapshotBundle(file);
              }} />
            </label>
            <span className="self-center text-[9px] text-muted-foreground">快照包只含当前项目的 IndexedDB 快照，可跨浏览器迁移</span>
          </div>
          {snapshots.length === 0 ? (
            <p className="py-2 text-[10px] text-muted-foreground">还没有快照。点击 Take snapshot，或修改项目后 Save 会自动生成一份“before save”快照。</p>
          ) : (
            <div className="grid grid-cols-1 gap-1 md:grid-cols-2">
              {snapshots.map((snapshot) => (
                <div key={snapshot.key} className="flex items-center gap-1 rounded border border-border bg-muted/10 px-2 py-1.5 text-[10px]">
                  <div className="min-w-0 flex-1">
                    <div className="truncate" title={snapshot.label}>{snapshot.label}</div>
                    <div className="text-[9px] text-muted-foreground">{new Date(snapshot.createdAt).toLocaleString()}</div>
                  </div>
                  <Button size="sm" variant="outline" className="h-7" onClick={() => onRestoreSnapshot(snapshot)}>Restore</Button>
                  <Button size="sm" variant="ghost" className="h-7 px-1 text-[9px]" title="导出快照 bundle JSON" onClick={() => onExportSnapshot(snapshot, "json")}>JSON</Button>
                  <Button size="sm" variant="ghost" className="h-7 px-1 text-[9px]" title="导出快照 trime.yaml" onClick={() => onExportSnapshot(snapshot, "yaml")}>YAML</Button>
                  <button type="button" className="px-1 text-red-300" onClick={() => onDeleteSnapshot(snapshot.key)}><Trash2 className="size-3" /></button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-xl border border-border bg-card p-4 xl:col-span-2">
          <h2 className="mb-3 text-sm font-semibold">Composition</h2>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Theme card" value={card.name} detail={project.variant} />
            <Stat label="Main layout" value={main?.name ?? "—"} detail={project.mainLayoutId} />
            <Stat label="Pages" value={allPages.map((item) => item.name).join(" / ")} detail={`${allPages.length} keyboards`} />
            <Stat label="Macros" value={String(project.macros.length)} detail={`${libs.macros.length} available`} />
            <Stat label="Key styles" value={String(Object.keys(project.keyStyles).length)} detail="token references" />
            <Stat label="Layouts" value={String(project.layouts.length)} detail="embedded in bundle" />
            <Stat label="Devices" value={String(project.devices.length)} detail={project.devices.map((device) => device.kind).join(" / ")} />
            <Stat label="Schema bindings" value={String(project.schemaBindings.length)} detail="schema_id → layout" />
            <Stat label="Toolbar" value={`${project.chrome?.toolbar.buttons.length ?? 0} buttons`} detail={project.chrome?.toolbar.backStyle ?? "—"} />
            <Stat label="Liquid" value={`${project.chrome?.liquid.tabs.length ?? 0} tabs`} detail={project.chrome?.liquid.tabs.map((tab) => tab.name).join(" / ") ?? "—"} />
            <Stat label="Raw preset keys" value={String(Object.keys(project.customPresetKeys ?? {}).length)} detail="imported command/select keys" />
            <Stat label="Passthrough" value={String(Object.keys(project.passthrough ?? {}).length)} detail="unmodelled fields" />
          </div>
          <p className="mt-3 text-[10px] text-muted-foreground">
            编译只读取这份 bundle，并输出一份完整 trime.yaml；导出在 Export 页复制或下载。
          </p>
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/20 px-3 py-2">
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="truncate text-xs font-medium" title={value}>{value}</div>
      <div className="truncate text-[9px] text-muted-foreground" title={detail}>{detail}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1"><Label>{label}</Label>{children}</div>;
}
