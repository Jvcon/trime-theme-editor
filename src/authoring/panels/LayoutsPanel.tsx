import { useRef, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Copy, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ActionField } from "../components/ActionField";
import { BEHAVIORS, Selector } from "../components/Selector";
import type { ActionRef, KeySlot, LayoutPreset, PresetLibraries, ProjectBundle } from "../types";
import { actionLabel, cloneLayout, embedLayout, findLayout, fitLayoutRows, keyStyleColors, mainLayout, pages, pruneBundleLayouts, reflowLayoutRows, tokenValue } from "../utils";

type Props = {
  project: ProjectBundle;
  libs: PresetLibraries;
  activeLayoutId: string;
  setActiveLayoutId: (id: string) => void;
  mutate: (fn: (draft: ProjectBundle) => void) => void;
  editLayout: (id: string, fn: (layout: LayoutPreset) => void) => void;
  setMessage: (message: string) => void;
};

type Behavior = (typeof BEHAVIORS)[number][0];

const targetOf = (slot: KeySlot | undefined, behavior: Behavior): ActionRef | undefined =>
  slot ? (slot as unknown as Record<string, ActionRef | undefined>)[behavior] : undefined;

export function LayoutsPanel({ project, libs, activeLayoutId, setActiveLayoutId, mutate, editLayout, setMessage }: Props) {
  const layout = findLayout(project, activeLayoutId, libs) ?? mainLayout(project, libs);
  const card = project.theme ?? libs.themeCards[0];
  const [selected, setSelected] = useState<{ row: number; key: number }>();
  const [targetBehavior, setTargetBehavior] = useState<Behavior>("click");
  const [rightTab, setRightTab] = useState("page");
  const [popup, setPopup] = useState<{ row: number; key: number }>();
  const [newPopup, setNewPopup] = useState("");
  const [drag, setDrag] = useState<{ row: number; key: number } | null>(null);
  const [drop, setDrop] = useState<{ row: number; index: number } | null>(null);

  const selectedKey = selected ? layout.rows[selected.row]?.keys[selected.key] : undefined;
  const main = mainLayout(project, libs);
  const allPages = pages(project, libs);
  const availablePages = libs.layouts.filter((item) => item.id !== main.id && !project.layouts.some((layout) => layout.id === item.id));

  const choose = (id: string) => {
    setActiveLayoutId(id);
    setSelected(undefined);
    setPopup(undefined);
  };

  const updateKey = (fn: (key: KeySlot) => void) => {
    if (!selected) return;
    editLayout(layout.id, (draft) => {
      const key = draft.rows[selected.row]?.keys[selected.key];
      if (key) fn(key);
    });
  };

  const setBehavior = (behavior: Behavior, action: ActionRef | undefined) => {
    updateKey((key) => {
      (key as unknown as Record<string, unknown>)[behavior] = action;
    });
  };

  const addKey = () => {
    const rowIndex = selected?.row ?? layout.rows.length - 1;
    editLayout(layout.id, (draft) => {
      const row = draft.rows[rowIndex] ?? draft.rows[draft.rows.length - 1];
      if (!row) return;
      row.keys.push({ style: "default", width: 10, click: { kind: "char", value: "a" }, label: "A" });
    });
    setMessage("已新增键（点击后设置字符/宽度）");
  };

  const addRow = () => {
    editLayout(layout.id, (draft) => {
      draft.rows.push({ height: 52, keys: [{ style: "default", width: 100, click: { kind: "char", value: "a" }, label: "A" }] });
    });
    setMessage("已新增行");
  };

  const duplicateKey = () => {
    if (!selected) return;
    editLayout(layout.id, (draft) => {
      const row = draft.rows[selected.row];
      if (!row) return;
      row.keys.splice(selected.key + 1, 0, structuredClone(row.keys[selected.key]));
    });
    setSelected({ row: selected.row, key: selected.key + 1 });
  };

  const moveKey = (direction: -1 | 1) => {
    if (!selected) return;
    editLayout(layout.id, (draft) => {
      const row = draft.rows[selected.row];
      const next = selected.key + direction;
      if (!row || next < 0 || next >= row.keys.length) return;
      [row.keys[selected.key], row.keys[next]] = [row.keys[next], row.keys[selected.key]];
    });
    setSelected({ row: selected.row, key: selected.key + direction });
  };

  const moveKeyToRow = (direction: -1 | 1) => {
    if (!selected) return;
    const target = selected.row + direction;
    if (target < 0 || target >= layout.rows.length) return;
    editLayout(layout.id, (draft) => {
      const source = draft.rows[selected.row];
      const destination = draft.rows[target];
      if (!source || !destination || !source.keys[selected.key]) return;
      const [moved] = source.keys.splice(selected.key, 1);
      destination.keys.splice(Math.min(selected.key, destination.keys.length), 0, moved);
    });
    setSelected({ row: target, key: Math.min(selected.key, layout.rows[target]?.keys.length ?? 0) });
    setMessage("已移动到相邻行；需要时用 Fit/Reflow 校准行宽");
  };

  const deleteKey = () => {
    if (!selected) return;
    editLayout(layout.id, (draft) => {
      draft.rows[selected.row]?.keys.splice(selected.key, 1);
    });
    setSelected(undefined);
  };

  const moveRow = (rowIndex: number, direction: -1 | 1) => {
    const next = rowIndex + direction;
    if (next < 0 || next >= layout.rows.length) return;
    editLayout(layout.id, (draft) => {
      [draft.rows[rowIndex], draft.rows[next]] = [draft.rows[next], draft.rows[rowIndex]];
    });
    setSelected(undefined);
  };

  const deleteRow = (rowIndex: number) => {
    if (layout.rows.length <= 1) return setMessage("至少保留一行");
    editLayout(layout.id, (draft) => {
      draft.rows.splice(rowIndex, 1);
    });
    setSelected(undefined);
  };

  const fitRow = (rowIndex: number) => {
    editLayout(layout.id, (draft) => {
      const row = draft.rows[rowIndex];
      if (!row) return;
      const total = row.keys.reduce((sum, key) => sum + (key.width || 1), 0);
      row.keys.forEach((key) => {
        key.width = Number((((key.width || 1) / total) * 100).toFixed(3));
      });
    });
  };

  const resetDrag = () => {
    setDrag(null);
    setDrop(null);
  };

  const moveKeyTo = (from: { row: number; key: number }, to: { row: number; index: number }) => {
    if (from.row === to.row && (to.index === from.key || to.index === from.key + 1)) {
      resetDrag();
      return;
    }
    editLayout(layout.id, (draft) => {
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
    setSelected({ row: to.row, key: Math.max(0, Math.min(nextIndex, layout.rows[to.row]?.keys.length ?? 0)) });
    setMessage("已移动键位；注意检查行宽是否仍为 100%");
    resetDrag();
  };

  const fitAllRows = () => {
    editLayout(layout.id, (draft) => fitLayoutRows(draft));
    setMessage("已把每一行宽度校准到 100%");
  };

  const reflowRows = () => {
    editLayout(layout.id, (draft) => reflowLayoutRows(draft));
    setSelected(undefined);
    setMessage("已按宽度重新分行，并校准到 100%");
  };

  const distributeRow = (rowIndex: number) => {
    editLayout(layout.id, (draft) => {
      const row = draft.rows[rowIndex];
      if (!row || row.keys.length === 0) return;
      row.keys.forEach((key) => { key.width = Number((100 / row.keys.length).toFixed(3)); });
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
    choose(id);
  };

  const duplicateLayout = () => {
    const source = layout;
    const clone = cloneLayout(source, `${source.name} 副本`);
    mutate((draft) => {
      draft.layouts.push(clone);
      if (draft.mainLayoutId === source.id) draft.mainLayoutId = clone.id;
      else draft.pageIds = draft.pageIds.map((id) => (id === source.id ? clone.id : id));
      pruneBundleLayouts(draft);
    });
    choose(clone.id);
    setMessage(`已复制布局：${clone.name}`);
  };

  const createLayout = () => {
    const clone = cloneLayout(layout, "新布局") as LayoutPreset;
    clone.id = `custom-layout-${Date.now()}`;
    clone.pageRole = "number";
    clone.rows = [{ height: 52, keys: [{ style: "default", width: 100, click: { kind: "char", value: "a" }, label: "A" }] }];
    mutate((draft) => {
      draft.layouts.push(clone);
      draft.pageIds = [...draft.pageIds, clone.id];
      pruneBundleLayouts(draft);
    });
    choose(clone.id);
    setMessage("已新增空白页");
  };

  const deleteLayout = () => {
    if (layout.builtin) return setMessage("内置布局只读；请复制后再编辑");
    const fallback = libs.layouts.find((item) => item.id === "qwerty26") ?? libs.layouts.find((item) => item.pageRole === "main");
    mutate((draft) => {
      draft.layouts = draft.layouts.filter((item) => item.id !== layout.id);
      draft.pageIds = draft.pageIds.filter((id) => id !== layout.id);
      if (draft.mainLayoutId === layout.id && fallback) {
        embedLayout(draft, fallback);
        draft.mainLayoutId = fallback.id;
      }
      pruneBundleLayouts(draft);
    });
    choose(project.mainLayoutId === layout.id ? fallback?.id ?? project.mainLayoutId : project.mainLayoutId);
    setMessage("已删除布局");
  };

  const addPage = (id: string) => {
    if (!id) return;
    const next = libs.layouts.find((item) => item.id === id);
    if (!next) return;
    mutate((draft) => {
      embedLayout(draft, next);
      draft.pageIds = [...draft.pageIds.filter((item) => item !== id), id];
      pruneBundleLayouts(draft);
    });
    choose(id);
  };

  const removePage = (id: string) => {
    mutate((draft) => {
      draft.pageIds = draft.pageIds.filter((item) => item !== id);
      draft.layouts = draft.layouts.filter((item) => item.id !== id);
      pruneBundleLayouts(draft);
    });
    if (activeLayoutId === id) choose(project.mainLayoutId);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Main</span>
        <Select className="h-7 w-40" value={main.id} onChange={(event) => selectMainLayout(event.target.value)}>
          {libs.layouts.filter((item) => item.pageRole === "main").map((item) => <option key={item.id} value={item.id}>{item.name}{item.builtin ? "" : " · custom"}</option>)}
        </Select>
        <span className="ml-2 text-[10px] uppercase tracking-wider text-muted-foreground">Pages</span>
        <div className="flex flex-wrap items-center gap-1">
          {allPages.map((page, index) => (
            <span key={page.id} className={`inline-flex items-center rounded border text-[10px] ${activeLayoutId === page.id ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>
              <button type="button" className="px-1.5 py-0.5" onClick={() => choose(page.id)} title={page.id}>{index === 0 ? `主 · ${page.name}` : page.name}</button>
              {index > 0 ? <button type="button" className="border-l border-border px-1 text-red-300" onClick={() => removePage(page.id)}>×</button> : null}
            </span>
          ))}
          {availablePages.length > 0 ? (
            <Select className="h-6 w-28 text-[10px]" value="" onChange={(event) => addPage(event.target.value)}>
              <option value="">+ Page</option>
              {availablePages.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </Select>
          ) : null}
          <Button size="sm" variant="ghost" className="h-6 px-1 text-[10px]" onClick={createLayout}><Plus className="size-3" />Blank</Button>
        </div>
        <div className="ml-auto flex items-center gap-1">
          <Badge variant="muted">{layout.rows.reduce((sum, row) => sum + row.keys.length, 0)} keys</Badge>
          <Badge variant="muted">{layout.rows.length} rows</Badge>
          {layout.builtin ? <Badge variant="muted">builtin</Badge> : <Badge variant="success">custom</Badge>}
          <Button size="sm" variant="outline" className="h-7" onClick={duplicateLayout}><Copy />Duplicate</Button>
          <Button size="sm" variant="outline" className="h-7 text-red-300" disabled={layout.builtin} onClick={deleteLayout}><Trash2 />Delete</Button>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-auto p-4 xl:grid-cols-[minmax(0,3fr)_minmax(340px,2fr)]">
        <div className="flex min-h-0 flex-col gap-3">
          <section className="rounded-xl border border-border bg-card p-3">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-xs font-medium">Keyboard preview</span>
              <Badge variant="muted">{layout.name}</Badge>
              <span className="ml-auto text-[9px] text-muted-foreground">点击选择 · 长按 popup · 双击 action · 拖拽移动/跨行</span>
            </div>
            <div className="relative mx-auto w-full max-w-2xl rounded-lg bg-muted/20 p-3">
              {layout.rows.map((row, rowIndex) => (
                <div
                  key={rowIndex}
                  className={`mb-1 flex gap-1 ${drop?.row === rowIndex && drop.index >= row.keys.length ? "rounded ring-1 ring-primary" : ""}`}
                  onDragOver={(event) => {
                    if (!drag) return;
                    event.preventDefault();
                    setDrop({ row: rowIndex, index: row.keys.length });
                  }}
                  onDrop={(event) => {
                    if (!drag) return;
                    event.preventDefault();
                    moveKeyTo(drag, { row: rowIndex, index: row.keys.length });
                  }}
                >
                  {row.keys.map((key, keyIndex) => (
                    <PreviewKey
                      key={keyIndex}
                      slot={key}
                      height={row.height}
                      colors={keyStyleColors(card, project.variant, project.keyStyles, key.style)}
                      selected={selected?.row === rowIndex && selected?.key === keyIndex}
                      dragging={drag?.row === rowIndex && drag.key === keyIndex}
                      dropBefore={Boolean(drag) && drop?.row === rowIndex && drop.index === keyIndex}
                      actionText={actionLabel(key.click, libs)}
                      onSelect={() => { setSelected({ row: rowIndex, key: keyIndex }); setRightTab("key"); }}
                      onPopup={() => { setPopup({ row: rowIndex, key: keyIndex }); setRightTab("key"); }}
                      onDragStart={() => setDrag({ row: rowIndex, key: keyIndex })}
                      onDragEnd={resetDrag}
                      onDragOver={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        setDrop({ row: rowIndex, index: keyIndex });
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        if (drag) moveKeyTo(drag, { row: rowIndex, index: keyIndex });
                      }}
                    />
                  ))}
                </div>
              ))}
              {popup ? (() => {
                const row = layout.rows[popup.row];
                const key = row?.keys[popup.key];
                if (!row || !key || !key.popup?.length) return null;
                const rowHeight = (value: typeof row) => value.height ?? value.keys[0]?.height ?? 48;
                let top = 12;
                for (let index = 0; index < popup.row; index += 1) top += rowHeight(layout.rows[index]) + 4;
                top += rowHeight(row) + 4;
                const left = row.keys.slice(0, popup.key).reduce((sum, item) => sum + item.width, 0) + key.width / 2;
                const popupWidth = Math.max(32, project.metrics?.popupWidth ?? 44);
                const popupHeight = Math.max(28, project.metrics?.popupKeyHeight ?? 48);
                const popupTextSize = project.metrics?.popupTextSize ?? 22;
                const popupBack = tokenValue(card, project.variant, "surfaceAlt");
                const popupText = tokenValue(card, project.variant, "text");
                return (
                  <div className="pointer-events-none absolute z-20" style={{ left: `${left}%`, top, transform: "translateX(-50%)" }}>
                    <div className="pointer-events-auto flex gap-1 rounded-lg border p-1 shadow-2xl" style={{ background: popupBack, borderColor: tokenValue(card, project.variant, "border") }}>
                      {key.popup.map((item) => (
                        <button key={item} type="button" className="flex items-center justify-center rounded border" style={{ minWidth: popupWidth, height: popupHeight, fontSize: Math.min(popupTextSize, 24), background: tokenValue(card, project.variant, "surface"), color: popupText, borderColor: tokenValue(card, project.variant, "border") }} onClick={() => setMessage(`popup commits: ${item}`)}>
                          {item}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })() : null}
            </div>
            {popup ? (
              <div className="mt-2 rounded-lg border border-border bg-popover p-2">
                <div className="mb-1 flex items-center gap-2">
                  <span className="text-[10px] font-medium">Popup preview</span>
                  <span className="text-[9px] text-muted-foreground">popup 非空时 long_click 不触发</span>
                  <Button size="sm" variant="ghost" className="ml-auto h-5 px-1 text-[9px]" onClick={() => setPopup(undefined)}>close</Button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {(layout.rows[popup.row]?.keys[popup.key]?.popup ?? []).length > 0
                    ? (layout.rows[popup.row]?.keys[popup.key]?.popup ?? []).map((item) => (
                      <button key={item} type="button" className="rounded border border-border bg-background px-2 py-1 text-xs" onClick={() => setMessage(`popup commits: ${item}`)}>{item}</button>
                    ))
                    : <span className="text-[10px] text-muted-foreground">该键没有 popup。</span>}
                </div>
              </div>
            ) : null}
          </section>

          <section className="rounded-xl border border-border bg-card p-3">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-xs font-medium">Row editor</span>
              <Button size="sm" variant="ghost" className="ml-auto h-7 text-[10px]" onClick={fitAllRows}>Fit all</Button>
              <Button size="sm" variant="ghost" className="h-7 text-[10px]" onClick={reflowRows}>Reflow</Button>
              <Button size="sm" variant="outline" className="h-7" onClick={addRow}><Plus />Add row</Button>
              <Button size="sm" variant="outline" className="h-7" onClick={addKey}><Plus />Add key</Button>
            </div>
            <div className="space-y-1">
              {layout.rows.map((row, rowIndex) => (
                <div key={rowIndex} className="flex items-center gap-2 rounded border border-border bg-muted/20 px-2 py-1 text-[10px]">
                  <span className="w-14">Row {rowIndex + 1}</span>
                  <span className="w-16 text-muted-foreground">{row.keys.length} keys</span>
                  {(() => {
                    const sum = row.keys.reduce((total, key) => total + (key.width || 0), 0);
                    return <span className={`w-14 ${Math.abs(sum - 100) > 0.5 ? "text-amber-300" : "text-muted-foreground"}`} title="该行宽度合计">{sum.toFixed(1)}%</span>;
                  })()}
                  <span className="text-muted-foreground">height</span>
                  <Input className="h-6 w-14" type="number" value={row.height ?? 0} onChange={(event) => editLayout(layout.id, (draft) => { draft.rows[rowIndex].height = Number(event.target.value); })} />
                  <Button size="sm" variant="ghost" className="h-6 px-1" onClick={() => moveRow(rowIndex, -1)} disabled={rowIndex === 0}><ArrowUp /></Button>
                  <Button size="sm" variant="ghost" className="h-6 px-1" onClick={() => moveRow(rowIndex, 1)} disabled={rowIndex === layout.rows.length - 1}><ArrowDown /></Button>
                  <Button size="sm" variant="ghost" className="h-6 px-1 text-[9px]" onClick={() => fitRow(rowIndex)}>Fit 100%</Button>
                  <Button size="sm" variant="ghost" className="h-6 px-1 text-[9px]" onClick={() => distributeRow(rowIndex)}>Distribute</Button>
                  <Button size="sm" variant="ghost" className="ml-auto h-6 px-1 text-red-300" onClick={() => deleteRow(rowIndex)}><Trash2 /></Button>
                </div>
              ))}
            </div>
          </section>

          <Selector libs={libs} targetBehavior={targetBehavior} setTargetBehavior={(value) => setTargetBehavior(value as Behavior)} onAssign={(action) => {
            if (!selected) return setMessage("先在预览里选择一个键");
            setBehavior(targetBehavior, action);
          }} />
        </div>

        <section className="min-h-0 rounded-xl border border-border bg-card p-3">
          <Tabs value={rightTab} onValueChange={setRightTab}>
            <TabsList>
              <TabsTrigger value="page">Page</TabsTrigger>
              <TabsTrigger value="key">Key</TabsTrigger>
              <TabsTrigger value="behavior">Behavior</TabsTrigger>
              <TabsTrigger value="style">Style</TabsTrigger>
            </TabsList>

            <div className="mt-2 max-h-[calc(100vh-13rem)] overflow-auto pr-1">
              <TabsContent value="page" className="mt-0 space-y-2">
                <Field label="Layout name"><Input value={layout.name} onChange={(event) => editLayout(layout.id, (draft) => { draft.name = event.target.value; })} /></Field>
                <Field label="Page role">
                  <Select value={layout.pageRole} onChange={(event) => editLayout(layout.id, (draft) => { draft.pageRole = event.target.value as LayoutPreset["pageRole"]; })}>
                    <option value="main">main</option>
                    <option value="number">number</option>
                    <option value="symbols">symbols</option>
                  </Select>
                </Field>
                <p className="text-[10px] text-muted-foreground">页面由主布局 + Pages 组合；编译时每个页面成为一个 preset_keyboard。</p>
                <div className="rounded border border-border bg-muted/20 p-2 text-[10px] text-muted-foreground">
                  <div>id: <code>{layout.id}</code></div>
                  <div>rows: {layout.rows.length} · keys: {layout.rows.reduce((sum, row) => sum + row.keys.length, 0)}</div>
                </div>
              </TabsContent>

              <TabsContent value="key" className="mt-0 space-y-2">
                {selectedKey && selected ? (
                  <>
                    <Field label="Label"><Input value={selectedKey.label ?? ""} onChange={(event) => updateKey((key) => { key.label = event.target.value; })} /></Field>
                    <div className="grid grid-cols-2 gap-2">
                      <Field label="Label symbol"><Input value={selectedKey.label_symbol ?? ""} onChange={(event) => updateKey((key) => { key.label_symbol = event.target.value; })} /></Field>
                      <Field label="Hint"><Input value={selectedKey.hint ?? ""} onChange={(event) => updateKey((key) => { key.hint = event.target.value; })} /></Field>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Field label="Style type">
                        <Select value={selectedKey.style} onChange={(event) => updateKey((key) => { key.style = event.target.value; })}>
                          {Object.keys(project.keyStyles).map((id) => <option key={id} value={id}>{id}</option>)}
                        </Select>
                      </Field>
                      <Field label="Click action">
                        <div className="whitespace-normal break-words rounded border border-border bg-muted/20 px-2 py-1.5 text-[10px]" title={actionLabel(selectedKey.click, libs)}>{actionLabel(selectedKey.click, libs)}</div>
                      </Field>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Field label="Width %"><Input type="number" value={selectedKey.width} onChange={(event) => updateKey((key) => { key.width = Number(event.target.value); })} /></Field>
                      <Field label="Height px"><Input type="number" value={selectedKey.height ?? 0} onChange={(event) => updateKey((key) => { key.height = Number(event.target.value); })} /></Field>
                    </div>

                    <div className="space-y-1">
                      <Label>Popup items</Label>
                      <p className="text-[9px] text-muted-foreground">每项是上屏文本；支持增删、排序。popup 非空时 long_click 不会触发。</p>
                      {selectedKey.popup?.length ? (
                        <div className="space-y-1">
                          {selectedKey.popup.map((item, index, items) => (
                            <div key={`${item}-${index}`} className="flex items-center gap-1">
                              <Input value={item} onChange={(event) => updateKey((key) => { key.popup = (key.popup ?? []).map((value, i) => (i === index ? event.target.value : value)); })} />
                              <Button size="sm" variant="ghost" className="h-7 px-1" disabled={index === 0} onClick={() => updateKey((key) => {
                                const next = [...(key.popup ?? [])];
                                [next[index - 1], next[index]] = [next[index], next[index - 1]];
                                key.popup = next;
                              })}><ArrowUp /></Button>
                              <Button size="sm" variant="ghost" className="h-7 px-1" disabled={index === items.length - 1} onClick={() => updateKey((key) => {
                                const next = [...(key.popup ?? [])];
                                [next[index + 1], next[index]] = [next[index], next[index + 1]];
                                key.popup = next;
                              })}><ArrowDown /></Button>
                              <Button size="sm" variant="ghost" className="h-7 px-1 text-red-300" onClick={() => updateKey((key) => { key.popup = (key.popup ?? []).filter((_, i) => i !== index); })}>×</Button>
                            </div>
                          ))}
                        </div>
                      ) : <p className="text-[10px] text-muted-foreground">没有 popup。</p>}
                      <div className="flex gap-1">
                        <Input value={newPopup} placeholder="新增 popup 文本（可粘贴多项）" onChange={(event) => setNewPopup(event.target.value)} onKeyDown={(event) => {
                          if (event.key !== "Enter" || !newPopup) return;
                          updateKey((key) => { key.popup = [...(key.popup ?? []), newPopup]; });
                          setNewPopup("");
                        }} />
                        <Button size="sm" variant="outline" className="h-8" disabled={!newPopup} onClick={() => {
                          updateKey((key) => { key.popup = [...(key.popup ?? []), newPopup]; });
                          setNewPopup("");
                        }}>+ Add</Button>
                      </div>
                      <Button size="sm" variant="outline" className="h-7 w-full" onClick={() => {
                        const items = newPopup.split(/[\n,，、\s]+/).filter(Boolean);
                        if (!items.length) return;
                        updateKey((key) => { key.popup = [...(key.popup ?? []), ...items]; });
                        setNewPopup("");
                      }}>Bulk add pasted text</Button>
                    </div>

                    <div className="flex flex-wrap gap-1 pt-1">
                      <Button size="sm" variant="outline" onClick={() => moveKey(-1)} disabled={!selected || selected.key === 0}><ArrowLeft />Left</Button>
                      <Button size="sm" variant="outline" onClick={() => moveKey(1)} disabled={!selected || selected.key >= layout.rows[selected.row].keys.length - 1}><ArrowRight />Right</Button>
                      <Button size="sm" variant="outline" onClick={() => moveKeyToRow(-1)} disabled={!selected || selected.row === 0}><ArrowUp />Row</Button>
                      <Button size="sm" variant="outline" onClick={() => moveKeyToRow(1)} disabled={!selected || selected.row >= layout.rows.length - 1}><ArrowDown />Row</Button>
                      <Button size="sm" variant="outline" onClick={duplicateKey}><Copy />Duplicate</Button>
                      <Button size="sm" variant="destructive" onClick={deleteKey}><Trash2 />Delete</Button>
                    </div>
                  </>
                ) : <p className="text-xs text-muted-foreground">在预览或行编辑器中点击一个键。</p>}
              </TabsContent>

              <TabsContent value="behavior" className="mt-0 space-y-2">
                {selectedKey ? (
                  <>
                    <p className="text-[10px] text-muted-foreground">目标行为：<Badge variant="success">{targetBehavior}</Badge>，点下方行切换目标；用 Insert action 写入。</p>
                    {BEHAVIORS.map(([behavior, label]) => (
                      <div key={behavior} className={`rounded border p-2 ${targetBehavior === behavior ? "border-primary bg-primary/5" : "border-border"}`}>
                        <button type="button" className="mb-1 flex w-full items-center justify-between text-[10px]" onClick={() => setTargetBehavior(behavior)}>
                          <span>{label}</span>
                          <span className="whitespace-normal break-words text-right text-muted-foreground" title={actionLabel(targetOf(selectedKey, behavior), libs)}>{actionLabel(targetOf(selectedKey, behavior), libs)}</span>
                        </button>
                        <ActionField action={targetOf(selectedKey, behavior)} libs={libs} onChange={(action) => setBehavior(behavior, action)} />
                      </div>
                    ))}
                  </>
                ) : <p className="text-xs text-muted-foreground">先选择一个键。</p>}
              </TabsContent>

              <TabsContent value="style" className="mt-0 space-y-2">
                <p className="text-[10px] text-muted-foreground">键位只引用 style type；颜色由主题色卡 token 展开，不允许单键写 hex。</p>
                {Object.values(project.keyStyles).map((style) => (
                  <div key={style.id} className="flex items-center gap-2 rounded border border-border bg-muted/20 px-2 py-1 text-[10px]">
                    <Badge variant="muted">{style.id}</Badge>
                    <span className="text-muted-foreground">bg</span><code>{style.background}</code>
                    <span className="text-muted-foreground">text</span><code>{style.text}</code>
                    <span className="ml-auto text-muted-foreground">→ Themes</span>
                  </div>
                ))}
              </TabsContent>
            </div>
          </Tabs>
        </section>
      </div>
    </div>
  );
}

function PreviewKey({ slot, height, colors, selected, dragging, dropBefore, actionText, onSelect, onPopup, onDragStart, onDragEnd, onDragOver, onDrop }: {
  slot: KeySlot;
  height?: number;
  colors: { background: string; text: string; border: string; symbol: string };
  selected: boolean;
  dragging: boolean;
  dropBefore: boolean;
  actionText: string;
  onSelect: () => void;
  onPopup: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDragOver: (event: React.DragEvent<HTMLButtonElement>) => void;
  onDrop: (event: React.DragEvent<HTMLButtonElement>) => void;
}) {
  const timer = useRef<number | undefined>(undefined);
  const fired = useRef(false);

  const start = () => {
    fired.current = false;
    timer.current = window.setTimeout(() => {
      fired.current = true;
      if (slot.popup?.length) onPopup();
    }, 450);
  };
  const stop = () => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = undefined;
  };

  return (
    <button
      type="button"
      draggable
      className={`relative min-w-0 overflow-hidden rounded-md border px-1 text-[11px] ${selected ? "ring-2 ring-primary" : ""} ${dragging ? "opacity-40" : ""} ${dropBefore ? "border-l-2 border-primary" : ""}`}
      style={{ width: `${slot.width}%`, height: height ?? slot.height ?? 48, background: colors.background, color: colors.text, borderColor: colors.border }}
      title={actionText}
      onPointerDown={start}
      onPointerUp={stop}
      onPointerLeave={stop}
      onClick={() => { if (!fired.current) onSelect(); fired.current = false; }}
      onDoubleClick={() => (slot.popup?.length ? onPopup() : onSelect())}
      onDragStart={(event) => {
        stop();
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", `${slot.label ?? actionText}`);
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <span className="block whitespace-normal break-words leading-tight">{slot.label ?? actionText}</span>
      {slot.label_symbol ? <span className="absolute left-1 top-0 text-[8px]" style={{ color: colors.symbol }}>{slot.label_symbol}</span> : null}
      {slot.hint ? <span className="absolute inset-x-1 bottom-0 truncate text-[8px]" style={{ color: colors.symbol }}>{slot.hint}</span> : null}
      {slot.popup?.length ? <span className="absolute right-1 top-0 text-[8px] opacity-70">▾</span> : null}
      {slot.long_click ? <span className="absolute right-1 bottom-0 text-[8px] opacity-60">↳</span> : null}
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1"><Label>{label}</Label>{children}</div>;
}
