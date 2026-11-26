import { useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { Copy, Pencil, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { KeyStyle, PresetLibraries, ProjectBundle, ThemeCardPreset, Variant } from "../types";
import { cloneThemeCard, defaultThemeSelection, newThemeCard, tokenValue } from "../utils";

type Props = {
  project: ProjectBundle;
  libs: PresetLibraries;
  mutate: (fn: (draft: ProjectBundle) => void) => void;
  setMessage: (message: string) => void;
};

const STYLE_FIELDS = ["background", "text", "symbol", "border"] as const;
type StyleField = (typeof STYLE_FIELDS)[number];
type StyleState = "base" | "pressed";
const STATE_LABELS: Record<StyleState, string> = { base: "常态", pressed: "按下" };
const FAMILY_ORDER = ["Dracula", "Catppuccin", "Solarized", "Material", "Nord"];
const CUSTOM_GROUP = "自定义";
const METRIC_FIELDS = [
  ["keyWidth", "Key width"],
  ["keyHeight", "Key height"],
  ["keyboardHeight", "Keyboard height"],
  ["horizontalGap", "Horizontal gap"],
  ["verticalGap", "Vertical gap"],
  ["candidateViewHeight", "Candidate height"],
  ["candidateTextSize", "Candidate text"],
  ["commentTextSize", "Comment text"],
  ["keyTextSize", "Key text"],
  ["popupWidth", "Popup width"],
  ["popupHeight", "Popup height"],
  ["popupKeyHeight", "Popup key height"],
  ["popupTextSize", "Popup text size"],
  ["popupBottomMargin", "Popup bottom margin"],
] as const;

const BUILTIN_STYLES = new Set(["default", "modifier", "enter", "space", "off"]);

function groupedCards(cards: ThemeCardPreset[]): Array<{ label: string; cards: ThemeCardPreset[] }> {
  const groups = new Map<string, ThemeCardPreset[]>();
  for (const card of cards) {
    const label = card.builtin ? (card.family ?? "其他") : CUSTOM_GROUP;
    const list = groups.get(label) ?? [];
    list.push(card);
    groups.set(label, list);
  }
  return [...groups.entries()]
    .sort(([left], [right]) => {
      const leftIndex = FAMILY_ORDER.indexOf(left);
      const rightIndex = FAMILY_ORDER.indexOf(right);
      if (leftIndex !== -1 || rightIndex !== -1) {
        return (leftIndex === -1 ? 999 : leftIndex) - (rightIndex === -1 ? 999 : rightIndex);
      }
      return left.localeCompare(right);
    })
    .map(([label, items]) => ({ label, cards: items }));
}

function optionLabel(card: ThemeCardPreset): string {
  return card.builtin ? card.name : `${card.name} · 自定义`;
}

function baseTokenOf(style: KeyStyle, field: StyleField): string {
  if (field === "symbol") return style.symbol ?? style.text;
  if (field === "border") return style.border ?? style.background;
  return style[field];
}

function resolveColorRef(card: ThemeCardPreset, value: string | undefined): string {
  if (!value) return "transparent";
  if (value.startsWith("#") || value.startsWith("0x")) return value;
  return tokenValue(card, value);
}

/** Mirrors the compiler: explicit pressed value → card pressed palette → base style. */
function styleColor(card: ThemeCardPreset, style: KeyStyle, state: StyleState, field: StyleField): string {
  const explicit = state === "pressed" ? style.pressed?.[field] : undefined;
  if (explicit) return resolveColorRef(card, explicit);
  if (state === "pressed" && field === "background" && card.states.pressed?.surface) {
    return resolveColorRef(card, card.states.pressed.surface);
  }
  if (state === "pressed" && field === "text" && card.states.pressed?.text) {
    return resolveColorRef(card, card.states.pressed.text);
  }
  return resolveColorRef(card, baseTokenOf(style, field));
}

function StylePreview({ card, style }: { card: ThemeCardPreset; style: KeyStyle }) {
  return (
    <span className="flex items-center gap-1" aria-hidden>
      {(["base", "pressed"] as const).map((state) => (
        <span
          key={state}
          title={STATE_LABELS[state]}
          className="flex h-4 w-7 items-center justify-center rounded border text-4xs leading-none"
          style={{
            background: styleColor(card, style, state, "background"),
            color: styleColor(card, style, state, "text"),
            borderColor: styleColor(card, style, state, "border"),
          }}
        >
          Aa
        </span>
      ))}
    </span>
  );
}

type StyleFieldsEditorProps = {
  card: ThemeCardPreset;
  style: KeyStyle;
  state: StyleState;
  tokenOptions: string[];
  onChange: (field: StyleField, token: string) => void;
};

function StyleFieldsEditor({ card, style, state, tokenOptions, onChange }: StyleFieldsEditorProps) {
  return (
    <div>
      <div className="mb-1 flex flex-wrap items-center gap-1 text-3xs font-medium text-muted-foreground">
        <span>{STATE_LABELS[state]}</span>
        {state === "pressed" ? <span className="text-4xs">留空则继承色卡 pressed，再回落到常态</span> : null}
      </div>
      <div className="grid grid-cols-2 gap-1">
        {STYLE_FIELDS.map((field) => {
          const token = state === "base" ? style[field] : style.pressed?.[field] ?? "";
          return (
            <label key={field} className="flex items-center gap-1 text-3xs text-muted-foreground">
              <span className="w-14">{field}</span>
              <Select className="h-control-xs" value={token ?? ""} onChange={(event) => onChange(field, event.target.value)}>
                <option value="">—</option>
                {tokenOptions.map((option) => {
                  const [group, key] = option.includes(".") ? option.split(".", 2) : ["tokens", option];
                  const value = group === "tokens" ? card.tokens[key] : card.states[group]?.[key] ?? "";
                  return <option key={option} value={option}>{option}{value ? ` · ${value}` : ""}</option>;
                })}
              </Select>
              <span className="h-3 w-3 shrink-0 rounded border border-border" style={{ background: tokenValue(card, token ?? "") }} />
            </label>
          );
        })}
      </div>
    </div>
  );
}

export function ThemesPanel({ project, libs, mutate, setMessage }: Props) {
  const card = project.theme[project.variant];
  const rawSchemes = project.passthrough?.preset_color_schemes;
  const extraSchemeCount = rawSchemes && typeof rawSchemes === "object" && !Array.isArray(rawSchemes)
    ? Object.keys(rawSchemes as Record<string, unknown>).filter((name) => name !== "light" && name !== "dark").length
    : 0;
  const [editingStyle, setEditingStyle] = useState<string | null>(null);
  const [split, setSplit] = useState(30);
  const splitGridRef = useRef<HTMLDivElement>(null);

  const groups = useMemo(() => groupedCards(libs.themeCards), [libs.themeCards]);

  const tokenOptions = useMemo(() => {
    const tokens = Object.keys(card.tokens);
    const pressed = Object.keys(card.states.pressed ?? {}).map((token) => `pressed.${token}`);
    return [...tokens, ...pressed];
  }, [card]);

  const selectCard = (variant: Variant, id: string) => {
    const source = libs.themeCards.find((item) => item.id === id);
    if (!source) return;
    mutate((draft) => {
      const next = structuredClone(source);
      const other = variant === "light" ? "dark" : "light";
      // Two slots must not share one id; a second use becomes its own copy.
      if (!next.builtin && draft.theme[other].id === next.id) {
        next.id = `${next.id}-${Date.now()}`;
        next.name = `${next.name} 副本`;
      }
      if (!next.builtin) {
        const library = draft.customThemeCards ?? [];
        if (!library.some((item) => item.id === next.id)) {
          draft.customThemeCards = [...library, structuredClone(next)];
        } else {
          draft.customThemeCards = library;
        }
      }
      draft.theme[variant] = next;
    });
  };

  const duplicateCard = () => {
    const clone = cloneThemeCard(card, `${card.name} 副本`);
    mutate((draft) => {
      draft.customThemeCards = [...(draft.customThemeCards ?? []), structuredClone(clone)];
      draft.theme[draft.variant] = clone;
    });
    setMessage(`已复制色卡：${clone.name}`);
  };

  const createCard = () => {
    const created = newThemeCard("新色卡", card);
    mutate((draft) => {
      draft.customThemeCards = [...(draft.customThemeCards ?? []), structuredClone(created)];
      draft.theme[draft.variant] = created;
    });
    setMessage("已新建色卡");
  };

  const deleteCard = () => {
    if (card.builtin) return;
    mutate((draft) => {
      const fallback = defaultThemeSelection()[draft.variant];
      draft.customThemeCards = (draft.customThemeCards ?? []).filter((item) => item.id !== card.id);
      for (const variant of ["light", "dark"] as const) {
        if (draft.theme[variant].id === card.id) draft.theme[variant] = structuredClone(fallback);
      }
    });
    setMessage("已删除色卡");
  };

  /**
   * Editing a built-in card first creates a custom copy. The copy becomes the
   * selected scheme for this direction and is kept in the project library.
   */
  const editCard = (fn: (target: ThemeCardPreset, draft: ProjectBundle) => void) => {
    mutate((draft) => {
      let target = draft.theme[draft.variant];
      if (target.builtin) {
        target = cloneThemeCard(target, target.name);
        draft.theme[draft.variant] = target;
      }
      fn(target, draft);
      if (!target.builtin) {
        const library = [...(draft.customThemeCards ?? [])];
        const index = library.findIndex((item) => item.id === target.id);
        const snapshot = structuredClone(target);
        if (index >= 0) library[index] = snapshot;
        else library.push(snapshot);
        draft.customThemeCards = library;
      }
    });
  };

  const addStyle = () => {
    mutate((draft) => {
      let index = 1;
      let id = `custom-${index}`;
      while (draft.keyStyles[id]) {
        index += 1;
        id = `custom-${index}`;
      }
      const base = draft.keyStyles.default;
      draft.keyStyles[id] = { ...structuredClone(base), id, name: `Custom ${index}` };
    });
  };

  const deleteStyle = (id: string) => {
    if (BUILTIN_STYLES.has(id)) return setMessage("内置 style type 不能删除");
    if (editingStyle === id) setEditingStyle(null);
    mutate((draft) => {
      delete draft.keyStyles[id];
      for (const layout of draft.layouts) {
        for (const row of layout.rows) for (const key of row.keys) if (key.style === id) key.style = "default";
      }
    });
  };

  const duplicateStyle = (id: string) => {
    mutate((draft) => {
      let index = 1;
      let next = `${id}-copy`;
      while (draft.keyStyles[next]) {
        index += 1;
        next = `${id}-copy-${index}`;
      }
      draft.keyStyles[next] = { ...structuredClone(draft.keyStyles[id]), id: next, name: `${draft.keyStyles[id].name} copy` };
    });
  };

  const setStyleToken = (styleId: string, state: StyleState, field: StyleField, token: string) => {
    mutate((draft) => {
      const current = draft.keyStyles[styleId];
      if (!current) return;
      if (state === "base") {
        draft.keyStyles[styleId] = { ...current, [field]: token };
        return;
      }
      const pressed = { ...(current.pressed ?? {}) };
      if (token) pressed[field] = token;
      else delete pressed[field];
      draft.keyStyles[styleId] = { ...current, pressed };
    });
  };

  const startSplitDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const container = splitGridRef.current;
    if (!container) return;
    event.preventDefault();
    const rect = container.getBoundingClientRect();
    const move = (moveEvent: PointerEvent) => {
      const percent = ((moveEvent.clientX - rect.left) / rect.width) * 100;
      setSplit(Math.min(48, Math.max(24, percent)));
    };
    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
  };

  return (
    <div className="h-full overflow-auto p-section">
      <details className="mb-3 rounded-xl border border-border bg-card p-gutter" open>
        <summary className="cursor-pointer text-xs font-semibold">项目信息</summary>
        <div className="mt-2 grid grid-cols-1 gap-stack md:grid-cols-4">
          <Field label="名称"><Input value={project.meta.name} onChange={(event) => mutate((draft) => { draft.meta.name = event.target.value; })} /></Field>
          <Field label="作者"><Input value={project.meta.author} onChange={(event) => mutate((draft) => { draft.meta.author = event.target.value; })} /></Field>
          <Field label="描述"><Input value={project.meta.description ?? ""} onChange={(event) => mutate((draft) => { draft.meta.description = event.target.value; })} /></Field>
          <Field label="Config version"><Input value={project.meta.configVersion} onChange={(event) => mutate((draft) => { draft.meta.configVersion = event.target.value; })} /></Field>
        </div>
        <p className="mt-1 text-3xs text-muted-foreground">名称与作者会写入 trime.yaml；config version 对应 <code>config_version</code>。</p>
      </details>

      <div className="mb-4 space-y-2">
        <div className="flex flex-wrap items-center gap-stack">
          <span className="text-sm font-semibold">色卡</span>
          <span className="text-3xs text-muted-foreground">浅色与深色分别选择，影响所有设备</span>
          {extraSchemeCount > 0 ? <Badge variant="muted" title="这些原始 scheme 通过 passthrough 保留，不在这里编辑">{extraSchemeCount} extra schemes preserved</Badge> : null}
        </div>

        <div className="grid grid-cols-1 gap-stack md:grid-cols-2">
          <Field label="浅色方案">
            <Select value={project.theme.light.id} onChange={(event) => selectCard("light", event.target.value)}>
              {groups.map((group) => (
                <optgroup key={group.label} label={group.label}>
                  {group.cards.map((item) => <option key={item.id} value={item.id}>{optionLabel(item)}</option>)}
                </optgroup>
              ))}
            </Select>
          </Field>
          <Field label="深色方案">
            <Select value={project.theme.dark.id} onChange={(event) => selectCard("dark", event.target.value)}>
              {groups.map((group) => (
                <optgroup key={group.label} label={group.label}>
                  {group.cards.map((item) => <option key={item.id} value={item.id}>{optionLabel(item)}</option>)}
                </optgroup>
              ))}
            </Select>
          </Field>
        </div>

        <div className="flex flex-wrap items-center gap-stack">
          <span className="text-2xs text-muted-foreground">编辑</span>
          {card.builtin ? (
            <span className="text-xs font-semibold">{card.name}</span>
          ) : (
            <>
              <Badge variant="success">自定义</Badge>
              <Input className="h-control-sm w-44" value={card.name} onChange={(event) => editCard((target) => { target.name = event.target.value; })} />
            </>
          )}
          <div className="ml-auto flex gap-1">
            <Button size="sm" variant="outline" onClick={duplicateCard}><Copy />复制</Button>
            <Button size="sm" variant="outline" onClick={createCard}><Plus />新建</Button>
            {card.builtin ? null : <Button size="sm" variant="outline" className="text-destructive" onClick={deleteCard}><Trash2 />删除</Button>}
          </div>
        </div>
      </div>

      {card.builtin ? (
        <div className="mb-3 rounded-lg border border-border bg-muted/10 px-3 py-2 text-2xs text-muted-foreground">
          修改任意颜色时会自动复制为自定义方案，原方案保持不变。
        </div>
      ) : null}

      <Tabs
        value={project.variant}
        onValueChange={(value) => {
          if (value === "light" || value === "dark") mutate((draft) => { draft.variant = value; });
        }}
      >
        <div className="mb-3 flex flex-wrap items-center gap-stack">
          <TabsList>
            <TabsTrigger value="light" className="max-w-[220px] truncate" title={project.theme.light.name}>浅色 · {project.theme.light.name}</TabsTrigger>
            <TabsTrigger value="dark" className="max-w-[220px] truncate" title={project.theme.dark.name}>深色 · {project.theme.dark.name}</TabsTrigger>
          </TabsList>
          <span className="text-3xs text-muted-foreground">切换后同步右侧预览</span>
        </div>

        <TabsContent value={project.variant}>
          <div
            ref={splitGridRef}
            className="theme-split-grid grid gap-4"
            style={{ "--theme-split": `${split}%` } as CSSProperties}
          >
            <section className="rounded-xl border border-border bg-card p-panel">
              <h3 className="mb-2 text-xs font-semibold">色值 · {project.variant === "light" ? "浅色" : "深色"} · {card.name}</h3>
              <div className="space-y-1">
                {Object.entries(card.tokens).map(([token, value]) => (
                  <div key={token} className="flex items-center gap-stack">
                    <span className="w-24 shrink-0 text-2xs text-muted-foreground">{token}</span>
                    <input type="color" className="h-control-xs w-8 cursor-pointer rounded border border-border bg-transparent" value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : "#000000"} onChange={(event) => editCard((target) => { target.tokens[token] = event.target.value; })} />
                    <Input className="h-control-sm" value={value} onChange={(event) => editCard((target) => { target.tokens[token] = event.target.value; })} />
                  </div>
                ))}
              </div>
            </section>

            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="调整色值栏宽度"
              aria-valuemin={24}
              aria-valuemax={48}
              aria-valuenow={Math.round(split)}
              title="拖动调整色值栏宽度，双击恢复 30%"
              onPointerDown={startSplitDrag}
              onDoubleClick={() => setSplit(30)}
              onKeyDown={(event) => {
                if (event.key === "ArrowLeft") setSplit((value) => Math.max(24, value - 2));
                if (event.key === "ArrowRight") setSplit((value) => Math.min(48, value + 2));
              }}
              tabIndex={0}
              className="hidden cursor-col-resize touch-none select-none items-center justify-center rounded border border-border bg-muted/40 transition-colors hover:bg-accent xl:flex"
            >
              <span className="h-control w-1 rounded-full bg-muted-foreground/40" />
            </div>

        <div className="min-w-0 space-y-4">
          <section className="rounded-xl border border-border bg-card p-panel">
            <div className="mb-2 flex items-center gap-stack">
              <h3 className="text-xs font-semibold">键样式</h3>
              <span className="text-3xs text-muted-foreground">收起仅引用，点编辑才修改</span>
              <Button size="sm" variant="outline" className="ml-auto h-control-sm" onClick={addStyle}><Plus />新建样式</Button>
            </div>
            <p className="mb-2 text-3xs text-muted-foreground">
              default → key_*，off → off_key_*（关闭/禁用键），on → on_key_*；modifier / enter / space /
              自定义只写 preset_keyboards 的单键颜色。按下色写入 hilited_*。
            </p>
            <div className="space-y-2">
              {Object.values(project.keyStyles).map((style) => {
                const editing = editingStyle === style.id;
                return (
                  <div key={style.id} className="rounded border border-border bg-muted/10">
                    <div className="flex flex-wrap items-center gap-1 px-2 py-1.5">
                      <Badge variant="muted">{style.id}</Badge>
                      <span className="truncate text-2xs text-muted-foreground" title={style.name}>{style.name}</span>
                      {style.id === "off" ? <span className="text-4xs text-muted-foreground">关闭/禁用</span> : null}
                      <span className="ml-auto flex items-center gap-stack">
                        <StylePreview card={card} style={style} />
                        <Button size="sm" variant={editing ? "default" : "outline"} className="h-control-xs" onClick={() => setEditingStyle(editing ? null : style.id)}>
                          <Pencil />{editing ? "收起" : "编辑"}
                        </Button>
                        <Button size="sm" variant="ghost" className="h-control-xs px-1" onClick={() => duplicateStyle(style.id)}><Copy /></Button>
                        <Button size="sm" variant="ghost" className="h-control-xs px-1 text-destructive" disabled={BUILTIN_STYLES.has(style.id)} onClick={() => deleteStyle(style.id)}><Trash2 /></Button>
                      </span>
                    </div>
                    {editing ? (
                      <div className="space-y-2 border-t border-border px-2 py-2">
                        <label className="flex items-center gap-2 text-3xs text-muted-foreground">
                          <span>名称</span>
                          <Input className="h-control-xs w-40" value={style.name} onChange={(event) => mutate((draft) => { draft.keyStyles[style.id] = { ...draft.keyStyles[style.id], name: event.target.value }; })} />
                        </label>
                        {(["base", "pressed"] as const).map((state) => (
                          <StyleFieldsEditor
                            key={state}
                            card={card}
                            style={style}
                            state={state}
                            tokenOptions={tokenOptions}
                            onChange={(field, token) => setStyleToken(style.id, state, field, token)}
                          />
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card p-panel">
            <h3 className="mb-2 text-xs font-semibold">尺寸与 popup</h3>
            <div className="grid grid-cols-2 gap-stack">
              {METRIC_FIELDS.map(([field, label]) => (
                <Field key={field} label={label}>
                  <Input
                    className="h-control-sm"
                    type="number"
                    value={project.metrics?.[field] ?? ""}
                    placeholder={String(defaultMetric(field))}
                    onChange={(event) => mutate((draft) => {
                      draft.metrics = { ...(draft.metrics ?? {}) };
                      if (event.target.value === "") delete draft.metrics[field];
                      else draft.metrics[field] = Number(event.target.value);
                    })}
                  />
                </Field>
              ))}
            </div>
            <p className="mt-2 text-3xs text-muted-foreground">popup 尺寸/颜色会写入 style 与 color scheme；popup 文本颜色来自主题色卡。</p>
          </section>
        </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function defaultMetric(field: (typeof METRIC_FIELDS)[number][0]): number {
  const values: Record<string, number> = {
    keyWidth: 10, keyHeight: 52, keyboardHeight: 270, horizontalGap: 2, verticalGap: 3,
    candidateViewHeight: 44, candidateTextSize: 18, commentTextSize: 12, keyTextSize: 22,
    popupWidth: 44, popupHeight: 56, popupKeyHeight: 48, popupTextSize: 22, popupBottomMargin: 8,
  };
  return values[field] ?? 0;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1"><Label>{label}</Label>{children}</div>;
}
