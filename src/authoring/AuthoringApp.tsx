import { useEffect, useMemo, useRef, useState } from "react";
import { Boxes, Copy, Download, Eye, EyeOff, FolderOpen, Redo2, Save, SlidersHorizontal, Undo2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ThemeModeToggle } from "@/components/ThemeModeToggle";
import { blankBundle, compileBundle } from "./compiler";
import { deleteProject, deleteSnapshot, importSnapshots, listProjects, listSnapshots, loadProject, saveProject, saveSnapshot, type Snapshot } from "./storage";
import { AdvancedDrawer } from "./components/AdvancedDrawer";
import { LandingScreen } from "./components/LandingScreen";
import { PreviewRail } from "./components/PreviewRail";
import { ProjectDrawer } from "./components/ProjectDrawer";
import { Stepper } from "./components/Stepper";
import type { DropPosition, KeyPosition } from "./components/KeyboardPreview";
import { stepStatuses, type StepId } from "./flow";
import { DevicesPanel } from "./panels/DevicesPanel";
import { ExportPanel } from "./panels/ExportPanel";
import { InterfacePanel } from "./panels/InterfacePanel";
import { LayoutsPanel } from "./panels/LayoutsPanel";
import { MacrosPanel } from "./panels/MacrosPanel";
import { ThemesPanel } from "./panels/ThemesPanel";
import { ImportDialog } from "./ImportDialog";
import type { LayoutPreset, Orientation, ProjectBundle } from "./types";
import { embedLayout, firstLayoutId, libraries, normalizeBundle, portableBundle, slug } from "./utils";

type Board = StepId | "start" | "macros";

const STATE_LABEL = {
  done: "完成",
  warning: "待确认",
  error: "有错误",
  default: "使用默认",
} as const;

type Props = { open?: boolean; onClose?: () => void };

export function AuthoringApp({ open = true, onClose }: Props) {
  const [project, setProject] = useState<ProjectBundle>(() => blankBundle());
  const [projects, setProjects] = useState<ProjectBundle[]>([]);
  const [board, setBoard] = useState<Board>("theme");
  const [activeLayoutId, setActiveLayoutId] = useState(() => firstLayoutId(project));
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [pendingImport, setPendingImport] = useState<{ source: string; fileName: string; resources: Record<string, string> } | null>(null);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [projectsOpen, setProjectsOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(true);
  const [previewDeviceId, setPreviewDeviceId] = useState(project.devices[0]?.id ?? "phone");
  const [previewOrientation, setPreviewOrientation] = useState<Orientation>(project.devices[0]?.orientation ?? "portrait");
  const [selectedKey, setSelectedKey] = useState<KeyPosition>();
  const [popupKey, setPopupKey] = useState<KeyPosition>();
  const [rightTab, setRightTab] = useState("page");

  const projectRef = useRef(project);
  const historyRef = useRef<ProjectBundle[]>([]);
  const futureRef = useRef<ProjectBundle[]>([]);

  const libs = useMemo(() => libraries(project), [project]);
  const yaml = useMemo(() => compileBundle(project), [project]);
  const hasLayoutEntry = project.layoutGroupIds.length > 0
    && project.devices.every((device) => Boolean(device.layoutId ?? project.defaultLayoutId));
  const statuses = useMemo(() => stepStatuses(project, { schema: board === "export" }), [project, board]);
  const currentStatus = statuses.find((status) => status.id === board);
  const activeLayoutName = libs.layouts.find((item) => item.id === activeLayoutId)?.name;

  useEffect(() => {
    projectRef.current = project;
  }, [project]);

  useEffect(() => {
    setPreviewDeviceId((current) => (
      project.devices.some((device) => device.id === current) ? current : project.devices[0]?.id ?? ""
    ));
  }, [project.devices]);

  const resetHistory = () => {
    historyRef.current = [];
    futureRef.current = [];
  };

  const pushHistory = (snapshot: ProjectBundle) => {
    historyRef.current.push(structuredClone(snapshot));
    if (historyRef.current.length > 50) historyRef.current.shift();
    futureRef.current = [];
  };

  const commit = (fn: (draft: ProjectBundle) => void) => {
    const current = projectRef.current;
    const next = structuredClone(current);
    fn(next);
    pushHistory(current);
    projectRef.current = next;
    setProject(next);
    setDirty(true);
  };

  const adoptProject = (next: ProjectBundle, record: boolean) => {
    if (record && next.id === projectRef.current.id) pushHistory(projectRef.current);
    else resetHistory();
    projectRef.current = next;
    setProject(next);
    setActiveLayoutId(firstLayoutId(next));
    setPreviewDeviceId(next.devices[0]?.id ?? "");
    setPreviewOrientation(next.devices[0]?.orientation ?? "portrait");
  };

  const undo = () => {
    const previous = historyRef.current.pop();
    if (!previous) {
      setMessage("没有可撤销的操作");
      return;
    }
    futureRef.current.push(structuredClone(projectRef.current));
    projectRef.current = previous;
    setProject(previous);
    setDirty(true);
    setMessage("已撤销上一步");
  };

  const redo = () => {
    const next = futureRef.current.pop();
    if (!next) {
      setMessage("没有可重做的操作");
      return;
    }
    historyRef.current.push(structuredClone(projectRef.current));
    projectRef.current = next;
    setProject(next);
    setDirty(true);
    setMessage("已重做");
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "z") return;
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) return;
      event.preventDefault();
      if (event.shiftKey) redo();
      else undo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // History refs are stable; the handlers only read refs and set state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

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
          projectRef.current = next;
          setProject(next);
          setActiveLayoutId(firstLayoutId(next));
          setPreviewDeviceId(next.devices[0]?.id ?? "");
          setPreviewOrientation(next.devices[0]?.orientation ?? "portrait");
          setMessage(`已打开：${next.meta.name}`);
          setBoard("theme");
        } else {
          setBoard("start");
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
    const exists = Boolean(activeLayoutId && project.layouts.some((item) => item.id === activeLayoutId));
    if (!exists && project.layoutGroupIds.length > 0) {
      setActiveLayoutId(firstLayoutId(project));
    }
  }, [activeLayoutId, project.layouts, project.layoutGroupIds, project.defaultLayoutId]);

  useEffect(() => {
    if (!open) return;
    void refreshSnapshots(project.id).catch((error) => setMessage(`快照读取失败：${String(error)}`));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, project.id]);

  const editLayout = (id: string, fn: (layout: LayoutPreset) => void) => {
    commit((next) => {
      const embedded = next.layouts.find((item) => item.id === id);
      if (embedded) {
        if (embedded.builtin) {
          embedded.sourcePresetId = embedded.sourcePresetId ?? embedded.id;
          embedded.builtin = false;
        }
        fn(embedded);
        return;
      }
      // A catalog preset is only editable after it becomes a project page.
      const source = libraries(next).layouts.find((item) => item.id === id);
      if (!source) return;
      const target = embedLayout(next, source);
      fn(target);
    });
  };

  useEffect(() => {
    if (board !== "layouts") setPopupKey(undefined);
    if (board === "layouts") setPreviewOpen(true);
  }, [board]);

  const focusDevice = (id: string) => {
    const device = projectRef.current.devices.find((item) => item.id === id);
    if (!device) return;
    setPreviewDeviceId(device.id);
    setPreviewOrientation(device.orientation);
  };

  const selectKey = (position: KeyPosition | undefined) => {
    setSelectedKey(position);
    if (position) setRightTab("key");
  };

  const openPopup = (position: KeyPosition | null) => {
    setPopupKey(position ?? undefined);
    if (position) setRightTab("key");
  };

  const moveKey = (from: KeyPosition, to: DropPosition) => {
    if (from.row === to.row && (to.index === from.key || to.index === from.key + 1)) return;
    const layout = libs.layouts.find((item) => item.id === activeLayoutId);
    if (!layout) return;
    editLayout(activeLayoutId, (draft) => {
      const sourceRow = draft.rows[from.row];
      const targetRow = draft.rows[to.row];
      if (!sourceRow || !targetRow || !sourceRow.keys[from.key]) return;
      const [moved] = sourceRow.keys.splice(from.key, 1);
      let index = to.index;
      if (sourceRow === targetRow && from.key < to.index) index -= 1;
      index = Math.max(0, Math.min(index, targetRow.keys.length));
      targetRow.keys.splice(index, 0, moved);
    });
    const nextIndex = from.row === to.row && from.key < to.index ? to.index - 1 : to.index;
    setSelectedKey({ row: to.row, key: Math.max(0, Math.min(nextIndex, layout.rows[to.row]?.keys.length ?? 0)) });
    setMessage("已移动键位；注意检查行宽是否仍为 100%");
  };

  const save = async () => {
    try {
      const current = projectRef.current;
      const existing = await loadProject(current.id);
      if (existing && !sameProject(existing, current)) {
        await saveSnapshot(existing, "Auto · before save");
      }
      await saveProject(current);
      await refreshProjects();
      await refreshSnapshots(current.id);
      setDirty(false);
      setMessage(`已保存到 IndexedDB：${current.meta.name}`);
    } catch (error) {
      setMessage(`保存失败：${String(error)}`);
    }
  };

  const takeSnapshot = async (label?: string) => {
    try {
      await saveSnapshot(projectRef.current, label?.trim() || `Manual · ${new Date().toLocaleString()}`);
      await refreshSnapshots(projectRef.current.id);
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
      projectId: projectRef.current.id,
      projectName: projectRef.current.meta.name,
      exportedAt: new Date().toISOString(),
      snapshots,
    };
    downloadText(JSON.stringify(bundle, null, 2), `${slug(projectRef.current.meta.name)}-snapshots.json`, "application/json;charset=utf-8");
    setMessage(`已导出 ${snapshots.length} 个快照`);
  };

  const importSnapshotBundle = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text()) as { format?: string; version?: number; snapshots?: Snapshot[] };
      if (parsed.format !== "trime-theme-snapshots" || parsed.version !== 2 || !Array.isArray(parsed.snapshots)) {
        throw new Error("不是 trime-theme-snapshots v2");
      }
      const count = await importSnapshots(projectRef.current.id, parsed.snapshots);
      await refreshSnapshots(projectRef.current.id);
      setMessage(`已导入 ${count} 个快照（${file.name}）`);
    } catch (error) {
      setMessage(`导入快照包失败：${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const restoreSnapshot = async (snapshot: Snapshot) => {
    try {
      if (!sameProject(projectRef.current, snapshot.project)) {
        await saveSnapshot(projectRef.current, "Auto · before restore");
      }
      const next = normalizeBundle(snapshot.project);
      adoptProject(next, true);
      setDirty(true);
      setMessage(`已恢复快照：${snapshot.label}`);
      await refreshSnapshots(next.id);
    } catch (error) {
      setMessage(`恢复失败：${String(error)}`);
    }
  };

  const removeSnapshot = async (key: string) => {
    await deleteSnapshot(key);
    await refreshSnapshots(projectRef.current.id);
  };

  const createProject = () => {
    const next = blankBundle();
    next.id = `project-${Date.now()}`;
    next.meta.name = `新主题 ${projects.length + 1}`;
    adoptProject(next, false);
    setDirty(true);
    setBoard("theme");
    setProjectsOpen(false);
    setMessage("已新建项目（记得保存）");
  };

  const openProject = async (id: string) => {
    const loaded = await loadProject(id);
    if (!loaded) return;
    const next = normalizeBundle(loaded);
    resetHistory();
    projectRef.current = next;
    setProject(next);
    setActiveLayoutId(firstLayoutId(next));
    setPreviewDeviceId(next.devices[0]?.id ?? "");
    setPreviewOrientation(next.devices[0]?.orientation ?? "portrait");
    setDirty(false);
    setBoard("theme");
    setProjectsOpen(false);
    setMessage(`已打开：${next.meta.name}`);
  };

  const removeProject = async (id: string) => {
    if (!window.confirm("删除这个项目？此操作不可撤销。")) return;
    await deleteProject(id);
    const items = await refreshProjects();
    if (id === projectRef.current.id) {
      const fallback = items[0] ?? blankBundle();
      resetHistory();
      projectRef.current = fallback;
      setProject(fallback);
      setActiveLayoutId(firstLayoutId(fallback));
      setPreviewDeviceId(fallback.devices[0]?.id ?? "");
      setPreviewOrientation(fallback.devices[0]?.orientation ?? "portrait");
      setDirty(!items[0]);
      setBoard(items[0] ? "theme" : "start");
      await refreshSnapshots(fallback.id);
    }
    setMessage("已删除项目");
  };

  const importBundle = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text()) as ProjectBundle;
      const schemaVersion = (parsed as unknown as { schemaVersion?: number }).schemaVersion;
      if (parsed.format !== "trime-theme-bundle" || ![2, 3, 4].includes(schemaVersion ?? 0) || !parsed.meta || !parsed.theme) {
        throw new Error("不是 trime-theme-bundle v2/v3/v4");
      }
      const next = normalizeBundle(parsed);
      adoptProject(next, false);
      setDirty(true);
      setBoard("theme");
      setProjectsOpen(false);
      setMessage(`已导入项目文件：${file.name}（记得保存）`);
    } catch (error) {
      setMessage(`导入失败：${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const pickImportYaml = async (files: File[]) => {
    try {
      const entries = await Promise.all(files.map(async (file) => [file.name, await file.text()] as const));
      if (entries.length === 0) return;
      const preferred = entries.findIndex(([name]) => /(^|\/)trime\.ya?ml$/i.test(name));
      const mainIndex = preferred >= 0 ? preferred : 0;
      const [fileName, source] = entries[mainIndex];
      const resources = Object.fromEntries(entries.filter((_, index) => index !== mainIndex));
      setPendingImport({ source, fileName, resources });
      setProjectsOpen(false);
    } catch (error) {
      setMessage(`读取 YAML 失败：${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const applyImport = (next: ProjectBundle, warnings: string[]) => {
    adoptProject(next, false);
    setDirty(true);
    setPendingImport(null);
    setBoard("theme");
    setMessage(warnings[0] ?? "已导入 trime.yaml（记得保存）");
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

  const exportBundle = () => downloadText(JSON.stringify(portableBundle(projectRef.current), null, 2), `${projectRef.current.id}.json`, "application/json;charset=utf-8");

  const copyYaml = async () => {
    await navigator.clipboard.writeText(yaml);
    setMessage("已复制 trime.yaml");
  };

  if (!open) return null;

  return (
    <div className={`${onClose ? "fixed inset-0 z-50" : "h-full"} flex flex-col bg-background text-foreground`}>
      <header className="flex h-14 shrink-0 items-center gap-3 overflow-x-auto border-b border-border bg-card/60 px-panel">
        <div className="grid h-control w-control shrink-0 place-items-center rounded-control bg-gradient-to-br from-primary to-success text-primary-foreground shadow-control">
          <Boxes className="size-4" aria-hidden="true" />
        </div>
        <div className="min-w-0 leading-tight">
          <div className="text-sm font-semibold">Trime Theme Editor</div>
          <div className="truncate text-2xs text-muted-foreground" title={project.meta.name}>
            {board === "start" ? "从空白项目或现有主题开始" : project.meta.name}
          </div>
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          {message ? <span className="hidden max-w-56 truncate text-2xs text-muted-foreground lg:inline" title={message}>{message}</span> : null}
          <Badge variant={loading ? "muted" : dirty ? "warning" : "success"}>{loading ? "loading" : dirty ? "unsaved" : "saved"}</Badge>
          <ThemeModeToggle />
          <Button size="icon" variant="ghost" aria-label="撤销" title="撤销 (Ctrl/Cmd+Z)" onClick={undo}><Undo2 /></Button>
          <Button size="icon" variant="ghost" aria-label="重做" title="重做 (Shift+Ctrl/Cmd+Z)" onClick={redo}><Redo2 /></Button>
          <Button size="sm" variant="secondary" onClick={() => void save()}><Save />保存</Button>
          <Button size="sm" variant="outline" disabled={!hasLayoutEntry} title={!hasLayoutEntry ? "先添加布局，并设置默认布局或给每台设备绑定布局" : undefined} onClick={() => void copyYaml()}><Copy />YAML</Button>
          <Button size="sm" variant="outline" disabled={!hasLayoutEntry} title={!hasLayoutEntry ? "先添加布局，并设置默认布局或给每台设备绑定布局" : undefined} onClick={() => downloadText(yaml, `${slug(project.meta.name)}-${project.devices[0]?.id ?? "device"}.yaml`, "text/yaml;charset=utf-8")}><Download />下载</Button>
          <Button size="sm" variant="outline" onClick={() => setProjectsOpen(true)}><FolderOpen />项目</Button>
          <Button size="sm" variant="outline" onClick={() => setAdvancedOpen(true)}><SlidersHorizontal />高级</Button>
          {board !== "layouts" ? (
            <Button size="icon" variant="ghost" className="hidden lg:inline-flex" aria-label={previewOpen ? "收起预览" : "打开预览"} title={previewOpen ? "收起预览" : "打开预览"} onClick={() => setPreviewOpen((value) => !value)}>
              {previewOpen ? <EyeOff /> : <Eye />}
            </Button>
          ) : null}
          {onClose ? <Button size="icon" variant="ghost" aria-label="关闭编辑器" onClick={onClose}><X /></Button> : null}
        </div>
      </header>

      {board !== "start" ? (
        <Stepper steps={statuses} current={board} onSelect={(id) => setBoard(id)} />
      ) : null}

      {board !== "start" && currentStatus ? (
        <div className="flex shrink-0 flex-wrap items-center gap-stack border-b border-border bg-muted/20 px-panel py-1 text-2xs text-muted-foreground">
          <Badge
            variant={currentStatus.state === "error" ? "danger" : currentStatus.state === "warning" ? "warning" : currentStatus.state === "done" ? "success" : "muted"}
          >
            {STATE_LABEL[currentStatus.state]}
          </Badge>
          <span className="text-foreground">{currentStatus.summary}</span>
          <span className="truncate">· {currentStatus.reasons[0]}</span>
          {currentStatus.optional ? <span className="text-3xs">· 可选，可跳过</span> : null}
          {board === "layouts" && activeLayoutName ? <span className="ml-auto">正在编辑：{activeLayoutName}</span> : null}
        </div>
      ) : null}

      <main className="flex min-h-0 flex-1 overflow-hidden">
        <div className="min-w-0 flex-1 overflow-hidden">
          {board === "start" ? (
            <LandingScreen projects={projects} onNew={createProject} onOpen={(id) => void openProject(id)} onImportYaml={(files) => void pickImportYaml(files)} />
          ) : null}
          {board === "theme" ? <ThemesPanel project={project} libs={libs} mutate={commit} setMessage={setMessage} /> : null}
          {board === "layouts" ? (
            <LayoutsPanel
              project={project}
              libs={libs}
              activeLayoutId={activeLayoutId}
              setActiveLayoutId={setActiveLayoutId}
              mutate={commit}
              editLayout={editLayout}
              setMessage={setMessage}
              onPreviewOrientation={setPreviewOrientation}
              selected={selectedKey}
              onSelectKey={selectKey}
              popup={popupKey ?? null}
              onPopupKey={openPopup}
              rightTab={rightTab}
              setRightTab={setRightTab}
              onMoveKey={moveKey}
            />
          ) : null}
          {board === "interface" ? <InterfacePanel project={project} libs={libs} mutate={commit} setMessage={setMessage} onSkip={() => setBoard("devices")} /> : null}
          {board === "devices" ? (
            <DevicesPanel
              project={project}
              libs={libs}
              mutate={commit}
              setMessage={setMessage}
              onFocusDevice={focusDevice}
              onOpenLayouts={(layoutId) => {
                setActiveLayoutId(layoutId);
                setSelectedKey(undefined);
                setPopupKey(undefined);
                setBoard("layouts");
              }}
            />
          ) : null}
          {board === "export" ? <ExportPanel project={project} snapshots={snapshots} setMessage={setMessage} /> : null}
          {board === "macros" ? (
            <div className="flex h-full min-h-0 flex-col">
              <div className="flex shrink-0 items-center gap-stack border-b border-border px-panel py-2">
                <Button size="sm" variant="ghost" className="h-control-sm text-2xs" onClick={() => setBoard("theme")}>← 返回主题</Button>
                <span className="text-2xs text-muted-foreground">宏是可选工具；未使用的宏不会进入导出。</span>
              </div>
              <div className="min-h-0 flex-1 overflow-hidden">
                <MacrosPanel project={project} libs={libs} mutate={commit} setMessage={setMessage} />
              </div>
            </div>
          ) : null}
        </div>

        {previewOpen && board !== "start" ? (
          <PreviewRail
            project={project}
            libs={libs}
            deviceId={previewDeviceId}
            onDeviceId={(id) => {
              setPreviewDeviceId(id);
              if (board !== "layouts") {
                const device = project.devices.find((item) => item.id === id);
                if (device) setPreviewOrientation(device.orientation);
              }
            }}
            orientation={previewOrientation}
            onOrientation={setPreviewOrientation}
            onVariant={(variant) => commit((draft) => { draft.variant = variant; })}
            onCollapse={() => setPreviewOpen(false)}
            layoutId={board === "layouts" ? activeLayoutId : undefined}
            interactive={board === "layouts"}
            wide={board === "layouts"}
            selected={board === "layouts" ? selectedKey : undefined}
            onSelect={selectKey}
            popup={board === "layouts" ? popupKey ?? null : null}
            onPopup={openPopup}
            onMoveKey={moveKey}
            onMessage={setMessage}
            onClosePopup={() => setPopupKey(undefined)}
          />
        ) : null}
      </main>

      <ProjectDrawer
        open={projectsOpen}
        onClose={() => setProjectsOpen(false)}
        project={project}
        projects={projects}
        snapshots={snapshots}
        onSave={() => void save()}
        onNew={createProject}
        onOpen={(id) => void openProject(id)}
        onDelete={(id) => void removeProject(id)}
        onImportBundle={(file) => void importBundle(file)}
        onImportYaml={(files) => void pickImportYaml(files)}
        onExportBundle={exportBundle}
        onSnapshot={(label) => void takeSnapshot(label)}
        onRestoreSnapshot={(snapshot) => void restoreSnapshot(snapshot)}
        onDeleteSnapshot={(key) => void removeSnapshot(key)}
        onExportSnapshot={exportSnapshot}
        onExportSnapshotBundle={exportSnapshotBundle}
        onImportSnapshotBundle={(file) => void importSnapshotBundle(file)}
        onOpenMacros={() => { setProjectsOpen(false); setBoard("macros"); }}
        onOpenAdvanced={() => { setProjectsOpen(false); setAdvancedOpen(true); }}
      />

      <AdvancedDrawer
        open={advancedOpen}
        onClose={() => setAdvancedOpen(false)}
        project={project}
        libs={libs}
        mutate={commit}
        setMessage={setMessage}
      />

      {pendingImport ? (
        <ImportDialog
          source={pendingImport.source}
          fileName={pendingImport.fileName}
          resources={pendingImport.resources}
          onApply={applyImport}
          onCancel={() => setPendingImport(null)}
        />
      ) : null}
    </div>
  );
}
