import { useMemo, useState } from "react";
import { Eraser } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CHARACTER_SETS, COMMANDS, KEYCODES, TOGGLES } from "../catalogs";
import type { ActionRef, LayoutPreset, PresetLibraries } from "../types";

export const BEHAVIORS = [
  ["click", "Click"],
  ["long_click", "Long"],
  ["double_click", "Double"],
  ["swipe_up", "Swipe ↑"],
  ["swipe_down", "Swipe ↓"],
  ["swipe_left", "Swipe ←"],
  ["swipe_right", "Swipe →"],
] as const;

type Props = {
  libs: PresetLibraries;
  /** Layouts reachable from a Page action. Defaults to the catalog when omitted. */
  pageTargets?: LayoutPreset[];
  targetBehavior: string;
  setTargetBehavior: (value: string) => void;
  onAssign: (action: ActionRef | undefined) => void;
};

export function Selector({ libs, pageTargets, targetBehavior, setTargetBehavior, onAssign }: Props) {
  const [tab, setTab] = useState("characters");
  const [setId, setSetId] = useState(CHARACTER_SETS[0].id);
  const [query, setQuery] = useState("");
  const set = CHARACTER_SETS.find((item) => item.id === setId) ?? CHARACTER_SETS[0];

  const characters = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return set.items;
    return set.items.filter((item) => item.toLowerCase().includes(needle));
  }, [query, set]);

  const keycodes = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return KEYCODES.map((group) => ({
      ...group,
      items: group.items.filter((item) => !needle || item.toLowerCase().includes(needle)),
    })).filter((group) => group.items.length > 0);
  }, [query]);

  return (
    <div className="rounded-xl border border-border bg-card p-gutter">
      <div className="mb-2 flex items-center gap-stack">
        <span className="text-xs font-medium">Insert action</span>
        <Badge variant="success">{targetBehavior}</Badge>
        <span className="ml-auto text-3xs text-muted-foreground">先选键，再点目标行为与内容</span>
      </div>

      <div className="mb-2 flex flex-wrap gap-1">
        {BEHAVIORS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            aria-pressed={targetBehavior === id}
            className={`rounded-control border px-1.5 py-0.5 text-3xs transition-colors ${targetBehavior === id ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground hover:bg-surface-hover active:bg-surface-active hover:text-foreground"}`}
            onClick={() => setTargetBehavior(id)}
          >
            {label}
          </button>
        ))}
        <Button size="sm" variant="ghost" className="ml-auto h-control-xs px-1 text-3xs" onClick={() => onAssign(undefined)}>
          <Eraser className="size-3" /> Clear
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="characters">Characters</TabsTrigger>
          <TabsTrigger value="keycodes">Keycodes</TabsTrigger>
          <TabsTrigger value="macros">Macros</TabsTrigger>
          <TabsTrigger value="pages">布局</TabsTrigger>
          <TabsTrigger value="options">Options</TabsTrigger>
        </TabsList>

        <div className="mt-2">
          <Input className="mb-2 h-control-sm" placeholder="Search…" value={query} onChange={(event) => setQuery(event.target.value)} />

          <TabsContent value="characters" className="mt-0">
            <div className="mb-2 flex flex-wrap gap-1">
              {CHARACTER_SETS.map((item) => (
                <button key={item.id} type="button" title={item.description} aria-pressed={setId === item.id} className={`rounded-control border px-1.5 py-0.5 text-3xs transition-colors ${setId === item.id ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground hover:bg-surface-hover active:bg-surface-active hover:text-foreground"}`} onClick={() => setSetId(item.id)}>
                  {item.label}
                </button>
              ))}
            </div>
            <Grid items={characters} onPick={(value) => {
              if (setId === "pairs") {
                const pair = libs.macros.find((item) => item.name === value);
                if (pair) return onAssign({ kind: "macro", id: pair.id });
                return onAssign({ kind: "text", value });
              }
              onAssign(value.length <= 2 ? { kind: "char", value } : { kind: "text", value });
            }} />
            {characters.length === 0 ? <p className="py-3 text-center text-2xs text-muted-foreground">没有匹配的字符</p> : null}
          </TabsContent>

          <TabsContent value="keycodes" className="mt-0 max-h-52 space-y-2 overflow-auto">
            {keycodes.map((group) => (
              <div key={group.id}>
                <div className="mb-1 text-3xs uppercase tracking-wider text-muted-foreground">{group.label}</div>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(64px,1fr))] gap-1">
                  {group.items.map((item) => <button key={item} type="button" className="rounded border border-border bg-muted/20 px-1 py-1 text-3xs hover:border-primary" onClick={() => onAssign({ kind: "key", value: item })}>{item}</button>)}
                </div>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="macros" className="mt-0 max-h-52 overflow-auto">
            <div className="grid grid-cols-[repeat(auto-fill,minmax(74px,1fr))] gap-1">
              {libs.macros.map((item) => (
                <button key={item.id} type="button" className="min-h-control whitespace-normal break-words rounded border border-border bg-muted/20 px-1 py-1 text-2xs" onClick={() => onAssign({ kind: "macro", id: item.id })}>
                  {item.name}
                  <span className="block text-4xs text-muted-foreground">{item.builtin ? "builtin" : "custom"}</span>
                </button>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="pages" className="mt-0 max-h-52 overflow-auto">
            <div className="grid grid-cols-[repeat(auto-fill,minmax(74px,1fr))] gap-1">
              {pageTargets ? (
                <>
                  <button type="button" className="min-h-control whitespace-normal break-words rounded border border-primary/40 bg-primary/5 px-1 py-1 text-2xs" onClick={() => onAssign({ kind: "page", id: "main" })}>
                    默认布局
                    <span className="block text-4xs text-muted-foreground">按设备解析</span>
                  </button>
                  {pageTargets.map((item) => (
                    <button key={item.id} type="button" className="min-h-control whitespace-normal break-words rounded border border-border bg-muted/20 px-1 py-1 text-2xs" onClick={() => onAssign({ kind: "page", id: item.id })}>
                      {item.name}
                      <span className="block text-4xs text-muted-foreground">{item.role ?? "letters"}</span>
                    </button>
                  ))}
                </>
              ) : (
                libs.layouts.map((item) => (
                  <button key={item.id} type="button" className="min-h-control whitespace-normal break-words rounded border border-border bg-muted/20 px-1 py-1 text-2xs" onClick={() => onAssign({ kind: "page", id: item.id })}>
                    {item.name}
                    <span className="block text-4xs text-muted-foreground">{item.role ?? "letters"}</span>
                  </button>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="options" className="mt-0 space-y-2">
            <div>
              <div className="mb-1 text-3xs uppercase tracking-wider text-muted-foreground">Toggles</div>
              <div className="grid grid-cols-2 gap-1">
                {TOGGLES.map((item) => <button key={item.value} type="button" className="rounded border border-border bg-muted/20 px-1 py-1 text-2xs" onClick={() => onAssign({ kind: "toggle", value: item.value })}>{item.label}</button>)}
              </div>
            </div>
            <div>
              <div className="mb-1 text-3xs uppercase tracking-wider text-muted-foreground">Commands</div>
              <div className="grid grid-cols-2 gap-1">
                {COMMANDS.map((item) => <button key={item.value} type="button" className="rounded border border-border bg-muted/20 px-1 py-1 text-2xs" onClick={() => onAssign({ kind: "command", value: item.value, option: item.option })}>{item.label}</button>)}
              </div>
            </div>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

function Grid({ items, onPick }: { items: string[]; onPick: (value: string) => void }) {
  return (
    <div className="grid max-h-40 grid-cols-[repeat(auto-fill,minmax(34px,1fr))] gap-1 overflow-auto">
      {items.map((item) => (
        <button key={item} type="button" className="min-h-control whitespace-normal break-words rounded border border-border bg-muted/20 px-1 py-1 text-center text-2xs hover:border-primary" onClick={() => onPick(item)}>
          {item}
        </button>
      ))}
    </div>
  );
}
