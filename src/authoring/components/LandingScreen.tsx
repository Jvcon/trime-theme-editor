import { FileUp, FolderOpen, Plus, Sparkles } from "lucide-react";
import type { ProjectBundle } from "../types";

export function LandingScreen({ projects, onNew, onOpen, onImportYaml }: {
  projects: ProjectBundle[];
  onNew: () => void;
  onOpen: (id: string) => void;
  onImportYaml: (files: File[]) => void;
}) {
  return (
    <div className="h-full overflow-auto p-6">
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="mb-1 flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="size-4 text-primary" /> 开始一个 Trime 主题
          </div>
          <p className="mb-4 text-[11px] text-muted-foreground">
            不需要从空白开始：选一个内置模板，或导入现有的 <code>trime.yaml</code> 继续编辑。
            所有草稿只保存在本机浏览器。
          </p>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <button type="button" onClick={onNew} className="rounded-xl border border-border bg-muted/10 p-4 text-left hover:border-primary/60 hover:bg-primary/5">
              <Plus className="mb-2 size-5 text-primary" />
              <div className="text-xs font-semibold">从模板开始</div>
              <p className="mt-1 text-[10px] text-muted-foreground">qwerty26 主布局 + Alucard / Dracula 双方案，默认已可用。</p>
            </button>

            <label className="cursor-pointer rounded-xl border border-border bg-muted/10 p-4 text-left hover:border-primary/60 hover:bg-primary/5">
              <FileUp className="mb-2 size-5 text-primary" />
              <div className="text-xs font-semibold">导入现有 trime.yaml</div>
              <p className="mt-1 text-[10px] text-muted-foreground">支持多选主文件与 <code>__include</code> 引用文件。</p>
              <input
                type="file"
                accept=".yaml,.yml,text/yaml"
                multiple
                hidden
                onChange={(event) => {
                  const files = Array.from(event.target.files ?? []);
                  event.target.value = "";
                  if (files.length > 0) onImportYaml(files);
                }}
              />
            </label>

            <div className="rounded-xl border border-border bg-muted/10 p-4">
              <FolderOpen className="mb-2 size-5 text-primary" />
              <div className="text-xs font-semibold">打开最近项目</div>
              <div className="mt-1 space-y-1">
                {projects.slice(0, 3).map((project) => (
                  <button
                    key={project.id}
                    type="button"
                    className="block w-full truncate rounded border border-transparent px-1 py-0.5 text-left text-[10px] text-muted-foreground hover:border-border hover:bg-muted/40 hover:text-foreground"
                    onClick={() => onOpen(project.id)}
                  >
                    {project.meta.name}
                  </button>
                ))}
                {projects.length === 0 ? <p className="text-[10px] text-muted-foreground">还没有保存的项目。</p> : null}
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
          <span>流程：</span>
          <span className="rounded border border-border px-1.5 py-0.5">① 主题</span>
          <span>→</span>
          <span className="rounded border border-border px-1.5 py-0.5">② 布局</span>
          <span>→</span>
          <span className="rounded border border-border px-1.5 py-0.5">③ 界面（可选）</span>
          <span>→</span>
          <span className="rounded border border-border px-1.5 py-0.5">④ 设备</span>
          <span>→</span>
          <span className="rounded border border-border px-1.5 py-0.5">⑤ 检查与导出</span>
        </div>
      </div>
    </div>
  );
}
