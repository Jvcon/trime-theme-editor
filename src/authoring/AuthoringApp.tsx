import { useEffect, useMemo, useState } from "react";
import { Boxes, Copy, Download, Save, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { compileBundle, defaultBundle } from "./compiler";
import { deleteProject, deleteSnapshot, importSnapshots, listProjects, listSnapshots, loadProject, saveProject, saveSnapshot, type Snapshot } from "./storage";
import { BasicPanel } from "./panels/BasicPanel";
import { ExportPanel } from "./panels/ExportPanel";
import { LayoutsPanel } from "./panels/LayoutsPanel";
import { InterfacePanel } from "./panels/InterfacePanel";
import { MacrosPanel } from "./panels/MacrosPanel";
import { ThemesPanel } from "./panels/ThemesPanel";
import { ImportDialog } from "./ImportDialog";
import type { LayoutPreset, ProjectBundle } from "./types";
import { libraries, normalizeBundle, portableBundle, slug } from "./utils";

type Board = "basic" | "layouts" | "themes" | "interface" | "macros" | "export";

const BOARDS: Array<{ id: Board; label: string }> = [
  { id: "basic", label: "Basic" },
  { id: "layouts", label: "Layouts" },
  { id: "themes", label: "Themes" },
  { id: "interface", label: "Interface" },
  { id: "macros", label: "Macros" },
  { id: "export", label: "Export" },
];

type Props = { open?: boolean; onClose?: () => void };

export function AuthoringApp({ open = true, onClose }: Props) {
  const [project, setProject] = useState<ProjectBundle>(() => defaultBundle());
  const [projects, setProjects] = useState<ProjectBundle[]>([]);
  const [board, setBoard] = useState<Board>("layouts");
  const [activeLayoutId, setActiveLayoutId] = useState(project.mainLayoutId);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [pendingImport, setPendingImport] = useState<{ source: string; fileName: string } | null>(null);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);

  const libs = useMemo(() => libraries(project), [project]);
  const yaml = useMemo(() => compileBundle(project), [project]);

  const refreshProjects = async (): Promise<ProjectBundle[]> => {
    const items = await listProjects();
    setProjects(items);
    return items;
  };

  const refreshSnapshots = async (projectId: string): Promise<Snapshot[]> => {
    const items = await listSnapshots(projectId);
    setSnapshots(items);
    return items;
  };

  const sameProject = (left: ProjectBundle, right: ProjectBundle): boolean => {
    const strip = (value: ProjectBundle) => {
      const copy = normalizeBundle(value);
      delete copy.updatedAt;
      return JSON.stringify(copy);
    };
    return strip(left) === strip(right);
  };

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      try {
        const items = await listProjects();
        if (cancelled) return;
        setProjects(items);
        if (items[0]) {
          const next = normalizeBundle(items[0]);
          setProject(next);
          setActiveLayoutId(next.mainLayoutId);
          setMessage(`已打开：${next.meta.name}`);
        }
      } catch (error) {
        if (!cancelled) setMessage(`IndexedDB 不可用：${String(error)}`);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!libs.layouts.some((item) => item.id === activeLayoutId)) {
      setActiveLayoutId(project.mainLayoutId);
    }
  }, [activeLayoutId, libs.layouts, project.mainLayoutId]);

  useEffect(() => {
    if (!open) return;
    void refreshSnapshots(project.id).catch((error) => setMessage(`快照读取失败：${String(error)}`));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, project.id]);

  const mutate = (fn: (draft: ProjectBundle) => void) => {
    setProject((current) => {
      const next = structuredClone(current);
      fn(next);
      return next;
    });
    setDirty(true);
  };

  const editLayout = (id: string, fn: (layout: LayoutPreset) => void) => {
    const source = libraries(project).layouts.find((item) => item.id === id);
    const embedded = project.layouts.some((item) => item.id === id);
    const cloneId = !embedded || source?.builtin ? `custom-${id}-${Date.now()}` : undefined;
    setProject((current) => {
      const next = structuredClone(current);
      const currentSource = libraries(next).layouts.find((item) => item.id === id);
      if (!currentSource) return next;
      if (cloneId) {
        const clone = { ...structuredClone(currentSource), id: cloneId, builtin: false, name: `${currentSource.name}（自定义）` };
        next.layouts = next.layouts.filter((item) => item.id !== id);
        next.layouts.push(clone);
        if (next.mainLayoutId === id) next.mainLayoutId = cloneId;
        next.pageIds = next.pageIds.map((pageId) => (pageId === id ? cloneId : pageId));
        fn(clone);
      } else {
        const target = next.layouts.find((item) => item.id === id);
        if (target) fn(target);
      }
      return next;
    });
    if (cloneId) setActiveLayoutId(cloneId);
    setDirty(true);
  };

  const save = async () => {
    try {
      const existing = await loadProject(project.id);
      if (existing && !sameProject(existing, project)) {
        await saveSnapshot(existing, "Auto · before save");
      }
      await saveProject(project);
      await refreshProjects();
      await refreshSnapshots(project.id);
      setDirty(false);
      setMessage(`已保存到 IndexedDB：${project.meta.name}`);
    } catch (error) {
      setMessage(`保存失败：${String(error)}`);
    }
  };

  const takeSnapshot = async (label?: string) => {
    try {
      await saveSnapshot(project, label?.trim() || `Manual · ${new Date().toLocaleString()}`);
      await refreshSnapshots(project.id);
      setMessage("已创建快照");
    } catch (error) {
      setMessage(`快照失败：${String(error)}`);
    }
  };

  const exportSnapshot = (snapshot: Snapshot, format: "json" | "yaml") => {
    const stamp = new Date(snapshot.createdAt).toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const next = normalizeBundle(snapshot.project);
    const name = `${slug(next.meta.name)}-${stamp}`;
    if (format === "json") {
      downloadText(JSON.stringify(portableBundle(next), null, 2), `${name}.json`, "application/json;charset=utf-8");
    } else {
      const deviceId = next.devices[0]?.id ?? "device";
      downloadText(compileBundle(next, deviceId), `${name}-${deviceId}.yaml`, "text/yaml;charset=utf-8");
    }
    setMessage(`已导出快照：${snapshot.label}`);
  };

  const exportSnapshotBundle = () => {
    const bundle = {
      format: "trime-theme-snapshots",
      version: 2,
      projectId: project.id,
      projectName: project.meta.name,
      exportedAt: new Date().toISOString(),
      snapshots,
    };
    downloadText(JSON.stringify(bundle, null, 2), `${slug(project.meta.name)}-snapshots.json`, "application/json;charset=utf-8");
    setMessage(`已导出 ${snapshots.length} 个快照`);
  };

  const importSnapshotBundle = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text()) as { format?: string; version?: number; snapshots?: Snapshot[] };
      if (parsed.format !== "trime-theme-snapshots" || parsed.version !== 2 || !Array.isArray(parsed.snapshots)) {
        throw new Error("不是 trime-theme-snapshots v2");
      }
      const count = await importSnapshots(project.id, parsed.snapshots);
      await refreshSnapshots(project.id);
      setMessage(`已导入 ${count} 个快照（${file.name}）`);
    } catch (error) {
      setMessage(`导入快照包失败：${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const restoreSnapshot = async (snapshot: Snapshot) => {
    try {
      if (!sameProject(project, snapshot.project)) {
        await saveSnapshot(project, "Auto · before restore");
      }
      const next = normalizeBundle(snapshot.project);
      setProject(next);
      setActiveLayoutId(next.mainLayoutId);
      setDirty(true);
      setMessage(`已恢复快照：${snapshot.label}`);
      await refreshSnapshots(project.id);
    } catch (error) {
      setMessage(`恢复失败：${String(error)}`);
    }
  };

  const removeSnapshot = async (key: string) => {
    await deleteSnapshot(key);
    await refreshSnapshots(project.id);
  };

  const createProject = () => {
    const next = defaultBundle();
    next.id = `project-${Date.now()}`;
    next.meta.name = `新主题 ${projects.length + 1}`;
    setProject(next);
    setActiveLayoutId(next.mainLayoutId);
    setBoard("basic");
    setDirty(true);
    setMessage("已新建项目（记得 Save）");
  };

  const openProject = async (id: string) => {
    const loaded = await loadProject(id);
    if (!loaded) return;
    setProject(loaded);
    setActiveLayoutId(loaded.mainLayoutId);
    setDirty(false);
    setMessage(`已打开：${loaded.meta.name}`);
  };

  const removeProject = async (id: string) => {
    await deleteProject(id);
    const items = await refreshProjects();
    if (id === project.id) {
      const fallback = items[0] ?? defaultBundle();
      setProject(fallback);
      setActiveLayoutId(fallback.mainLayoutId);
      setDirty(!items[0]);
      await refreshSnapshots(fallback.id);
    }
    setMessage("已删除项目");
  };

  const importBundle = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text()) as ProjectBundle;
      if (parsed.format !== "trime-theme-bundle" || parsed.schemaVersion !== 2 || !parsed.meta || !parsed.theme) {
        throw new Error("不是 trime-theme-bundle v2");
      }
      const next = normalizeBundle(parsed);
      setProject(next);
      setActiveLayoutId(next.mainLayoutId);
      setDirty(true);
      setMessage(`已导入 bundle：${file.name}（记得 Save）`);
    } catch (error) {
      setMessage(`导入失败：${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const pickImportYaml = async (file: File) => {
    try {
      setPendingImport({ source: await file.text(), fileName: file.name });
    } catch (error) {
      setMessage(`读取 YAML 失败：${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const applyImport = (next: ProjectBundle, warnings: string[]) => {
    setProject(next);
    setActiveLayoutId(next.mainLayoutId);
    setDirty(true);
    setPendingImport(null);
    setMessage(warnings[0] ?? "已导入 trime.yaml（记得 Save）");
  };

  const downloadText = (content: string, name: string, type = "text/plain;charset=utf-8") => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = name;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const exportBundle = () => downloadText(JSON.stringify(portableBundle(project), null, 2), `${project.id}.json`, "application/json;charset=utf-8");

  const copyYaml = async () => {
    await navigator.clipboard.writeText(yaml);
    setMessage("已复制 trime.yaml");
  };

  if (!open) return null;

  return (
    <div className={`${onClose ? "fixed inset-0 z-50" : "h-full"} flex flex-col bg-background text-foreground`}>
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-card/60 px-4">
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-blue-500 to-teal-400 text-slate-950">
          <Boxes className="size-4" />
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold">Trime Theme Editor</div>
          <div className="text-[10px] text-muted-foreground">typed presets · compose · export yaml</div>
        </div>

        <div className="ml-4 flex items-center gap-0.5 rounded-md border border-border bg-muted/30 p-0.5">
          {BOARDS.map((item) => (
            <Button key={item.id} size="sm" variant={board === item.id ? "default" : "ghost"} className="h-7" onClick={() => setBoard(item.id)}>
              {item.label}
            </Button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          {message ? <span className="max-w-64 truncate text-[10px] text-muted-foreground" title={message}>{message}</span> : null}
          <Badge variant={loading ? "muted" : dirty ? "warning" : "success"}>{loading ? "loading" : dirty ? "unsaved" : "saved"}</Badge>
          <Button size="sm" variant="secondary" onClick={() => void save()}><Save />Save</Button>
          <Button size="sm" variant="outline" onClick={() => void copyYaml()}><Copy />YAML</Button>
          <Button size="sm" variant="outline" onClick={() => downloadText(yaml, `${slug(project.meta.name)}-${project.devices[0]?.id ?? "device"}.yaml`, "text/yaml;charset=utf-8")}><Download />Download</Button>
          {onClose ? <Button size="icon" variant="ghost" onClick={onClose}><X /></Button> : null}
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-hidden">
        {board === "basic" ? (
          <BasicPanel
            project={project}
            projects={projects}
            libs={libs}
            dirty={dirty}
            mutate={mutate}
            onSave={() => void save()}
            onNew={createProject}
            onOpen={(id) => void openProject(id)}
            onDelete={(id) => void removeProject(id)}
            onImportBundle={(file) => void importBundle(file)}
            onImportYaml={(file) => void pickImportYaml(file)}
            onExportBundle={exportBundle}
            snapshots={snapshots}
            onSnapshot={(label) => void takeSnapshot(label)}
            onRestoreSnapshot={(snapshot) => void restoreSnapshot(snapshot)}
            onDeleteSnapshot={(key) => void removeSnapshot(key)}
            onExportSnapshot={exportSnapshot}
            onExportSnapshotBundle={exportSnapshotBundle}
            onImportSnapshotBundle={(file) => void importSnapshotBundle(file)}
          />
        ) : null}
        {board === "layouts" ? (
          <LayoutsPanel
            project={project}
            libs={libs}
            activeLayoutId={activeLayoutId}
            setActiveLayoutId={setActiveLayoutId}
            mutate={mutate}
            editLayout={editLayout}
            setMessage={setMessage}
          />
        ) : null}
        {board === "themes" ? <ThemesPanel project={project} libs={libs} mutate={mutate} setMessage={setMessage} /> : null}
        {board === "interface" ? <InterfacePanel project={project} libs={libs} mutate={mutate} setMessage={setMessage} /> : null}
        {board === "macros" ? <MacrosPanel project={project} libs={libs} mutate={mutate} setMessage={setMessage} /> : null}
        {board === "export" ? <ExportPanel project={project} snapshots={snapshots} setMessage={setMessage} /> : null}
      </main>

      {pendingImport ? (
        <ImportDialog
          source={pendingImport.source}
          fileName={pendingImport.fileName}
          onApply={applyImport}
          onCancel={() => setPendingImport(null)}
        />
      ) : null}
    </div>
  );
}
