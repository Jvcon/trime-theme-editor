import { Plus, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { PresetLibraries, ProjectBundle } from "../types";
import { embedLayout, pages, pruneBundleLayouts } from "../utils";

type Props = {
  open: boolean;
  onClose: () => void;
  project: ProjectBundle;
  libs: PresetLibraries;
  mutate: (fn: (draft: ProjectBundle) => void) => void;
  setMessage: (message: string) => void;
};

function sanitizeId(value: string) {
  return value.replace(/[^A-Za-z0-9_-]/g, "-").replace(/^-+|-+$/g, "") || "device";
}

function bindingAlias(binding: ProjectBundle["schemaBindings"][number]): string {
  return binding.alias?.trim() || `schema_${sanitizeId(binding.schemaId || binding.layoutId)}`;
}

export function AdvancedDrawer({ open, onClose, project, libs, mutate, setMessage }: Props) {
  if (!open) return null;
  const allLayouts = libs.layouts;
  const allPages = pages(project, libs);

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
    setMessage("已删除 schema 绑定");
  };

  const stats = [
    ["色卡", `浅色 ${project.theme.light.name} / 深色 ${project.theme.dark.name}`, `预览 ${project.variant}`],
    ["主布局", allPages[0]?.name ?? "—", project.mainLayoutId],
    ["页面", allPages.map((item) => item.name).join(" / "), `${allPages.length} keyboards`],
    ["嵌入布局", String(project.layouts.length), "bundle"],
    ["宏", String(project.macros.length), `${libs.macros.length} available`],
    ["Key styles", String(Object.keys(project.keyStyles).length), "token references"],
    ["设备", String(project.devices.length), project.devices.map((device) => device.kind).join(" / ")],
    ["Schema 绑定", String(project.schemaBindings.length), "schema_id → layout"],
    ["Passthrough", String(Object.keys(project.passthrough ?? {}).length), "unmodelled sections"],
    ["Fallback colors", String(Object.keys(project.fallbackColors ?? {}).length), "imported fallback_colors"],
  ];

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <aside className="relative z-10 flex h-full w-full max-w-xl flex-col border-l border-border bg-background">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <span className="text-sm font-semibold">高级</span>
          <Badge variant="muted">编译器术语只在这里出现</Badge>
          <Button size="icon" variant="ghost" className="ml-auto" onClick={onClose}><X /></Button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-auto p-4">
          <section className="rounded-xl border border-border bg-card p-3">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <h3 className="text-xs font-semibold">输入法绑定</h3>
              <Badge variant="muted">{project.schemaBindings.length}</Badge>
              <span className="text-[9px] text-muted-foreground">schema_id → keyset，输出 alias keyboard</span>
              <Button size="sm" variant="outline" className="ml-auto h-8" onClick={addBinding}><Plus />添加</Button>
            </div>
            {project.schemaBindings.length === 0 ? (
              <p className="py-2 text-[10px] text-muted-foreground">还没有绑定。添加后会生成 <code>schema_luna_pinyin: import_preset: qwerty26</code> 这样的别名。</p>
            ) : (
              <div className="space-y-2">
                {project.schemaBindings.map((binding, index) => (
                  <div key={index} className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/10 p-2">
                    <Input className="h-7 w-40" value={binding.schemaId} placeholder="schema_id（如 luna_pinyin）" onChange={(event) => updateBinding(index, { schemaId: event.target.value })} />
                    <Select className="h-7 w-36" value={binding.layoutId} onChange={(event) => setBindingLayout(index, event.target.value)}>
                      {!allLayouts.some((item) => item.id === binding.layoutId) ? <option value={binding.layoutId}>{binding.layoutId} · missing</option> : null}
                      {allLayouts.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.pageRole}</option>)}
                    </Select>
                    <Input className="h-7 w-36" value={binding.alias ?? ""} placeholder="alias（可留空）" onChange={(event) => updateBinding(index, { alias: event.target.value })} />
                    <code className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{bindingAlias(binding)}</code>
                    <Button size="sm" variant="ghost" className="ml-auto h-7 px-1 text-red-300" onClick={() => removeBinding(index)}><Trash2 /></Button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-xl border border-border bg-card p-3">
            <h3 className="mb-2 text-xs font-semibold">概要</h3>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {stats.map(([label, value, detail]) => (
                <div key={label} className="rounded-lg border border-border bg-muted/20 px-3 py-2">
                  <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
                  <div className="truncate text-xs font-medium" title={value}>{value}</div>
                  <div className="truncate text-[9px] text-muted-foreground" title={detail}>{detail}</div>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[10px] text-muted-foreground">编译只读取这份 bundle，并输出每个设备一份完整 trime.yaml。</p>
          </section>
        </div>
      </aside>
    </div>
  );
}
