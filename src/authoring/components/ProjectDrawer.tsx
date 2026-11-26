import { useState } from "react";
import { Download, Plus, Save, Trash2, Upload, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Snapshot } from "../storage";
import type { ProjectBundle } from "../types";

type Props = {
  open: boolean;
  onClose: () => void;
  project: ProjectBundle;
  projects: ProjectBundle[];
  snapshots: Snapshot[];
  onSave: () => void;
  onNew: () => void;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onImportBundle: (file: File) => void;
  onImportYaml: (files: File[]) => void;
  onExportBundle: () => void;
  onSnapshot: (label: string) => void;
  onRestoreSnapshot: (snapshot: Snapshot) => void;
  onDeleteSnapshot: (key: string) => void;
  onExportSnapshot: (snapshot: Snapshot, format: "json" | "yaml") => void;
  onExportSnapshotBundle: () => void;
  onImportSnapshotBundle: (file: File) => void;
  onOpenMacros: () => void;
  onOpenAdvanced: () => void;
};

export function ProjectDrawer(props: Props) {
  const {
    open, onClose, project, projects, snapshots,
    onSave, onNew, onOpen, onDelete,
    onImportBundle, onImportYaml, onExportBundle,
    onSnapshot, onRestoreSnapshot, onDeleteSnapshot,
    onExportSnapshot, onExportSnapshotBundle, onImportSnapshotBundle,
    onOpenMacros, onOpenAdvanced,
  } = props;
  const [snapshotLabel, setSnapshotLabel] = useState("");

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-overlay" aria-hidden="true" onClick={onClose} />
      <aside role="dialog" aria-modal="true" aria-label="项目抽屉" className="relative z-10 flex h-full w-full max-w-xl flex-col border-l border-border bg-background">
        <div className="flex items-center gap-stack border-b border-border px-panel py-3">
          <span className="text-sm font-semibold">项目</span>
          <Badge variant="muted">只保存在本机 IndexedDB</Badge>
          <Button size="icon" variant="ghost" className="ml-auto" onClick={onClose}><X /></Button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-auto p-panel">
          <section className="rounded-xl border border-border bg-card p-gutter">
            <div className="mb-2 flex items-center gap-stack">
              <h3 className="text-xs font-semibold">项目列表</h3>
              <div className="ml-auto flex gap-1">
                <Button size="sm" variant="outline" onClick={onNew}><Plus />新建</Button>
                <Button size="sm" variant="secondary" onClick={onSave}><Save />保存</Button>
              </div>
            </div>
            <div className="space-y-1">
              {projects.map((item) => (
                <div key={item.id} className={`flex items-center gap-1 rounded border px-2 py-1 text-xs ${item.id === project.id ? "border-primary bg-primary/5" : "border-border"}`}>
                  <button type="button" className="min-w-0 flex-1 truncate text-left" aria-current={item.id === project.id ? "true" : undefined} onClick={() => onOpen(item.id)}>{item.meta.name}</button>
                  <span className="text-3xs text-muted-foreground">{item.id}</span>
                  <button type="button" className="text-destructive" aria-label={`删除项目 ${item.meta.name}`} onClick={() => onDelete(item.id)}><Trash2 className="size-3" /></button>
                </div>
              ))}
              {projects.length === 0 ? <p className="py-2 text-2xs text-muted-foreground">还没有保存的项目，点击保存写入 IndexedDB。</p> : null}
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card p-gutter">
            <h3 className="mb-2 text-xs font-semibold">导入 / 导出项目文件</h3>
            <div className="flex flex-wrap gap-1">
              <label className="inline-flex h-control cursor-pointer items-center gap-1 rounded-control border border-border px-2 text-xs transition-colors hover:bg-surface-hover active:bg-surface-active focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background">
                <Upload className="size-3" /> 导入项目 JSON
                <input type="file" accept=".json,application/json" className="sr-only" onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (file) onImportBundle(file);
                }} />
              </label>
              <Button size="sm" variant="outline" onClick={onExportBundle}><Download />导出项目 JSON</Button>
              <label className="inline-flex h-control cursor-pointer items-center gap-1 rounded-control border border-border px-2 text-xs transition-colors hover:bg-surface-hover active:bg-surface-active focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background">
                <Upload className="size-3" /> 导入 trime.yaml
                <input type="file" accept=".yaml,.yml,text/yaml" multiple className="sr-only" onChange={(event) => {
                  const files = Array.from(event.target.files ?? []);
                  event.target.value = "";
                  if (files.length > 0) onImportYaml(files);
                }} />
              </label>
            </div>
            <p className="mt-2 text-2xs text-muted-foreground">项目文件包含当前浅色/深色方案、自定义色卡、布局、宏，以及你保留的自定义布局；导入 trime.yaml 会展开受支持的 include 并生成 import report。</p>
          </section>

          <section className="rounded-xl border border-border bg-card p-gutter">
            <div className="mb-2 flex flex-wrap items-center gap-stack">
              <h3 className="text-xs font-semibold">快照</h3>
              <Badge variant="muted">{snapshots.length} / 20</Badge>
              <span className="text-3xs text-muted-foreground">保存前自动快照</span>
              <div className="ml-auto flex items-center gap-1">
                <Input className="h-control w-40" placeholder="快照名称（可选）" value={snapshotLabel} onChange={(event) => setSnapshotLabel(event.target.value)} />
                <Button size="sm" variant="outline" onClick={() => { onSnapshot(snapshotLabel); setSnapshotLabel(""); }}><Plus />创建</Button>
              </div>
            </div>
            <div className="mb-2 flex flex-wrap gap-1">
              <Button size="sm" variant="outline" className="h-control" onClick={onExportSnapshotBundle}><Download />导出快照包</Button>
              <label className="inline-flex h-control cursor-pointer items-center gap-1 rounded-control border border-border px-2 text-xs transition-colors hover:bg-surface-hover active:bg-surface-active focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background">
                <Upload className="size-3" /> 导入快照包
                <input type="file" accept=".json,application/json" className="sr-only" onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (file) onImportSnapshotBundle(file);
                }} />
              </label>
            </div>
            {snapshots.length === 0 ? (
              <p className="py-2 text-2xs text-muted-foreground">还没有快照。创建快照，或保存时自动生成一份 "before save"。</p>
            ) : (
              <div className="space-y-1">
                {snapshots.map((snapshot) => (
                  <div key={snapshot.key} className="flex items-center gap-1 rounded border border-border bg-muted/10 px-2 py-1.5 text-2xs">
                    <div className="min-w-0 flex-1">
                      <div className="truncate" title={snapshot.label}>{snapshot.label}</div>
                      <div className="text-3xs text-muted-foreground">{new Date(snapshot.createdAt).toLocaleString()}</div>
                    </div>
                    <Button size="sm" variant="outline" className="h-control-sm" onClick={() => onRestoreSnapshot(snapshot)}>恢复</Button>
                    <Button size="sm" variant="ghost" className="h-control-sm px-1 text-3xs" title="导出快照 JSON" onClick={() => onExportSnapshot(snapshot, "json")}>JSON</Button>
                    <Button size="sm" variant="ghost" className="h-control-sm px-1 text-3xs" title="导出快照 trime.yaml" onClick={() => onExportSnapshot(snapshot, "yaml")}>YAML</Button>
                    <button type="button" className="px-1 text-destructive" aria-label={`删除快照 ${snapshot.label}`} onClick={() => onDeleteSnapshot(snapshot.key)}><Trash2 className="size-3" /></button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-xl border border-border bg-card p-gutter">
            <h3 className="mb-2 text-xs font-semibold">工具</h3>
            <div className="flex flex-wrap gap-1">
              <Button size="sm" variant="outline" onClick={onOpenMacros}>宏（可选）</Button>
              <Button size="sm" variant="outline" onClick={onOpenAdvanced}>高级 · schema 绑定 / 原始字段</Button>
            </div>
          </section>
        </div>
      </aside>
    </div>
  );
}
