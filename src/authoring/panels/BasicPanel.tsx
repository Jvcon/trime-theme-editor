import { useState } from "react";
import { Download, Plus, Save, Trash2, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { PresetLibraries, ProjectDoc } from "../types";
import type { Snapshot } from "../storage";
import { pages } from "../utils";

type Props = {
  project: ProjectDoc;
  projects: ProjectDoc[];
  libs: PresetLibraries;
  dirty: boolean;
  mutate: (fn: (draft: ProjectDoc) => void) => void;
  onSave: () => void;
  onNew: () => void;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onImportJson: (file: File) => void;
  onImportYaml: (file: File) => void;
  onExportJson: () => void;
  snapshots: Snapshot[];
  onSnapshot: (label: string) => void;
  onRestoreSnapshot: (snapshot: Snapshot) => void;
  onDeleteSnapshot: (key: string) => void;
  onExportSnapshot: (snapshot: Snapshot, format: "json" | "yaml") => void;
  onExportSnapshotBundle: () => void;
  onImportSnapshotBundle: (file: File) => void;
};

export function BasicPanel({ project, projects, libs, dirty, mutate, onSave, onNew, onOpen, onDelete, onImportJson, onImportYaml, onExportJson, snapshots, onSnapshot, onRestoreSnapshot, onDeleteSnapshot, onExportSnapshot, onExportSnapshotBundle, onImportSnapshotBundle }: Props) {
  const [snapshotLabel, setSnapshotLabel] = useState("");
  const card = libs.themeCards.find((item) => item.id === project.themeCardId);
  const main = libs.layouts.find((item) => item.id === project.layoutId);
  const allPages = pages(project, libs);

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
                <Select value={project.themeCardId} onChange={(event) => mutate((draft) => { draft.themeCardId = event.target.value; })}>
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
              <Select value={project.layoutId} onChange={(event) => mutate((draft) => { draft.layoutId = event.target.value; })}>
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
              <Upload className="size-3" /> Import JSON
              <input type="file" accept=".json,application/json" hidden onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) onImportJson(file);
              }} />
            </label>
            <Button size="sm" variant="outline" onClick={onExportJson}><Download />Export JSON</Button>
            <label className="inline-flex h-8 cursor-pointer items-center gap-1 rounded border border-border px-2 text-xs hover:bg-muted">
              <Upload className="size-3" /> Import trime.yaml
              <input type="file" accept=".yaml,.yml,text/yaml" hidden onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) onImportYaml(file);
              }} />
            </label>
          </div>
          <p className="mt-2 text-[10px] text-muted-foreground">项目 JSON 含自定义色卡/布局/宏，导入后即可复现。也可以导入一份现有 trime.yaml（或 rime/trime.base.yaml），把 preset_keyboards / preset_keys / preset_color_schemes 转成可编辑项目。</p>
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
                  <Button size="sm" variant="ghost" className="h-7 px-1 text-[9px]" title="导出快照项目 JSON" onClick={() => onExportSnapshot(snapshot, "json")}>JSON</Button>
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
            <Stat label="Theme card" value={card?.name ?? "—"} detail={project.variant} />
            <Stat label="Main layout" value={main?.name ?? "—"} detail={project.layoutId} />
            <Stat label="Pages" value={allPages.map((item) => item.name).join(" / ")} detail={`${allPages.length} keyboards`} />
            <Stat label="Macros" value={String(project.macroIds.length)} detail={`${libs.macros.length} available`} />
            <Stat label="Key styles" value={String(Object.keys(project.keyStyles).length)} detail="token references" />
            <Stat label="Custom layouts" value={String(project.customLayouts?.length ?? 0)} detail="saved in project" />
            <Stat label="Custom macros" value={String(project.customMacros?.length ?? 0)} detail="saved in project" />
            <Stat label="Custom cards" value={String(project.customThemeCards?.length ?? 0)} detail="saved in project" />
            <Stat label="Toolbar" value={`${project.chrome?.toolbar.buttons.length ?? 0} buttons`} detail={project.chrome?.toolbar.backStyle ?? "—"} />
            <Stat label="Liquid" value={`${project.chrome?.liquid.tabs.length ?? 0} tabs`} detail={project.chrome?.liquid.tabs.map((tab) => tab.name).join(" / ") ?? "—"} />
            <Stat label="Raw preset keys" value={String(Object.keys(project.customPresetKeys ?? {}).length)} detail="imported command/select keys" />
          </div>
          <p className="mt-3 text-[10px] text-muted-foreground">
            编译只输出一份完整 trime.yaml；不读取、不写入 rime/ 仓库。导出在 Export 页复制或下载。
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
