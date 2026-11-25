import { useState } from "react";
import { ArrowDown, ArrowUp, Copy, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { macroToken } from "../compiler";
import { KEYCODES } from "../catalogs";
import type { MacroPreset, PresetLibraries, ProjectDoc } from "../types";
import { cloneMacro, newMacro } from "../utils";

type Props = {
  project: ProjectDoc;
  libs: PresetLibraries;
  mutate: (fn: (draft: ProjectDoc) => void) => void;
  setMessage: (message: string) => void;
};

export function MacrosPanel({ project, libs, mutate, setMessage }: Props) {
  const [selectedId, setSelectedId] = useState(libs.macros[0]?.id ?? "");
  const macro = libs.macros.find((item) => item.id === selectedId) ?? libs.macros[0];
  const included = macro ? project.macroIds.includes(macro.id) : false;

  const edit = (fn: (macro: MacroPreset) => void) => {
    if (!macro || macro.builtin) return;
    mutate((draft) => {
      const target = (draft.customMacros ?? []).find((item) => item.id === macro.id);
      if (target) fn(target);
    });
  };

  const toggleInclude = () => {
    if (!macro) return;
    mutate((draft) => {
      draft.macroIds = included ? draft.macroIds.filter((id) => id !== macro.id) : [...draft.macroIds, macro.id];
    });
  };

  const duplicate = () => {
    if (!macro) return;
    const clone = cloneMacro(macro, `${macro.name} 副本`);
    mutate((draft) => {
      draft.customMacros = [...(draft.customMacros ?? []), clone];
      draft.macroIds = [...new Set([...draft.macroIds, clone.id])];
    });
    setSelectedId(clone.id);
    setMessage(`已复制宏：${clone.name}`);
  };

  const create = () => {
    const created = newMacro(`新宏 ${(project.customMacros ?? []).length + 1}`);
    mutate((draft) => {
      draft.customMacros = [...(draft.customMacros ?? []), created];
      draft.macroIds = [...new Set([...draft.macroIds, created.id])];
    });
    setSelectedId(created.id);
    setMessage("已新建宏");
  };

  const remove = () => {
    if (!macro || macro.builtin) return;
    mutate((draft) => {
      draft.customMacros = (draft.customMacros ?? []).filter((item) => item.id !== macro.id);
      draft.macroIds = draft.macroIds.filter((id) => id !== macro.id);
      for (const layout of draft.customLayouts ?? []) {
        for (const row of layout.rows) for (const key of row.keys) {
          for (const behavior of ["click", "long_click", "double_click", "swipe_up", "swipe_down", "swipe_left", "swipe_right"] as const) {
            const action = (key as unknown as Record<string, { kind: string; id?: string } | undefined>)[behavior];
            if (action?.kind === "macro" && action.id === macro.id) (key as unknown as Record<string, unknown>)[behavior] = undefined;
          }
        }
      }
    });
    setSelectedId(libs.macros[0]?.id ?? "");
    setMessage("已删除宏");
  };

  return (
    <div className="grid h-full min-h-0 grid-cols-[260px_minmax(0,1fr)]">
      <aside className="flex min-h-0 flex-col border-r border-border">
        <div className="flex items-center gap-2 border-b border-border px-3 py-2">
          <span className="text-xs font-semibold">Macros</span>
          <Badge variant="muted">{libs.macros.length}</Badge>
          <Button size="sm" variant="outline" className="ml-auto h-7" onClick={create}><Plus />New</Button>
        </div>
        <div className="min-h-0 flex-1 space-y-1 overflow-auto p-2">
          {libs.macros.map((item) => {
            const used = project.macroIds.includes(item.id);
            return (
              <button
                key={item.id}
                type="button"
                className={`flex w-full items-center gap-1 rounded border px-2 py-1.5 text-left text-[11px] ${selectedId === item.id ? "border-primary bg-primary/10" : "border-transparent hover:bg-muted"}`}
                onClick={() => setSelectedId(item.id)}
              >
                <span className="min-w-0 flex-1 truncate" title={item.id}>{item.name}</span>
                {used ? <span className="size-1.5 rounded-full bg-emerald-400" title="included" /> : null}
                <Badge variant="muted">{item.builtin ? "builtin" : "custom"}</Badge>
              </button>
            );
          })}
        </div>
      </aside>

      <main className="min-h-0 overflow-auto p-5">
        {macro ? (
          <div className="mx-auto max-w-3xl space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold">{macro.name}</span>
              <Badge variant={macro.builtin ? "muted" : "success"}>{macro.builtin ? "builtin · read-only" : "custom"}</Badge>
              <code className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{macroToken(macro) || "∅"}</code>
              <div className="ml-auto flex items-center gap-1">
                <Button size="sm" variant={included ? "secondary" : "outline"} onClick={toggleInclude}>{included ? "Included" : "Include"}</Button>
                <Button size="sm" variant="outline" onClick={duplicate}><Copy />Duplicate</Button>
                <Button size="sm" variant="outline" className="text-red-300" disabled={macro.builtin} onClick={remove}><Trash2 />Delete</Button>
              </div>
            </div>

            <section className="rounded-xl border border-border bg-card p-4">
              <h3 className="mb-2 text-xs font-semibold">Macro meta</h3>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Name"><Input value={macro.name} disabled={macro.builtin} onChange={(event) => edit((draft) => { draft.name = event.target.value; })} /></Field>
                <Field label="ID"><Input value={macro.id} disabled title="ID 稳定，不在此处修改" /></Field>
              </div>
              <p className="mt-2 text-[10px] text-muted-foreground">宏编译为 preset_keys.text；text 后接 <code>{"{Left}"}</code> 表示移动光标。内置宏只读，复制后可改。</p>
            </section>

            <section className="rounded-xl border border-border bg-card p-4">
              <div className="mb-2 flex items-center gap-2">
                <h3 className="text-xs font-semibold">Steps</h3>
                <span className="text-[9px] text-muted-foreground">按顺序编译</span>
                <div className="ml-auto flex gap-1">
                  <Button size="sm" variant="outline" className="h-7" disabled={macro.builtin} onClick={() => edit((draft) => { draft.steps.push({ type: "text", value: "" }); })}><Plus />Text</Button>
                  <Button size="sm" variant="outline" className="h-7" disabled={macro.builtin} onClick={() => edit((draft) => { draft.steps.push({ type: "key", value: "Left" }); })}><Plus />Key</Button>
                </div>
              </div>
              <div className="space-y-1">
                {macro.steps.map((step, index, steps) => (
                  <div key={index} className="flex items-center gap-1 rounded border border-border bg-muted/20 px-2 py-1">
                    <span className="w-8 text-[9px] text-muted-foreground">#{index + 1}</span>
                    <Select className="h-7 w-20" value={step.type} disabled={macro.builtin} onChange={(event) => edit((draft) => { draft.steps[index] = { type: event.target.value as "text" | "key", value: "" }; })}>
                      <option value="text">text</option>
                      <option value="key">key</option>
                    </Select>
                    {step.type === "key" ? (
                      <Select className="h-7" value={step.value} disabled={macro.builtin} onChange={(event) => edit((draft) => { draft.steps[index] = { type: "key", value: event.target.value }; })}>
                        <option value="">Select keycode…</option>
                        {KEYCODES.map((group) => <optgroup key={group.id} label={group.label}>{group.items.map((item) => <option key={item} value={item}>{item}</option>)}</optgroup>)}
                      </Select>
                    ) : (
                      <Input className="h-7" value={step.value} disabled={macro.builtin} placeholder="要上屏的文本" onChange={(event) => edit((draft) => { draft.steps[index] = { type: "text", value: event.target.value }; })} />
                    )}
                    <Button size="sm" variant="ghost" className="h-7 px-1" disabled={macro.builtin || index === 0} onClick={() => edit((draft) => {
                      [draft.steps[index - 1], draft.steps[index]] = [draft.steps[index], draft.steps[index - 1]];
                    })}><ArrowUp /></Button>
                    <Button size="sm" variant="ghost" className="h-7 px-1" disabled={macro.builtin || index === steps.length - 1} onClick={() => edit((draft) => {
                      [draft.steps[index + 1], draft.steps[index]] = [draft.steps[index], draft.steps[index + 1]];
                    })}><ArrowDown /></Button>
                    <Button size="sm" variant="ghost" className="h-7 px-1 text-red-300" disabled={macro.builtin} onClick={() => edit((draft) => { draft.steps.splice(index, 1); })}>×</Button>
                  </div>
                ))}
                {macro.steps.length === 0 ? <p className="text-[10px] text-muted-foreground">没有步骤。</p> : null}
              </div>
            </section>

            <section className="rounded-xl border border-border bg-card p-4">
              <h3 className="mb-2 text-xs font-semibold">Compiled preset key</h3>
              <pre className="overflow-auto rounded bg-muted/30 p-2 text-[10px]">{`preset_keys:\n  macro_${macro.id.replace(/[^A-Za-z0-9_]/g, "_")}:\n    text: ${JSON.stringify(macroToken(macro))}`}</pre>
            </section>
          </div>
        ) : <p className="text-xs text-muted-foreground">没有宏。</p>}
      </main>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1"><Label>{label}</Label>{children}</div>;
}
