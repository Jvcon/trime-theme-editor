import { useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DEFAULT_TOOLBAR_ACTIONS, DEFAULT_TOOLBAR_ICONS } from "../presets";
import { LiquidPreview, PreeditPreview, ToolbarPreview, WindowPreview } from "../components/InterfacePreviews";
import type { ChromeConfig, LiquidTab, PresetLibraries, ProjectDoc, ToolbarButton } from "../types";
import { defaultChrome, normalizeChrome } from "../utils";

type Props = {
  project: ProjectDoc;
  libs: PresetLibraries;
  mutate: (fn: (draft: ProjectDoc) => void) => void;
  setMessage: (message: string) => void;
};

export function InterfacePanel({ project, libs, mutate, setMessage }: Props) {
  const chrome = project.chrome ?? defaultChrome();
  const [tab, setTab] = useState("toolbar");
  const [selectedLiquid, setSelectedLiquid] = useState(chrome.liquid.tabs[0]?.id ?? "");
  const [newFixedKey, setNewFixedKey] = useState("");

  const update = (fn: (draft: ChromeConfig) => void) => {
    mutate((draft) => {
      draft.chrome = normalizeChrome(draft.chrome);
      fn(draft.chrome);
    });
  };

  const updateToolbar = (fn: (draft: ChromeConfig["toolbar"]) => void) => update((draft) => fn(draft.toolbar));
  const updateLiquid = (fn: (draft: ChromeConfig["liquid"]) => void) => update((draft) => fn(draft.liquid));

  const selected = chrome.liquid.tabs.find((item) => item.id === selectedLiquid) ?? chrome.liquid.tabs[0];

  const updateTab = (fn: (tab: LiquidTab) => void) => {
    if (!selected) return;
    updateLiquid((draft) => {
      const target = draft.tabs.find((item) => item.id === selected.id);
      if (target) fn(target);
    });
  };

  const moveTab = (index: number, direction: -1 | 1) => {
    const next = index + direction;
    if (next < 0 || next >= chrome.liquid.tabs.length) return;
    updateLiquid((draft) => {
      [draft.tabs[index], draft.tabs[next]] = [draft.tabs[next], draft.tabs[index]];
    });
  };

  const addTab = () => {
    let index = chrome.liquid.tabs.length + 1;
    let id = `tab${index}`;
    while (chrome.liquid.tabs.some((item) => item.id === id)) {
      index += 1;
      id = `tab${index}`;
    }
    updateLiquid((draft) => {
      draft.tabs.push({ id, name: `新标签 ${index}`, type: "SINGLE", keys: [] });
    });
    setSelectedLiquid(id);
    setMessage(`已新增 liquid tab：${id}`);
  };

  const deleteTab = () => {
    if (!selected) return;
    updateLiquid((draft) => {
      draft.tabs = draft.tabs.filter((item) => item.id !== selected.id);
    });
    setSelectedLiquid(chrome.liquid.tabs.find((item) => item.id !== selected.id)?.id ?? "");
    setMessage("已删除 liquid tab");
  };

  const addToolbarButtonForTab = () => {
    if (!selected) return;
    updateToolbar((draft) => {
      draft.buttons.push({ action: `liquid_keyboard_${selected.id}`, icon: "ic@emoticon", size: [44, 44] });
    });
    setMessage(`已为 ${selected.name} 添加 toolbar 按钮`);
  };

  return (
    <div className="h-full overflow-auto p-5">
      <div className="mb-4 flex items-center gap-2">
        <span className="text-sm font-semibold">Interface</span>
        <Badge variant="muted">toolbar / liquid / window / preedit</Badge>
        <span className="ml-auto text-[10px] text-muted-foreground">这些配置会进入同一份 trime.yaml</span>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="toolbar">Toolbar</TabsTrigger>
          <TabsTrigger value="liquid">Liquid</TabsTrigger>
          <TabsTrigger value="window">Window</TabsTrigger>
          <TabsTrigger value="preedit">Preedit</TabsTrigger>
        </TabsList>

        <TabsContent value="toolbar" className="mt-4 space-y-4">
          <section className="rounded-xl border border-border bg-card p-4">
            <h3 className="mb-2 text-xs font-semibold">Global</h3>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              <Field label="Button spacing"><NumberInput value={chrome.toolbar.buttonSpacing} onChange={(value) => updateToolbar((draft) => { draft.buttonSpacing = value; })} /></Field>
              <Field label="Back style"><Input value={chrome.toolbar.backStyle} onChange={(event) => updateToolbar((draft) => { draft.backStyle = event.target.value; })} /></Field>
            </div>
          </section>

          <ToolbarPreview project={project} libs={libs} />

          <section className="rounded-xl border border-border bg-card p-4">
            <h3 className="mb-2 text-xs font-semibold">Primary button</h3>
            <ButtonEditor button={chrome.toolbar.primaryButton} onChange={(next) => updateToolbar((draft) => { draft.primaryButton = next; })} />
          </section>

          <section className="rounded-xl border border-border bg-card p-4">
            <div className="mb-2 flex items-center gap-2">
              <h3 className="text-xs font-semibold">Buttons</h3>
              <Badge variant="muted">{chrome.toolbar.buttons.length}</Badge>
              <Button size="sm" variant="outline" className="ml-auto h-7" onClick={() => updateToolbar((draft) => {
                draft.buttons.push({ action: "Mode_switch", icon: "ic@ascii", size: [44, 44] });
              })}><Plus />Add button</Button>
            </div>
            <div className="space-y-2">
              {chrome.toolbar.buttons.map((button, index) => (
                <div key={index} className="rounded border border-border bg-muted/10 p-2">
                  <div className="mb-1 flex items-center gap-1">
                    <Badge variant="muted">#{index + 1}</Badge>
                    <code className="text-[10px] text-muted-foreground">{button.action}</code>
                    <div className="ml-auto flex gap-1">
                      <Button size="sm" variant="ghost" className="h-6 px-1" disabled={index === 0} onClick={() => updateToolbar((draft) => {
                        [draft.buttons[index - 1], draft.buttons[index]] = [draft.buttons[index], draft.buttons[index - 1]];
                      })}><ArrowUp /></Button>
                      <Button size="sm" variant="ghost" className="h-6 px-1" disabled={index === chrome.toolbar.buttons.length - 1} onClick={() => updateToolbar((draft) => {
                        [draft.buttons[index + 1], draft.buttons[index]] = [draft.buttons[index], draft.buttons[index + 1]];
                      })}><ArrowDown /></Button>
                      <Button size="sm" variant="ghost" className="h-6 px-1 text-red-300" onClick={() => updateToolbar((draft) => { draft.buttons.splice(index, 1); })}><Trash2 /></Button>
                    </div>
                  </div>
                  <ButtonEditor button={button} compact onChange={(next) => updateToolbar((draft) => { draft.buttons[index] = next; })} />
                </div>
              ))}
              {chrome.toolbar.buttons.length === 0 ? <p className="text-[10px] text-muted-foreground">没有 toolbar 按钮。</p> : null}
            </div>
            <datalist id="toolbar-actions">{DEFAULT_TOOLBAR_ACTIONS.map((item) => <option key={item} value={item} />)}</datalist>
            <datalist id="toolbar-icons">{DEFAULT_TOOLBAR_ICONS.map((item) => <option key={item} value={item} />)}</datalist>
          </section>
        </TabsContent>

        <TabsContent value="liquid" className="mt-4 space-y-4">
          <section className="rounded-xl border border-border bg-card p-4">
            <h3 className="mb-2 text-xs font-semibold">Global</h3>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
              <Field label="Single width"><NumberInput value={chrome.liquid.singleWidth} onChange={(value) => updateLiquid((draft) => { draft.singleWidth = value; })} /></Field>
              <Field label="Margin X"><NumberInput value={chrome.liquid.marginX} onChange={(value) => updateLiquid((draft) => { draft.marginX = value; })} /></Field>
              <Field label="Key height"><NumberInput value={chrome.liquid.keyHeight ?? 40} onChange={(value) => updateLiquid((draft) => { draft.keyHeight = value; })} /></Field>
              <Field label="Rows"><NumberInput value={chrome.liquid.row ?? 6} onChange={(value) => updateLiquid((draft) => { draft.row = value; })} /></Field>
              <Field label="Vertical gap"><NumberInput value={chrome.liquid.verticalGap ?? 1} onChange={(value) => updateLiquid((draft) => { draft.verticalGap = value; })} /></Field>
            </div>
          </section>

          <LiquidPreview project={project} libs={libs} tabId={selectedLiquid} onTab={setSelectedLiquid} />

          <section className="rounded-xl border border-border bg-card p-4">
            <h3 className="mb-2 text-xs font-semibold">Fixed key bar</h3>
            <div className="mb-2 flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground">position</span>
              <Select className="h-7 w-28" value={chrome.liquid.fixedBar.position} onChange={(event) => updateLiquid((draft) => { draft.fixedBar.position = event.target.value as ChromeConfig["liquid"]["fixedBar"]["position"]; })}>
                <option value="left">left</option>
                <option value="right">right</option>
                <option value="top">top</option>
                <option value="bottom">bottom</option>
              </Select>
            </div>
            <div className="space-y-1">
              {chrome.liquid.fixedBar.keys.map((key, index, keys) => (
                <div key={`${key}-${index}`} className="flex items-center gap-1">
                  <Input className="h-7" value={key} onChange={(event) => updateLiquid((draft) => { draft.fixedBar.keys[index] = event.target.value; })} />
                  <Button size="sm" variant="ghost" className="h-7 px-1" disabled={index === 0} onClick={() => updateLiquid((draft) => {
                    [draft.fixedBar.keys[index - 1], draft.fixedBar.keys[index]] = [draft.fixedBar.keys[index], draft.fixedBar.keys[index - 1]];
                  })}><ArrowUp /></Button>
                  <Button size="sm" variant="ghost" className="h-7 px-1" disabled={index === keys.length - 1} onClick={() => updateLiquid((draft) => {
                    [draft.fixedBar.keys[index + 1], draft.fixedBar.keys[index]] = [draft.fixedBar.keys[index], draft.fixedBar.keys[index + 1]];
                  })}><ArrowDown /></Button>
                  <Button size="sm" variant="ghost" className="h-7 px-1 text-red-300" onClick={() => updateLiquid((draft) => { draft.fixedBar.keys.splice(index, 1); })}>×</Button>
                </div>
              ))}
            </div>
            <div className="mt-2 flex gap-1">
              <Input className="h-7" value={newFixedKey} placeholder="keycode / preset key" onChange={(event) => setNewFixedKey(event.target.value)} />
              <Button size="sm" variant="outline" className="h-7" disabled={!newFixedKey} onClick={() => {
                updateLiquid((draft) => { draft.fixedBar.keys.push(newFixedKey); });
                setNewFixedKey("");
              }}>Add key</Button>
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card p-4">
            <div className="mb-2 flex items-center gap-2">
              <h3 className="text-xs font-semibold">Tabs</h3>
              <Badge variant="muted">{chrome.liquid.tabs.length}</Badge>
              <Button size="sm" variant="outline" className="ml-auto h-7" onClick={addTab}><Plus />Add tab</Button>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-[220px_minmax(0,1fr)]">
              <div className="space-y-1">
                {chrome.liquid.tabs.map((item, index) => (
                  <div key={item.id} className={`flex items-center gap-1 rounded border px-1.5 py-1 text-[10px] ${selected?.id === item.id ? "border-primary bg-primary/10" : "border-border"}`}>
                    <button type="button" className="min-w-0 flex-1 truncate text-left" title={`${item.id} · ${item.type}`} onClick={() => setSelectedLiquid(item.id)}>{item.name}</button>
                    <Badge variant="muted">{item.type}</Badge>
                    <button type="button" className="px-0.5" onClick={() => moveTab(index, -1)} disabled={index === 0}><ArrowUp className="size-3" /></button>
                    <button type="button" className="px-0.5" onClick={() => moveTab(index, 1)} disabled={index === chrome.liquid.tabs.length - 1}><ArrowDown className="size-3" /></button>
                  </div>
                ))}
              </div>
              <div className="min-w-0 rounded border border-border bg-muted/10 p-2">
                {selected ? (
                  <>
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <Input className="h-7 w-32" value={selected.name} onChange={(event) => updateTab((tab) => { tab.name = event.target.value; })} />
                      <Select className="h-7 w-28" value={selected.type} onChange={(event) => updateTab((tab) => { tab.type = event.target.value as LiquidTab["type"]; })}>
                        <option value="SINGLE">SINGLE</option>
                        <option value="HISTORY">HISTORY</option>
                        <option value="TABS">TABS</option>
                        <option value="SYMBOL">SYMBOL</option>
                      </Select>
                      <span className="text-[9px] text-muted-foreground">id: {selected.id}</span>
                      <div className="ml-auto flex gap-1">
                        <Button size="sm" variant="outline" className="h-7" onClick={addToolbarButtonForTab}>+ Toolbar</Button>
                        <Button size="sm" variant="outline" className="h-7 text-red-300" onClick={deleteTab}><Trash2 />Delete</Button>
                      </div>
                    </div>
                    {selected.type === "SINGLE" ? (
                      <SingleKeysEditor
                        key={selected.id}
                        values={selected.keys ?? []}
                        onCommit={(keys) => updateTab((tab) => { tab.keys = keys; })}
                      />
                    ) : null}
                    {selected.type === "SYMBOL" ? (
                      <SymbolKeysEditor
                        key={selected.id}
                        values={selected.symbols ?? []}
                        onCommit={(symbols) => updateTab((tab) => { tab.symbols = symbols; })}
                      />
                    ) : null}
                    {selected.type === "HISTORY" || selected.type === "TABS" ? (
                      <p className="text-[10px] text-muted-foreground">该类型由 Trime 运行时填充，不需要 keys。</p>
                    ) : null}
                  </>
                ) : <p className="text-[10px] text-muted-foreground">没有 liquid tab。</p>}
              </div>
            </div>
          </section>
        </TabsContent>

        <TabsContent value="window" className="mt-4 space-y-4">
          <WindowPreview project={project} libs={libs} />
          <section className="max-w-3xl rounded-xl border border-border bg-card p-4">
            <h3 className="mb-2 text-xs font-semibold">Window</h3>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
              <Field label="Vertical inset"><NumberInput value={chrome.window.verticalInset} onChange={(value) => update((draft) => { draft.window.verticalInset = value; })} /></Field>
              <Field label="Horizontal inset"><NumberInput value={chrome.window.horizontalInset} onChange={(value) => update((draft) => { draft.window.horizontalInset = value; })} /></Field>
              <Field label="Item V padding"><NumberInput value={chrome.window.itemVerticalPadding} onChange={(value) => update((draft) => { draft.window.itemVerticalPadding = value; })} /></Field>
              <Field label="Item H padding"><NumberInput value={chrome.window.itemHorizontalPadding} onChange={(value) => update((draft) => { draft.window.itemHorizontalPadding = value; })} /></Field>
              <Field label="Min width"><NumberInput value={chrome.window.minWidth} onChange={(value) => update((draft) => { draft.window.minWidth = value; })} /></Field>
              <Field label="Corner radius"><NumberInput value={chrome.window.cornerRadius} onChange={(value) => update((draft) => { draft.window.cornerRadius = value; })} /></Field>
              <Field label="Border"><NumberInput value={chrome.window.border} onChange={(value) => update((draft) => { draft.window.border = value; })} /></Field>
              <Field label="Shadow"><NumberInput value={chrome.window.shadow} onChange={(value) => update((draft) => { draft.window.shadow = value; })} /></Field>
              <Field label="Alpha"><NumberInput step={0.1} value={chrome.window.alpha} onChange={(value) => update((draft) => { draft.window.alpha = value; })} /></Field>
              <Field label="Label font size"><NumberInput value={chrome.window.labelFontSize} onChange={(value) => update((draft) => { draft.window.labelFontSize = value; })} /></Field>
              <Field label="Text font size"><NumberInput value={chrome.window.textFontSize} onChange={(value) => update((draft) => { draft.window.textFontSize = value; })} /></Field>
              <Field label="Comment font size"><NumberInput value={chrome.window.commentFontSize} onChange={(value) => update((draft) => { draft.window.commentFontSize = value; })} /></Field>
            </div>
          </section>
        </TabsContent>

        <TabsContent value="preedit" className="mt-4 space-y-4">
          <PreeditPreview project={project} libs={libs} />
          <section className="max-w-2xl rounded-xl border border-border bg-card p-4">
            <h3 className="mb-2 text-xs font-semibold">Preedit</h3>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
              <Field label="Horizontal padding"><NumberInput value={chrome.preedit.horizontalPadding} onChange={(value) => update((draft) => { draft.preedit.horizontalPadding = value; })} /></Field>
              <Field label="Top start radius"><NumberInput value={chrome.preedit.topStartRadius} onChange={(value) => update((draft) => { draft.preedit.topStartRadius = value; })} /></Field>
              <Field label="Top end radius"><NumberInput value={chrome.preedit.topEndRadius} onChange={(value) => update((draft) => { draft.preedit.topEndRadius = value; })} /></Field>
              <Field label="Alpha"><NumberInput step={0.1} value={chrome.preedit.alpha} onChange={(value) => update((draft) => { draft.preedit.alpha = value; })} /></Field>
              <Field label="Font size"><NumberInput value={chrome.preedit.fontSize} onChange={(value) => update((draft) => { draft.preedit.fontSize = value; })} /></Field>
            </div>
          </section>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ButtonEditor({ button, onChange, compact = false }: { button: ToolbarButton; onChange: (button: ToolbarButton) => void; compact?: boolean }) {
  const patch = (next: Partial<ToolbarButton>) => onChange({ ...button, ...next });
  return (
    <div className="space-y-1">
      <div className={`grid gap-1 ${compact ? "md:grid-cols-4" : "md:grid-cols-3"}`}>
        <Field label="Action">
          <Input list="toolbar-actions" className="h-7" value={button.action} onChange={(event) => patch({ action: event.target.value })} />
        </Field>
        <Field label="Icon">
          <Input list="toolbar-icons" className="h-7" value={button.icon ?? button.foreground?.style ?? ""} onChange={(event) => patch({ icon: event.target.value })} />
        </Field>
        <Field label="Long press">
          <Input className="h-7" value={button.longPressAction ?? ""} onChange={(event) => patch({ longPressAction: event.target.value })} />
        </Field>
        {!compact ? <Field label="Label"><Input className="h-7" value={button.label ?? ""} onChange={(event) => patch({ label: event.target.value })} /></Field> : null}
      </div>
      <details>
        <summary className="cursor-pointer text-[9px] text-muted-foreground">size / background / foreground</summary>
        <div className="mt-1 grid grid-cols-2 gap-1 md:grid-cols-4">
          <Field label="Width"><NumberInput value={button.size?.[0] ?? 44} onChange={(value) => patch({ size: [value, button.size?.[1] ?? 44] })} /></Field>
          <Field label="Height"><NumberInput value={button.size?.[1] ?? 44} onChange={(value) => patch({ size: [button.size?.[0] ?? 44, value] })} /></Field>
          <Field label="BG normal"><Input className="h-7" value={button.background?.normal ?? ""} onChange={(event) => patch({ background: { ...(button.background ?? {}), normal: event.target.value } })} /></Field>
          <Field label="BG highlight"><Input className="h-7" value={button.background?.highlight ?? ""} onChange={(event) => patch({ background: { ...(button.background ?? {}), highlight: event.target.value } })} /></Field>
          <Field label="BG type"><Input className="h-7" value={button.background?.type ?? ""} onChange={(event) => patch({ background: { ...(button.background ?? {}), type: event.target.value } })} /></Field>
          <Field label="FG normal"><Input className="h-7" value={button.foreground?.normal ?? ""} onChange={(event) => patch({ foreground: { ...(button.foreground ?? {}), normal: event.target.value } })} /></Field>
          <Field label="FG padding"><NumberInput value={button.foreground?.padding ?? 0} onChange={(value) => patch({ foreground: { ...(button.foreground ?? {}), padding: value } })} /></Field>
        </div>
      </details>
    </div>
  );
}


function SingleKeysEditor({ values, onCommit }: { values: string[]; onCommit: (keys: string[]) => void }) {
  const [text, setText] = useState(values.join("\n"));
  const commit = (nextText: string): string[] => {
    const keys = nextText.split("\n").map((item) => item.trim()).filter(Boolean);
    onCommit(keys);
    return keys;
  };
  return (
    <div className="space-y-1">
      <Label>Keys · 每行一个（离开输入框时保存）</Label>
      <textarea
        className="h-56 w-full rounded border border-border bg-background p-2 font-mono text-[11px]"
        value={text}
        onChange={(event) => setText(event.target.value)}
        onBlur={() => { setText(commit(text).join("\n")); }}
      />
      <Button size="sm" variant="outline" className="h-7" onClick={() => {
        const lines = commit(text);
        const next = lines.flatMap((line) => line.length > 1 && !/\s/.test(line) ? Array.from(line) : [line]);
        setText(next.join("\n"));
        onCommit(next);
      }}>Split long lines into characters</Button>
    </div>
  );
}

function SymbolKeysEditor({ values, onCommit }: { values: Array<{ label: string; command: string }>; onCommit: (values: Array<{ label: string; command: string }>) => void }) {
  const [text, setText] = useState(values.map((item) => `${item.label}: ${item.command}`).join("\n"));
  const parse = (nextText: string): Array<{ label: string; command: string }> => {
    const next = nextText.split("\n").map((line) => {
      const at = line.indexOf(":");
      if (at < 0) return { label: line.trim(), command: "" };
      return { label: line.slice(0, at).trim(), command: line.slice(at + 1).trim() };
    }).filter((item) => item.label);
    onCommit(next);
    return next;
  };
  return (
    <div className="space-y-1">
      <Label>Symbols · 每行 label: command（离开输入框时保存）</Label>
      <textarea
        className="h-56 w-full rounded border border-border bg-background p-2 font-mono text-[11px]"
        value={text}
        onChange={(event) => setText(event.target.value)}
        onBlur={() => { setText(parse(text).map((item) => `${item.label}: ${item.command}`).join("\n")); }}
      />
    </div>
  );
}

function NumberInput({ value, onChange, step = 1 }: { value: number; onChange: (value: number) => void; step?: number }) {
  return <Input className="h-7" type="number" step={step} value={Number.isFinite(value) ? value : 0} onChange={(event) => onChange(Number(event.target.value))} />;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1"><Label>{label}</Label>{children}</div>;
}
