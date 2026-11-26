import { useEffect, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Copy, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ActionField } from "../components/ActionField";
import { KeyboardPreview, type DropPosition, type KeyPosition } from "../components/KeyboardPreview";
import { BEHAVIORS, Selector } from "../components/Selector";
import { LAYOUT_RULES } from "../devicePresets";
import { devicesUsingLayout, impactLabel } from "../impact";
import type { ActionRef, KeySlot, LayoutPreset, Orientation, PresetLibraries, ProjectBundle } from "../types";
import { actionLabel, addLandscapeVariant, cloneLayout, embedLayout, firstLayoutId, fitLayoutRows, groupLayouts, isPlaceholder, newLayout, pruneBundleLayouts, reflowLayoutRows, removeLandscapeVariant } from "../utils";

type Props = {
  project: ProjectBundle;
  libs: PresetLibraries;
  activeLayoutId: string;
  setActiveLayoutId: (id: string) => void;
  mutate: (fn: (draft: ProjectBundle) => void) => void;
  editLayout: (id: string, fn: (layout: LayoutPreset) => void) => void;
  setMessage: (message: string) => void;
  onPreviewOrientation?: (orientation: Orientation) => void;
  selected?: KeyPosition;
  onSelectKey: (position: KeyPosition | undefined) => void;
  popup?: KeyPosition | null;
  onPopupKey: (position: KeyPosition | null) => void;
  rightTab: string;
  setRightTab: (tab: string) => void;
  onMoveKey: (from: KeyPosition, to: DropPosition) => void;
};

type Behavior = (typeof BEHAVIORS)[number][0];

const KEY_COLOR_FIELDS = [
  ["key_back_color", "Key back"],
  ["key_text_color", "Key text"],
  ["key_symbol_color", "Key symbol"],
  ["key_border_color", "Key border"],
  ["hilited_key_back_color", "Pressed back"],
  ["hilited_key_text_color", "Pressed text"],
  ["hilited_key_symbol_color", "Pressed symbol"],
  ["hilited_key_border_color", "Pressed border"],
] as const;

const targetOf = (slot: KeySlot | undefined, behavior: Behavior): ActionRef | undefined =>
  slot ? (slot as unknown as Record<string, ActionRef | undefined>)[behavior] : undefined;

export function LayoutsPanel({
  project, libs, activeLayoutId, setActiveLayoutId, mutate, editLayout, setMessage, onPreviewOrientation,
  selected, onSelectKey, popup, onPopupKey, rightTab, setRightTab, onMoveKey,
}: Props) {
  const group = groupLayouts(project);
  const variantIds = new Set(
    project.layouts.map((item) => item.landscapeId).filter((value): value is string => Boolean(value)),
  );
  const activeLayout = project.layouts.find((item) => item.id === activeLayoutId);
  const activeIsVariant = Boolean(activeLayout && variantIds.has(activeLayout.id));
  const activeBase = activeIsVariant
    ? project.layouts.find((item) => item.landscapeId === activeLayoutId)
    : activeLayout;
  const layout = activeLayout ?? group[0];
  const [targetBehavior, setTargetBehavior] = useState<Behavior>("click");
  const [newPopup, setNewPopup] = useState("");

  const choose = (id: string) => {
    setActiveLayoutId(id);
    onSelectKey(undefined);
    onPopupKey(null);
  };

  const addLayout = (id: string) => {
    if (!id) return;
    const next = libs.layouts.find((item) => item.id === id);
    if (!next) return;
    let createdId = id;
    mutate((draft) => {
      const embedded = embedLayout(draft, next);
      createdId = embedded.id;
      if (!draft.defaultLayoutId) draft.defaultLayoutId = embedded.id;
      pruneBundleLayouts(draft);
    });
    choose(createdId);
    setMessage(`已添加布局：${next.name}`);
  };

  const createBlank = () => {
    const blank = newLayout("新布局");
    mutate((draft) => {
      draft.layouts.push(blank);
      draft.layoutGroupIds.push(blank.id);
      if (!draft.defaultLayoutId) draft.defaultLayoutId = blank.id;
      pruneBundleLayouts(draft);
    });
    choose(blank.id);
    setMessage("已新建空白布局");
  };

  useEffect(() => {
    onPreviewOrientation?.(activeIsVariant ? "landscape" : "portrait");
  }, [activeIsVariant, onPreviewOrientation]);

  if (!layout) {
    const available = libs.layouts.filter(
      (item) => !project.layouts.some((existing) => existing.id === item.id) && !variantIds.has(item.id),
    );
    return (
      <div className="grid h-full place-items-center overflow-auto p-panel">
        <div className="w-full max-w-xl rounded-xl border border-border bg-card p-section text-center">
          <div className="mx-auto mb-3 grid size-12 place-items-center rounded-full bg-primary/10 text-primary"><Plus className="size-5" /></div>
          <h2 className="text-sm font-semibold">还没有布局</h2>
          <p className="mx-auto mt-1 max-w-md text-2xs text-muted-foreground">
            布局组是这套主题会编译出的键盘。先添加一个内置布局，或从空白布局开始；默认布局可以晚点再决定。
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <Select className="h-control w-44" value="" onChange={(event) => addLayout(event.target.value)}>
              <option value="">添加内置布局…</option>
              {available.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.role ?? "letters"}</option>)}
            </Select>
            <Button size="sm" variant="outline" onClick={createBlank}><Plus />新建空白布局</Button>
          </div>
        </div>
      </div>
    );
  }

  const selectedKey = selected ? layout.rows[selected.row]?.keys[selected.key] : undefined;
  const selectedPlaceholder = Boolean(selectedKey && isPlaceholder(selectedKey));
  const keyCount = layout.rows.reduce((sum, row) => sum + row.keys.filter((key) => !isPlaceholder(key)).length, 0);
  const gapCount = layout.rows.reduce((sum, row) => sum + row.keys.filter((key) => isPlaceholder(key)).length, 0);
  const colorOverrideCount = !selectedPlaceholder && selectedKey
    ? KEY_COLOR_FIELDS.filter(([field]) => Boolean(selectedKey[field])).length
    : 0;
  const groupIds = new Set(group.map((item) => item.id));
  const inheritingDevices = project.devices.filter((device) => !device.layoutId).length;
  const isDefault = project.defaultLayoutId === layout.id;
  const baseForChip = activeBase ?? layout;
  const landscapeVariant = baseForChip.landscapeId
    ? project.layouts.find((item) => item.id === baseForChip.landscapeId)
    : undefined;
  const usage = devicesUsingLayout(project, layout.id);
  const availableLayouts = libs.layouts.filter(
    (item) => !project.layouts.some((existing) => existing.id === item.id) && !variantIds.has(item.id),
  );

  const updateKey = (fn: (key: KeySlot) => void) => {
    if (!selected) return;
    editLayout(layout.id, (draft) => {
      const key = draft.rows[selected.row]?.keys[selected.key];
      if (key) fn(key);
    });
  };

  const setBehavior = (behavior: Behavior, action: ActionRef | undefined) => {
    if (selectedKey && isPlaceholder(selectedKey)) {
      setMessage("占位符只占宽度，不能绑定行为；请添加普通键");
      return;
    }
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

  /** Placeholders are a separate slot type: width only, no key fields. */
  const addPlaceholder = () => {
    if (layout.rows.length === 0) return setMessage("先新增一行再添加占位符");
    const rowIndex = selected?.row ?? layout.rows.length - 1;
    let nextIndex = 0;
    editLayout(layout.id, (draft) => {
      const row = draft.rows[rowIndex] ?? draft.rows[draft.rows.length - 1];
      if (!row) return;
      nextIndex = selected && selected.row === rowIndex ? selected.key + 1 : row.keys.length;
      row.keys.splice(nextIndex, 0, { kind: "placeholder", width: 5 });
    });
    onSelectKey({ row: rowIndex, key: nextIndex });
    setMessage("已新增占位符（只占宽度，不渲染按键）");
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
    onSelectKey({ row: selected.row, key: selected.key + 1 });
  };

  const moveKey = (direction: -1 | 1) => {
    if (!selected) return;
    editLayout(layout.id, (draft) => {
      const row = draft.rows[selected.row];
      const next = selected.key + direction;
      if (!row || next < 0 || next >= row.keys.length) return;
      [row.keys[selected.key], row.keys[next]] = [row.keys[next], row.keys[selected.key]];
    });
    onSelectKey({ row: selected.row, key: selected.key + direction });
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
    onSelectKey({ row: target, key: Math.min(selected.key, layout.rows[target]?.keys.length ?? 0) });
    setMessage("已移动到相邻行；需要时用 Fit/Reflow 校准行宽");
  };

  const deleteKey = () => {
    if (!selected) return;
    editLayout(layout.id, (draft) => {
      draft.rows[selected.row]?.keys.splice(selected.key, 1);
    });
    onSelectKey(undefined);
  };

  const moveRow = (rowIndex: number, direction: -1 | 1) => {
    const next = rowIndex + direction;
    if (next < 0 || next >= layout.rows.length) return;
    editLayout(layout.id, (draft) => {
      [draft.rows[rowIndex], draft.rows[next]] = [draft.rows[next], draft.rows[rowIndex]];
    });
    onSelectKey(undefined);
  };

  const deleteRow = (rowIndex: number) => {
    if (layout.rows.length <= 1) return setMessage("至少保留一行");
    editLayout(layout.id, (draft) => {
      draft.rows.splice(rowIndex, 1);
    });
    onSelectKey(undefined);
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

  const fitAllRows = () => {
    editLayout(layout.id, (draft) => fitLayoutRows(draft));
    setMessage("已把每一行宽度校准到 100%");
  };

  const reflowRows = () => {
    editLayout(layout.id, (draft) => reflowLayoutRows(draft));
    onSelectKey(undefined);
    setMessage("已按宽度重新分行，并校准到 100%");
  };

  const distributeRow = (rowIndex: number) => {
    editLayout(layout.id, (draft) => {
      const row = draft.rows[rowIndex];
      if (!row || row.keys.length === 0) return;
      row.keys.forEach((key) => { key.width = Number((100 / row.keys.length).toFixed(3)); });
    });
  };

  const setAsDefault = (id: string) => {
    if (!groupIds.has(id)) return;
    mutate((draft) => { draft.defaultLayoutId = id; });
    setMessage("已设为默认布局");
  };

  const clearDefault = () => {
    mutate((draft) => { delete draft.defaultLayoutId; });
    setMessage("已取消默认布局；请确保每台设备都单独绑定了布局");
  };

  const duplicateLayout = () => {
    const clone = cloneLayout(layout, `${layout.name} 副本`);
    mutate((draft) => {
      draft.layouts.push(clone);
      draft.layoutGroupIds.push(clone.id);
      if (!draft.defaultLayoutId) draft.defaultLayoutId = clone.id;
      pruneBundleLayouts(draft);
    });
    choose(clone.id);
    setMessage(`已复制布局：${clone.name}`);
  };

  const createLandscapeVariant = () => {
    const base = baseForChip;
    let createdId = "";
    mutate((draft) => {
      createdId = addLandscapeVariant(draft, base) ?? "";
    });
    if (createdId) choose(createdId);
    setMessage("已创建横屏变体（默认克隆竖屏结构，可再用「精简派生」去一行）");
  };

  const simplifyLandscapeVariant = () => {
    if (!activeIsVariant) return;
    editLayout(layout.id, (draft) => {
      if (draft.rows.length > LAYOUT_RULES.simplifyAboveRows) draft.rows.splice(-1, 1);
      fitLayoutRows(draft);
    });
    setMessage("已去掉最后一行并校准行宽");
  };

  const deleteLandscapeVariant = () => {
    if (!activeIsVariant) return;
    let ownerId = "";
    mutate((draft) => {
      ownerId = removeLandscapeVariant(draft, layout.id) ?? "";
    });
    choose(ownerId || firstLayoutId(project));
    setMessage("已删除横屏变体；横屏设备会回退到竖屏结构");
  };

  const deleteLayout = () => {
    if (activeIsVariant) {
      deleteLandscapeVariant();
      return;
    }
    const variantId = layout.landscapeId;
    const affected = project.devices.filter((device) => device.layoutId === layout.id).length;
    const schemaCount = project.schemaBindings.filter((binding) => binding.layoutId === layout.id).length;
    const pageCount = pageActionCount(project, layout.id);
    const details = [
      variantId ? "及其横屏变体" : "",
      project.defaultLayoutId === layout.id ? "默认布局标记会被清除" : "",
      project.defaultLayoutId === layout.id && inheritingDevices > 0 ? `${inheritingDevices} 台继承设备将失去默认布局` : "",
      affected ? `${affected} 台设备的绑定会被清除` : "",
      schemaCount ? `${schemaCount} 个 schema 绑定会被删除` : "",
      pageCount ? `${pageCount} 个 Page 跳转会被清除` : "",
    ].filter(Boolean).join("；");
    if (!window.confirm(`删除「${layout.name}」${details ? `？${details}。` : "？"}`)) return;
    const remaining = group.filter((item) => item.id !== layout.id);
    mutate((draft) => {
      draft.layouts = draft.layouts.filter((item) => item.id !== layout.id && item.id !== variantId);
      draft.layoutGroupIds = draft.layoutGroupIds.filter((id) => id !== layout.id);
      if (draft.defaultLayoutId === layout.id) delete draft.defaultLayoutId;
      for (const device of draft.devices) {
        if (device.layoutId === layout.id) delete device.layoutId;
      }
      draft.schemaBindings = draft.schemaBindings.filter((binding) => binding.layoutId !== layout.id);
      clearPageActions(draft, layout.id);
      if (variantId) clearPageActions(draft, variantId);
      pruneBundleLayouts(draft);
    });
    choose(remaining[0]?.id ?? "");
    setMessage("已删除布局");
  };

  const positionActions = selected ? (
    <div className="flex flex-wrap gap-1 pt-1">
      <Button size="sm" variant="outline" onClick={() => moveKey(-1)} disabled={!selected || selected.key === 0}><ArrowLeft />Left</Button>
      <Button size="sm" variant="outline" onClick={() => moveKey(1)} disabled={!selected || selected.key >= layout.rows[selected.row].keys.length - 1}><ArrowRight />Right</Button>
      <Button size="sm" variant="outline" onClick={() => moveKeyToRow(-1)} disabled={!selected || selected.row === 0}><ArrowUp />Row</Button>
      <Button size="sm" variant="outline" onClick={() => moveKeyToRow(1)} disabled={!selected || selected.row >= layout.rows.length - 1}><ArrowDown />Row</Button>
      <Button size="sm" variant="outline" onClick={duplicateKey}><Copy />Duplicate</Button>
      <Button size="sm" variant="destructive" onClick={deleteKey}><Trash2 />Delete</Button>
    </div>
  ) : null;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-stack border-b border-border px-panel py-2">
        <span className="text-2xs uppercase tracking-wider text-muted-foreground">布局组</span>
        <div className="flex flex-wrap items-center gap-1">
          {group.map((item) => {
            const active = baseForChip.id === item.id;
            const itemIsDefault = project.defaultLayoutId === item.id;
            return (
              <span key={item.id} className={`inline-flex items-center rounded border text-2xs ${active ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>
                <button type="button" className="px-1.5 py-0.5" onClick={() => choose(item.id)} title={item.id}>
                  {itemIsDefault ? "★ " : ""}{item.name}
                </button>
                <span className="border-l border-border px-1 text-4xs">{item.role ?? "letters"}</span>
              </span>
            );
          })}
        </div>
        {availableLayouts.length > 0 ? (
          <Select className="h-control-xs w-32 text-2xs" value="" onChange={(event) => addLayout(event.target.value)}>
            <option value="">+ 添加布局</option>
            {availableLayouts.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.role ?? "letters"}</option>)}
          </Select>
        ) : null}
        <Button size="sm" variant="ghost" className="h-control-xs px-1 text-2xs" onClick={createBlank}><Plus className="size-3" />Blank</Button>
        <div className="flex items-center gap-0.5 rounded-md border border-border bg-muted/20 p-0.5">
          <button
            type="button"
            aria-pressed={!activeIsVariant}
            className={`rounded-sm px-2 py-0.5 text-2xs transition-colors ${!activeIsVariant ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-surface-hover active:bg-surface-active hover:text-foreground"}`}
            onClick={() => choose(baseForChip.id)}
          >竖屏</button>
          <button
            type="button"
            aria-pressed={activeIsVariant}
            className={`rounded-sm px-2 py-0.5 text-2xs transition-colors ${activeIsVariant ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-surface-hover active:bg-surface-active hover:text-foreground"}`}
            onClick={() => (landscapeVariant ? choose(landscapeVariant.id) : createLandscapeVariant())}
          >{landscapeVariant ? "横屏" : "横屏 · 未创建"}</button>
        </div>
        {activeIsVariant ? (
          <>
            <Button size="sm" variant="ghost" className="h-control-sm text-2xs" onClick={simplifyLandscapeVariant}>精简派生</Button>
            <Button size="sm" variant="ghost" className="h-control-sm text-2xs text-destructive" onClick={deleteLandscapeVariant}>删除变体</Button>
          </>
        ) : null}
        <div className="ml-auto flex items-center gap-1">
          <Badge variant={activeIsVariant || isDefault ? "success" : "muted"}>
            {activeIsVariant ? "横屏变体" : isDefault ? "默认布局" : "布局"}
          </Badge>
          <Badge variant="muted">{keyCount} keys</Badge>
          {gapCount > 0 ? <Badge variant="muted">{gapCount} gaps</Badge> : null}
          <Badge variant="muted">{layout.rows.length} rows</Badge>
          {layout.builtin ? <Badge variant="muted">builtin</Badge> : <Badge variant="success">custom</Badge>}
          {!activeIsVariant ? (
            isDefault
              ? <Button size="sm" variant="ghost" className="h-control-sm text-2xs" onClick={clearDefault}>取消默认</Button>
              : <Button size="sm" variant="outline" className="h-control-sm" onClick={() => setAsDefault(baseForChip.id)}>设为默认</Button>
          ) : null}
          <Button size="sm" variant="outline" className="h-control-sm" onClick={duplicateLayout}><Copy />Duplicate</Button>
          <Button size="sm" variant="outline" className="h-control-sm text-destructive" onClick={deleteLayout}><Trash2 />Delete</Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-stack border-b border-border bg-muted/20 px-panel py-1 text-2xs text-muted-foreground">
        {activeIsVariant ? (
          <>
            <span>横屏变体：仅横屏设备使用</span>
            <span>· 编辑不会影响竖屏结构</span>
          </>
        ) : (
          <>
            <span className={usage.length ? "text-warning" : ""}>{impactLabel(usage)}</span>
            <span>· {isDefault ? "默认布局：未单独绑定布局的设备使用它" : usage.length ? "页面：也被部分设备直接绑定" : "页面：由运行时切换，不直接绑定设备"}</span>
            {landscapeVariant ? <span>· 竖屏改动不会自动同步横屏变体</span> : <span>· 未创建横屏变体时，横屏设备沿用此结构</span>}
          </>
        )}
      </div>

      {!project.defaultLayoutId ? (
        <div className={`flex flex-wrap items-center gap-2 border-b px-panel py-1 text-2xs ${inheritingDevices > 0 ? "border-warning/20 bg-warning/5 text-warning" : "border-border bg-muted/20 text-muted-foreground"}`}>
          <span>
            {inheritingDevices > 0
              ? `未设置默认布局：${inheritingDevices} 台未单独绑定布局的设备将无法编译。`
              : "未设置默认布局；所有设备都已单独绑定，可以正常编译。"}
          </span>
          <button type="button" className="underline underline-offset-2" onClick={() => setAsDefault(baseForChip.id)}>把「{baseForChip.name}」设为默认</button>
        </div>
      ) : null}

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-auto p-panel xl:grid-cols-[minmax(0,3fr)_minmax(340px,2fr)]">
        <div className="flex min-h-0 flex-col gap-3">
          <div className="hidden rounded-lg border border-border bg-muted/10 px-3 py-2 text-2xs text-muted-foreground lg:block">
            键盘在右侧「键盘编辑」中：点击选键、拖拽移动、长按 popup。小屏时这里会内嵌同一编辑器。
          </div>

          <section className="rounded-xl border border-border bg-card p-gutter lg:hidden">
            <div className="mb-2 flex items-center gap-stack">
              <span className="text-xs font-medium">键盘编辑</span>
              <Badge variant="muted">{layout.name}</Badge>
              <span className="ml-auto text-3xs text-muted-foreground">点击选键 · 拖拽移动 · 长按 popup</span>
            </div>
            <KeyboardPreview
              project={project}
              libs={libs}
              layout={layout}
              metrics={project.metrics ?? {}}
              orientation={activeIsVariant ? "landscape" : "portrait"}
              fit="full"
              interactive
              selected={selected}
              onSelect={onSelectKey}
              popup={popup}
              onPopup={onPopupKey}
              onMoveKey={onMoveKey}
              onMessage={setMessage}
              onClosePopup={() => onPopupKey(null)}
            />
          </section>

          <section className="rounded-xl border border-border bg-card p-gutter">
            <div className="mb-2 flex items-center gap-stack">
              <span className="text-xs font-medium">Row editor</span>
              <Button size="sm" variant="ghost" className="ml-auto h-control-sm text-2xs" onClick={fitAllRows}>Fit all</Button>
              <Button size="sm" variant="ghost" className="h-control-sm text-2xs" onClick={reflowRows}>Reflow</Button>
              <Button size="sm" variant="outline" className="h-control-sm" onClick={addRow}><Plus />Add row</Button>
              <Button size="sm" variant="outline" className="h-control-sm" onClick={addKey}><Plus />Add key</Button>
              <Button size="sm" variant="outline" className="h-control-sm" onClick={addPlaceholder}><Plus />Add placeholder</Button>
            </div>
            <div className="space-y-1">
              {layout.rows.map((row, rowIndex) => (
                <div key={rowIndex} className="flex items-center gap-stack rounded border border-border bg-muted/20 px-2 py-1 text-2xs">
                  <span className="w-14">Row {rowIndex + 1}</span>
                  {(() => {
                    const keys = row.keys.filter((key) => !isPlaceholder(key)).length;
                    const gaps = row.keys.length - keys;
                    return <span className="w-24 text-muted-foreground">{keys} keys{gaps ? ` · ${gaps} gap${gaps === 1 ? "" : "s"}` : ""}</span>;
                  })()}
                  {(() => {
                    const sum = row.keys.reduce((total, key) => total + (key.width || 0), 0);
                    return <span className={`w-14 ${Math.abs(sum - 100) > LAYOUT_RULES.rowWidthTolerance ? "text-warning" : "text-muted-foreground"}`} title="该行宽度合计">{sum.toFixed(1)}%</span>;
                  })()}
                  <span className="text-muted-foreground">height</span>
                  <Input className="h-control-xs w-14" type="number" value={row.height ?? 0} onChange={(event) => editLayout(layout.id, (draft) => { draft.rows[rowIndex].height = Number(event.target.value); })} />
                  <Button size="sm" variant="ghost" className="h-control-xs px-1" onClick={() => moveRow(rowIndex, -1)} disabled={rowIndex === 0}><ArrowUp /></Button>
                  <Button size="sm" variant="ghost" className="h-control-xs px-1" onClick={() => moveRow(rowIndex, 1)} disabled={rowIndex === layout.rows.length - 1}><ArrowDown /></Button>
                  <Button size="sm" variant="ghost" className="h-control-xs px-1 text-3xs" onClick={() => fitRow(rowIndex)}>Fit 100%</Button>
                  <Button size="sm" variant="ghost" className="h-control-xs px-1 text-3xs" onClick={() => distributeRow(rowIndex)}>Distribute</Button>
                  <Button size="sm" variant="ghost" className="ml-auto h-control-xs px-1 text-destructive" onClick={() => deleteRow(rowIndex)}><Trash2 /></Button>
                </div>
              ))}
            </div>
          </section>

          {selectedPlaceholder ? (
            <div className="rounded-xl border border-border bg-card p-gutter text-2xs text-muted-foreground">
              占位符只占宽度，不能绑定行为。添加普通键后再配置 click / long_click 等。
            </div>
          ) : (
            <Selector libs={libs} pageTargets={group} targetBehavior={targetBehavior} setTargetBehavior={(value) => setTargetBehavior(value as Behavior)} onAssign={(action) => {
              if (!selected) return setMessage("先在右侧键盘编辑里选择一个键");
              setBehavior(targetBehavior, action);
            }} />
          )}
        </div>

        <section className="min-h-0 rounded-xl border border-border bg-card p-gutter">
          <Tabs value={rightTab} onValueChange={setRightTab}>
            <TabsList>
              <TabsTrigger value="page">布局</TabsTrigger>
              <TabsTrigger value="key">键</TabsTrigger>
              <TabsTrigger value="behavior">行为</TabsTrigger>
              <TabsTrigger value="style">样式</TabsTrigger>
            </TabsList>

            <div className="mt-2 max-h-[calc(100vh-13rem)] overflow-auto pr-1">
              <TabsContent value="page" className="mt-0 space-y-2">
                <Field label="Layout name"><Input value={layout.name} onChange={(event) => editLayout(layout.id, (draft) => { draft.name = event.target.value; })} /></Field>
                <Field label="Role">
                  <Select value={layout.role ?? "letters"} onChange={(event) => editLayout(layout.id, (draft) => { draft.role = event.target.value as LayoutPreset["role"]; })}>
                    <option value="letters">letters</option>
                    <option value="number">number</option>
                    <option value="symbols">symbols</option>
                  </Select>
                </Field>
                <p className="text-2xs text-muted-foreground">
                  布局组由默认布局 + 其他布局组成；编译时每个布局成为一个 preset_keyboard。Role 只是分类提示，不决定默认布局。
                </p>
                <div className="rounded border border-border bg-muted/20 p-2 text-2xs text-muted-foreground">
                  <div>id: <code>{layout.id}</code></div>
                  <div>default: {isDefault ? "yes" : "no"} · rows: {layout.rows.length} · keys: {keyCount} · gaps: {gapCount}</div>
                </div>
              </TabsContent>

              <TabsContent value="key" className="mt-0 space-y-2">
                {selectedKey && selected ? (
                  selectedPlaceholder ? (
                    <>
                      <div className="flex items-center gap-stack">
                        <Badge variant="muted">placeholder</Badge>
                        <span className="text-2xs text-muted-foreground">只占宽度，不渲染按键</span>
                      </div>
                      <Field label="Width %"><Input type="number" value={selectedKey.width} onChange={(event) => updateKey((key) => { key.width = Number(event.target.value); })} /></Field>
                      <p className="text-3xs text-muted-foreground">占位符不能设置 label、行为、样式或颜色；如果需要一个可点击的空白键，请添加普通键并选用 off 样式。</p>
                      {positionActions}
                    </>
                  ) : (
                  <>
                    <Field label="Label"><Input value={selectedKey.label ?? ""} onChange={(event) => updateKey((key) => { key.label = event.target.value; })} /></Field>
                    <div className="grid grid-cols-2 gap-stack">
                      <Field label="Label symbol"><Input value={selectedKey.label_symbol ?? ""} onChange={(event) => updateKey((key) => { key.label_symbol = event.target.value; })} /></Field>
                      <Field label="Hint"><Input value={selectedKey.hint ?? ""} onChange={(event) => updateKey((key) => { key.hint = event.target.value; })} /></Field>
                    </div>
                    <div className="grid grid-cols-2 gap-stack">
                      <Field label="Style type">
                        <Select value={selectedKey.style ?? ""} onChange={(event) => updateKey((key) => { key.style = event.target.value; })}>
                          {Object.keys(project.keyStyles).map((id) => <option key={id} value={id}>{id}</option>)}
                        </Select>
                      </Field>
                      <Field label="Click action">
                        <div className="whitespace-normal break-words rounded border border-border bg-muted/20 px-2 py-1.5 text-2xs" title={actionLabel(selectedKey.click, libs)}>{actionLabel(selectedKey.click, libs)}</div>
                      </Field>
                    </div>
                    <div className="grid grid-cols-2 gap-stack">
                      <Field label="Width %"><Input type="number" value={selectedKey.width} onChange={(event) => updateKey((key) => { key.width = Number(event.target.value); })} /></Field>
                      <Field label="Height px"><Input type="number" value={selectedKey.height ?? 0} onChange={(event) => updateKey((key) => { key.height = Number(event.target.value); })} /></Field>
                    </div>

                    <details className="rounded border border-border bg-muted/10 p-2">
                      <summary className="cursor-pointer text-2xs font-medium">Key color overrides{colorOverrideCount > 0 ? ` · ${colorOverrideCount}` : ""}</summary>
                      <p className="mt-1 text-3xs text-muted-foreground">来自导入的键级颜色覆盖，优先级高于 style type；留空则继承 style。</p>
                      <div className="mt-2 grid grid-cols-2 gap-stack">
                        {KEY_COLOR_FIELDS.map(([field, label]) => (
                          <Field key={field} label={label}>
                            <div className="flex gap-1">
                              <Input
                                className="h-control-sm"
                                value={selectedKey[field] ?? ""}
                                placeholder="inherit"
                                onChange={(event) => updateKey((key) => {
                                  const value = event.target.value;
                                  if (value) key[field] = value;
                                  else delete key[field];
                                })}
                              />
                              {selectedKey[field] ? (
                                <Button size="sm" variant="ghost" className="h-control-sm px-1 text-destructive" onClick={() => updateKey((key) => { delete key[field]; })}>×</Button>
                              ) : null}
                            </div>
                          </Field>
                        ))}
                      </div>
                    </details>

                    <div className="space-y-1">
                      <Label>Popup items</Label>
                      <p className="text-3xs text-muted-foreground">每项是上屏文本；支持增删、排序。popup 非空时 long_click 不会触发。</p>
                      {selectedKey.popup?.length ? (
                        <div className="space-y-1">
                          {selectedKey.popup.map((item, index, items) => (
                            <div key={`${item}-${index}`} className="flex items-center gap-1">
                              <Input value={item} onChange={(event) => updateKey((key) => { key.popup = (key.popup ?? []).map((value, i) => (i === index ? event.target.value : value)); })} />
                              <Button size="sm" variant="ghost" className="h-control-sm px-1" disabled={index === 0} onClick={() => updateKey((key) => {
                                const next = [...(key.popup ?? [])];
                                [next[index - 1], next[index]] = [next[index], next[index - 1]];
                                key.popup = next;
                              })}><ArrowUp /></Button>
                              <Button size="sm" variant="ghost" className="h-control-sm px-1" disabled={index === items.length - 1} onClick={() => updateKey((key) => {
                                const next = [...(key.popup ?? [])];
                                [next[index + 1], next[index]] = [next[index], next[index + 1]];
                                key.popup = next;
                              })}><ArrowDown /></Button>
                              <Button size="sm" variant="ghost" className="h-control-sm px-1 text-destructive" onClick={() => updateKey((key) => { key.popup = (key.popup ?? []).filter((_, i) => i !== index); })}>×</Button>
                            </div>
                          ))}
                        </div>
                      ) : <p className="text-2xs text-muted-foreground">没有 popup。</p>}
                      <div className="flex gap-1">
                        <Input value={newPopup} placeholder="新增 popup 文本（可粘贴多项）" onChange={(event) => setNewPopup(event.target.value)} onKeyDown={(event) => {
                          if (event.key !== "Enter" || !newPopup) return;
                          updateKey((key) => { key.popup = [...(key.popup ?? []), newPopup]; });
                          setNewPopup("");
                        }} />
                        <Button size="sm" variant="outline" className="h-control" disabled={!newPopup} onClick={() => {
                          updateKey((key) => { key.popup = [...(key.popup ?? []), newPopup]; });
                          setNewPopup("");
                        }}>+ Add</Button>
                      </div>
                      <Button size="sm" variant="outline" className="h-control-sm w-full" onClick={() => {
                        const items = newPopup.split(/[\n,，、\s]+/).filter(Boolean);
                        if (!items.length) return;
                        updateKey((key) => { key.popup = [...(key.popup ?? []), ...items]; });
                        setNewPopup("");
                      }}>Bulk add pasted text</Button>
                    </div>

                    {positionActions}
                  </>
                  )
                ) : <p className="text-xs text-muted-foreground">在预览或行编辑器中点击一个键。</p>}
              </TabsContent>

              <TabsContent value="behavior" className="mt-0 space-y-2">
                {selectedKey ? (
                  selectedPlaceholder ? (
                    <p className="text-xs text-muted-foreground">占位符没有行为；Trime 不会为它创建按键，只保留宽度。</p>
                  ) : (
                  <>
                    <p className="text-2xs text-muted-foreground">目标行为：<Badge variant="success">{targetBehavior}</Badge>，点下方行切换目标；用 Insert action 写入。</p>
                    {BEHAVIORS.map(([behavior, label]) => (
                      <div key={behavior} className={`rounded border p-2 ${targetBehavior === behavior ? "border-primary bg-primary/5" : "border-border"}`}>
                        <button type="button" className="mb-1 flex w-full items-center justify-between text-2xs" onClick={() => setTargetBehavior(behavior)}>
                          <span>{label}</span>
                          <span className="whitespace-normal break-words text-right text-muted-foreground" title={actionLabel(targetOf(selectedKey, behavior), libs)}>{actionLabel(targetOf(selectedKey, behavior), libs)}</span>
                        </button>
                        <ActionField action={targetOf(selectedKey, behavior)} libs={libs} onChange={(action) => setBehavior(behavior, action)} />
                      </div>
                    ))}
                  </>
                  )
                ) : <p className="text-xs text-muted-foreground">先选择一个键。</p>}
              </TabsContent>

              <TabsContent value="style" className="mt-0 space-y-2">
                <p className="text-2xs text-muted-foreground">键位默认引用 style type；导入的键级颜色覆盖会保留并优先输出，可在 Key 页查看或清除。</p>
                {Object.values(project.keyStyles).map((style) => (
                  <div key={style.id} className="flex items-center gap-stack rounded border border-border bg-muted/20 px-2 py-1 text-2xs">
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

function pageActionCount(project: ProjectBundle, layoutId: string): number {
  let count = 0;
  for (const layout of project.layouts) {
    for (const row of layout.rows) {
      for (const key of row.keys) {
        for (const [behavior] of BEHAVIORS) {
          const action = (key as unknown as Record<string, ActionRef | undefined>)[behavior];
          if (action?.kind === "page" && action.id === layoutId) count += 1;
        }
      }
    }
  }
  return count;
}

function clearPageActions(draft: ProjectBundle, layoutId: string): void {
  for (const layout of draft.layouts) {
    for (const row of layout.rows) {
      for (const key of row.keys) {
        for (const [behavior] of BEHAVIORS) {
          const action = (key as unknown as Record<string, ActionRef | undefined>)[behavior];
          if (action?.kind === "page" && action.id === layoutId) {
            delete (key as unknown as Record<string, unknown>)[behavior];
          }
        }
      }
    }
  }
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1"><Label>{label}</Label>{children}</div>;
}
