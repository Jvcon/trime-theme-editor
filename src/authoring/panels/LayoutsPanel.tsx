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
import { actionLabel, addLandscapeVariant, cloneLayout, embedLayout, findLayout, fitLayoutRows, mainLayout, pages, pruneBundleLayouts, reflowLayoutRows, removeLandscapeVariant } from "../utils";

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
  const layout = findLayout(project, activeLayoutId, libs) ?? mainLayout(project, libs);
  const [targetBehavior, setTargetBehavior] = useState<Behavior>("click");
  const [newPopup, setNewPopup] = useState("");

  const selectedKey = selected ? layout.rows[selected.row]?.keys[selected.key] : undefined;
  const colorOverrideCount = KEY_COLOR_FIELDS.filter(([field]) => Boolean(selectedKey?.[field])).length;
  const main = mainLayout(project, libs);
  const allPages = pages(project, libs);
  const variantIds = new Set(
    project.layouts.map((item) => item.landscapeId).filter((value): value is string => Boolean(value)),
  );
  const availablePages = libs.layouts.filter((item) => item.id !== main.id && !variantIds.has(item.id) && !project.layouts.some((layout) => layout.id === item.id));
  const isVariantActive = variantIds.has(activeLayoutId);
  const activeBase = isVariantActive
    ? project.layouts.find((item) => item.landscapeId === activeLayoutId) ?? layout
    : layout;
  const landscapeVariant = activeBase?.landscapeId ? findLayout(project, activeBase.landscapeId, libs) : undefined;
  const baseLayoutOptions = libs.layouts.filter((item) => !variantIds.has(item.id) && item.pageRole === "main");
  const referencedElsewhere = new Set<string>([
    ...project.devices.map((device) => device.mainLayoutId).filter((value): value is string => Boolean(value)),
    ...project.schemaBindings.map((binding) => binding.layoutId),
  ]);
  const detached = project.layouts.filter((item) => (
    item.id !== main.id && !project.pageIds.includes(item.id) && !variantIds.has(item.id) && !referencedElsewhere.has(item.id)
  ));
  const usage = devicesUsingLayout(project, layout.id);

  useEffect(() => {
    onPreviewOrientation?.(isVariantActive ? "landscape" : "portrait");
  }, [isVariantActive, onPreviewOrientation]);

  const choose = (id: string) => {
    setActiveLayoutId(id);
    onSelectKey(undefined);
    onPopupKey(null);
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

  const selectMainLayout = (id: string) => {
    const next = libs.layouts.find((item) => item.id === id);
    if (!next) return;
    const previousMain = project.layouts.find((item) => item.id === project.mainLayoutId);
    mutate((draft) => {
      embedLayout(draft, next);
      draft.mainLayoutId = next.id;
      draft.pageIds = draft.pageIds.filter((pageId) => pageId !== next.id);
      pruneBundleLayouts(draft);
    });
    choose(id);
    setMessage(previousMain && !previousMain.builtin
      ? `已切换主布局；「${previousMain.name}」已保留，可在主布局下拉或「保留的布局」中切回`
      : `已切换主布局为 ${next.name}`);
  };

  const setDetachedAsMain = (id: string) => {
    const target = project.layouts.find((item) => item.id === id);
    if (!target) return;
    mutate((draft) => {
      draft.mainLayoutId = id;
      draft.pageIds = draft.pageIds.filter((pageId) => pageId !== id);
      pruneBundleLayouts(draft);
    });
    choose(id);
    setMessage(`已把「${target.name}」设为主布局`);
  };

  const deleteDetached = (id: string) => {
    const target = project.layouts.find((item) => item.id === id);
    if (!target) return;
    if (!window.confirm(`删除保留的布局「${target.name}」？`)) return;
    mutate((draft) => {
      draft.layouts = draft.layouts.filter((item) => item.id !== id && item.id !== target.landscapeId);
      for (const item of draft.layouts) {
        if (item.landscapeId === id) delete item.landscapeId;
      }
      pruneBundleLayouts(draft);
    });
    if (activeLayoutId === id) choose(project.mainLayoutId);
    setMessage("已删除保留的布局");
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

  const createLandscapeVariant = () => {
    const base = activeBase ?? layout;
    let createdId = "";
    mutate((draft) => {
      createdId = addLandscapeVariant(draft, base) ?? "";
    });
    if (createdId) choose(createdId);
    setMessage("已创建横屏变体（默认克隆竖屏结构，可再用「精简派生」去一行）");
  };

  const simplifyLandscapeVariant = () => {
    if (!isVariantActive) return;
    editLayout(layout.id, (draft) => {
      if (draft.rows.length > LAYOUT_RULES.simplifyAboveRows) draft.rows.splice(-1, 1);
      fitLayoutRows(draft);
    });
    setMessage("已去掉最后一行并校准行宽");
  };

  const deleteLandscapeVariant = () => {
    if (!isVariantActive) return;
    let ownerId = "";
    mutate((draft) => {
      ownerId = removeLandscapeVariant(draft, layout.id) ?? "";
    });
    if (ownerId) choose(ownerId);
    setMessage("已删除横屏变体；横屏设备会回退到竖屏结构");
  };

  const deleteLayout = () => {
    if (isVariantActive) {
      deleteLandscapeVariant();
      return;
    }
    if (layout.builtin) return setMessage("内置布局只读；请复制后再编辑");
    const variantId = layout.landscapeId;
    const affected = project.devices.filter((device) => device.mainLayoutId === layout.id).length;
    const confirmed = window.confirm(
      `删除「${layout.name}」${variantId ? "及其横屏变体" : ""}？${affected ? `\n${affected} 个设备将回退到项目主布局。` : ""}`,
    );
    if (!confirmed) return;
    const fallback = libs.layouts.find((item) => item.id === "qwerty26") ?? libs.layouts.find((item) => item.pageRole === "main");
    mutate((draft) => {
      draft.layouts = draft.layouts.filter((item) => item.id !== layout.id && item.id !== variantId);
      draft.pageIds = draft.pageIds.filter((id) => id !== layout.id && id !== variantId);
      for (const item of draft.layouts) {
        if (item.landscapeId === layout.id || item.landscapeId === variantId) delete item.landscapeId;
      }
      for (const device of draft.devices) {
        if (device.mainLayoutId === layout.id) delete device.mainLayoutId;
      }
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
    const variantId = project.layouts.find((item) => item.id === id)?.landscapeId;
    mutate((draft) => {
      draft.pageIds = draft.pageIds.filter((item) => item !== id);
      draft.layouts = draft.layouts.filter((item) => item.id !== id && item.id !== variantId);
      for (const item of draft.layouts) {
        if (item.landscapeId === id) delete item.landscapeId;
      }
      pruneBundleLayouts(draft);
    });
    if (activeLayoutId === id) choose(project.mainLayoutId);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">主布局</span>
        <Select className="h-7 w-40" value={main.id} onChange={(event) => selectMainLayout(event.target.value)}>
          {baseLayoutOptions.map((item) => <option key={item.id} value={item.id}>{item.name}{item.builtin ? "" : " · custom"}</option>)}
        </Select>
        <span className="ml-2 text-[10px] uppercase tracking-wider text-muted-foreground">正在编辑</span>
        {layout.pageRole === "main" ? (
          <>
            <div className="flex items-center gap-0.5 rounded-md border border-border bg-muted/20 p-0.5">
              <button
                type="button"
                className={`rounded px-2 py-0.5 text-[10px] ${!isVariantActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted/40"}`}
                onClick={() => choose(activeBase?.id ?? layout.id)}
              >竖屏</button>
              <button
                type="button"
                className={`rounded px-2 py-0.5 text-[10px] ${isVariantActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted/40"}`}
                onClick={() => (landscapeVariant ? choose(landscapeVariant.id) : createLandscapeVariant())}
              >{landscapeVariant ? "横屏" : "横屏 · 未创建"}</button>
            </div>
            {isVariantActive ? (
              <>
                <Button size="sm" variant="ghost" className="h-7 text-[10px]" onClick={simplifyLandscapeVariant}>精简派生</Button>
                <Button size="sm" variant="ghost" className="h-7 text-[10px] text-red-300" onClick={deleteLandscapeVariant}>删除变体</Button>
              </>
            ) : null}
          </>
        ) : (
          <span className="text-[10px] text-muted-foreground">页面不区分横竖屏</span>
        )}
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
          <Badge variant={isVariantActive ? "success" : "muted"}>
            {layout.pageRole !== "main" ? "页面" : isVariantActive ? "横屏变体" : landscapeVariant ? "含横屏变体" : "仅竖屏"}
          </Badge>
          <Badge variant="muted">{layout.rows.reduce((sum, row) => sum + row.keys.length, 0)} keys</Badge>
          <Badge variant="muted">{layout.rows.length} rows</Badge>
          {layout.builtin ? <Badge variant="muted">builtin</Badge> : <Badge variant="success">custom</Badge>}
          <Button size="sm" variant="outline" className="h-7" onClick={duplicateLayout}><Copy />Duplicate</Button>
          <Button size="sm" variant="outline" className="h-7 text-red-300" disabled={layout.builtin} onClick={deleteLayout}><Trash2 />Delete</Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-muted/20 px-4 py-1 text-[10px] text-muted-foreground">
        {layout.pageRole === "main" ? (
          <>
            <span className={usage.length ? "text-amber-300" : ""}>{impactLabel(usage)}</span>
            {isVariantActive
              ? <span>· 编辑横屏变体不会影响竖屏</span>
              : landscapeVariant
                ? <span>· 竖屏改动不会自动同步横屏变体</span>
                : <span>· 不创建横屏变体时，横屏设备沿用竖屏结构</span>}
          </>
        ) : (
          <span>页面：由运行时切换，不直接绑定设备</span>
        )}
      </div>

      {detached.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1 border-b border-border bg-muted/10 px-4 py-1 text-[10px]">
          <span className="text-muted-foreground" title="切换主布局不会删除你修改过的布局">保留的布局</span>
          {detached.map((item) => (
            <span key={item.id} className="inline-flex items-center gap-1 rounded border border-border px-1.5 py-0.5">
              <button
                type="button"
                className={activeLayoutId === item.id ? "text-primary" : ""}
                title="继续编辑"
                onClick={() => choose(item.id)}
              >{item.name}</button>
              <span className="text-[8px] text-muted-foreground">{item.pageRole}</span>
              <button
                type="button"
                className="text-[9px] text-muted-foreground hover:text-foreground"
                onClick={() => setDetachedAsMain(item.id)}
              >设为主布局</button>
              <button type="button" className="text-red-300" onClick={() => deleteDetached(item.id)}>×</button>
            </span>
          ))}
        </div>
      ) : null}

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-auto p-4 xl:grid-cols-[minmax(0,3fr)_minmax(340px,2fr)]">
        <div className="flex min-h-0 flex-col gap-3">
          <div className="hidden rounded-lg border border-border bg-muted/10 px-3 py-2 text-[10px] text-muted-foreground lg:block">
            键盘在右侧「键盘编辑」中：点击选键、拖拽移动、长按 popup。小屏时这里会内嵌同一编辑器。
          </div>

          <section className="rounded-xl border border-border bg-card p-3 lg:hidden">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-xs font-medium">键盘编辑</span>
              <Badge variant="muted">{layout.name}</Badge>
              <span className="ml-auto text-[9px] text-muted-foreground">点击选键 · 拖拽移动 · 长按 popup</span>
            </div>
            <KeyboardPreview
              project={project}
              libs={libs}
              layout={layout}
              metrics={project.metrics ?? {}}
              orientation={isVariantActive ? "landscape" : "portrait"}
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
                    return <span className={`w-14 ${Math.abs(sum - 100) > LAYOUT_RULES.rowWidthTolerance ? "text-amber-300" : "text-muted-foreground"}`} title="该行宽度合计">{sum.toFixed(1)}%</span>;
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
            if (!selected) return setMessage("先在右侧键盘编辑里选择一个键");
            setBehavior(targetBehavior, action);
          }} />
        </div>

        <section className="min-h-0 rounded-xl border border-border bg-card p-3">
          <Tabs value={rightTab} onValueChange={setRightTab}>
            <TabsList>
              <TabsTrigger value="page">页面</TabsTrigger>
              <TabsTrigger value="key">键</TabsTrigger>
              <TabsTrigger value="behavior">行为</TabsTrigger>
              <TabsTrigger value="style">样式</TabsTrigger>
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

                    <details className="rounded border border-border bg-muted/10 p-2">
                      <summary className="cursor-pointer text-[10px] font-medium">Key color overrides{colorOverrideCount > 0 ? ` · ${colorOverrideCount}` : ""}</summary>
                      <p className="mt-1 text-[9px] text-muted-foreground">来自导入的键级颜色覆盖，优先级高于 style type；留空则继承 style。</p>
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        {KEY_COLOR_FIELDS.map(([field, label]) => (
                          <Field key={field} label={label}>
                            <div className="flex gap-1">
                              <Input
                                className="h-7"
                                value={selectedKey[field] ?? ""}
                                placeholder="inherit"
                                onChange={(event) => updateKey((key) => {
                                  const value = event.target.value;
                                  if (value) key[field] = value;
                                  else delete key[field];
                                })}
                              />
                              {selectedKey[field] ? (
                                <Button size="sm" variant="ghost" className="h-7 px-1 text-red-300" onClick={() => updateKey((key) => { delete key[field]; })}>×</Button>
                              ) : null}
                            </div>
                          </Field>
                        ))}
                      </div>
                    </details>

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
                <p className="text-[10px] text-muted-foreground">键位默认引用 style type；导入的键级颜色覆盖会保留并优先输出，可在 Key 页查看或清除。</p>
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1"><Label>{label}</Label>{children}</div>;
}
