import { useMemo, useState } from "react";
import { Copy, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { PresetLibraries, ProjectBundle, ThemeCardPreset, Variant } from "../types";
import { cloneThemeCard, defaultThemeSelection, newThemeCard, tokenValue } from "../utils";

type Props = {
  project: ProjectBundle;
  libs: PresetLibraries;
  mutate: (fn: (draft: ProjectBundle) => void) => void;
  setMessage: (message: string) => void;
};

const STYLE_FIELDS = ["background", "text", "symbol", "border"] as const;
const STATE_FIELDS = ["hover", "pressed", "disabled"] as const;
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

export function ThemesPanel({ project, libs, mutate, setMessage }: Props) {
  const card = project.theme[project.variant];
  const rawSchemes = project.passthrough?.preset_color_schemes;
  const extraSchemeCount = rawSchemes && typeof rawSchemes === "object" && !Array.isArray(rawSchemes)
    ? Object.keys(rawSchemes as Record<string, unknown>).filter((name) => name !== "light" && name !== "dark").length
    : 0;
  const [stateField, setStateField] = useState<(typeof STATE_FIELDS)[number]>("pressed");
  const [overrideToken, setOverrideToken] = useState("surface");
  const [overrideValue, setOverrideValue] = useState("#ffffff");

  const groups = useMemo(() => groupedCards(libs.themeCards), [libs.themeCards]);

  const tokenOptions = useMemo(() => {
    const tokens = Object.keys(card.tokens);
    const states = STATE_FIELDS.flatMap((state) => Object.keys(card.states[state] ?? {}).map((token) => `${state}.${token}`));
    return [...tokens, ...states];
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
      draft.variant = variant;
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

  return (
    <div className="h-full overflow-auto p-5">
      <details className="mb-3 rounded-xl border border-border bg-card p-3" open>
        <summary className="cursor-pointer text-xs font-semibold">项目信息</summary>
        <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-4">
          <Field label="名称"><Input value={project.meta.name} onChange={(event) => mutate((draft) => { draft.meta.name = event.target.value; })} /></Field>
          <Field label="作者"><Input value={project.meta.author} onChange={(event) => mutate((draft) => { draft.meta.author = event.target.value; })} /></Field>
          <Field label="描述"><Input value={project.meta.description ?? ""} onChange={(event) => mutate((draft) => { draft.meta.description = event.target.value; })} /></Field>
          <Field label="Config version"><Input value={project.meta.configVersion} onChange={(event) => mutate((draft) => { draft.meta.configVersion = event.target.value; })} /></Field>
        </div>
        <p className="mt-1 text-[9px] text-muted-foreground">名称与作者会写入 trime.yaml；config version 对应 <code>config_version</code>。</p>
      </details>

      <div className="mb-4 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold">色卡</span>
          <span className="text-[9px] text-muted-foreground">浅色与深色分别选择，影响所有设备</span>
          {extraSchemeCount > 0 ? <Badge variant="muted" title="这些原始 scheme 通过 passthrough 保留，不在这里编辑">{extraSchemeCount} extra schemes preserved</Badge> : null}
        </div>

        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
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

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] text-muted-foreground">预览</span>
          <Button size="sm" variant={project.variant === "light" ? "default" : "ghost"} onClick={() => mutate((draft) => { draft.variant = "light"; })}>浅色</Button>
          <Button size="sm" variant={project.variant === "dark" ? "default" : "ghost"} onClick={() => mutate((draft) => { draft.variant = "dark"; })}>深色</Button>
          {card.builtin ? (
            <span className="ml-2 text-xs font-semibold">{card.name}</span>
          ) : (
            <>
              <Badge variant="success">自定义</Badge>
              <Input className="h-7 w-44" value={card.name} onChange={(event) => editCard((target) => { target.name = event.target.value; })} />
            </>
          )}
          <div className="ml-auto flex gap-1">
            <Button size="sm" variant="outline" onClick={duplicateCard}><Copy />复制</Button>
            <Button size="sm" variant="outline" onClick={createCard}><Plus />新建</Button>
            {card.builtin ? null : <Button size="sm" variant="outline" className="text-red-300" onClick={deleteCard}><Trash2 />删除</Button>}
          </div>
        </div>
      </div>

      {card.builtin ? (
        <div className="mb-3 rounded-lg border border-border bg-muted/10 px-3 py-2 text-[10px] text-muted-foreground">
          修改任意颜色时会自动复制为自定义方案，原方案保持不变。
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <section className="rounded-xl border border-border bg-card p-4">
          <h3 className="mb-2 text-xs font-semibold">色值 · {project.variant === "light" ? "浅色" : "深色"} · {card.name}</h3>
          <div className="space-y-1">
            {Object.entries(card.tokens).map(([token, value]) => (
              <div key={token} className="flex items-center gap-2">
                <span className="w-24 shrink-0 text-[10px] text-muted-foreground">{token}</span>
                <input type="color" className="h-6 w-8 cursor-pointer rounded border border-border bg-transparent" value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : "#000000"} onChange={(event) => editCard((target) => { target.tokens[token] = event.target.value; })} />
                <Input className="h-7" value={value} onChange={(event) => editCard((target) => { target.tokens[token] = event.target.value; })} />
              </div>
            ))}
          </div>
        </section>

        <div className="space-y-4">
          <section className="rounded-xl border border-border bg-card p-4">
            <h3 className="mb-2 text-xs font-semibold">状态覆盖</h3>
            <div className="mb-2 flex gap-1">
              {STATE_FIELDS.map((state) => (
                <Button key={state} size="sm" variant={stateField === state ? "default" : "ghost"} onClick={() => setStateField(state)}>{state}</Button>
              ))}
            </div>
            <div className="space-y-1">
              {Object.entries(card.states[stateField] ?? {}).map(([token, value]) => (
                <div key={token} className="flex items-center gap-2">
                  <span className="w-24 shrink-0 text-[10px] text-muted-foreground">{token}</span>
                  <input type="color" className="h-6 w-8 cursor-pointer rounded border border-border bg-transparent" value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : "#000000"} onChange={(event) => editCard((target) => { (target.states[stateField] ??= {})[token] = event.target.value; })} />
                  <Input className="h-7" value={value} onChange={(event) => editCard((target) => { (target.states[stateField] ??= {})[token] = event.target.value; })} />
                  <Button size="sm" variant="ghost" className="h-7 px-1 text-red-300" onClick={() => editCard((target) => { delete target.states[stateField]?.[token]; })}>×</Button>
                </div>
              ))}
              {Object.keys(card.states[stateField] ?? {}).length === 0 ? <p className="text-[10px] text-muted-foreground">没有该状态的覆盖值。</p> : null}
            </div>
            <div className="mt-2 flex items-center gap-1">
              <Select className="h-7 w-28" value={overrideToken} onChange={(event) => setOverrideToken(event.target.value)}>
                {Object.keys(card.tokens).map((token) => <option key={token} value={token}>{token}</option>)}
              </Select>
              <Input className="h-7 w-24" value={overrideValue} onChange={(event) => setOverrideValue(event.target.value)} />
              <Button size="sm" variant="outline" className="h-7" onClick={() => editCard((target) => {
                const state = target.states[stateField] ?? {};
                state[overrideToken] = overrideValue;
                target.states[stateField] = state;
              })}>添加覆盖</Button>
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card p-4">
            <div className="mb-2 flex items-center gap-2">
              <h3 className="text-xs font-semibold">键样式</h3>
              <span className="text-[9px] text-muted-foreground">style type → token</span>
              <Button size="sm" variant="outline" className="ml-auto h-7" onClick={addStyle}><Plus />新建样式</Button>
            </div>
            <p className="mb-2 text-[9px] text-muted-foreground">
              default 写入 key_*，off 写入 off_key_*；modifier / enter / space / 自定义样式只写入
              preset_keyboards 的单键颜色。为保证导出外观一致，非 default 键仍会按当前预览方向固化。
            </p>
            <div className="space-y-2">
              {Object.values(project.keyStyles).map((style) => (
                <div key={style.id} className="rounded border border-border bg-muted/10 p-2">
                  <div className="mb-1 flex items-center gap-1">
                    <Badge variant="muted">{style.id}</Badge>
                    <Input className="h-6 w-32" value={style.name} onChange={(event) => mutate((draft) => { draft.keyStyles[style.id] = { ...draft.keyStyles[style.id], name: event.target.value }; })} />
                    <Button size="sm" variant="ghost" className="ml-auto h-6 px-1" onClick={() => duplicateStyle(style.id)}><Copy /></Button>
                    <Button size="sm" variant="ghost" className="h-6 px-1 text-red-300" disabled={BUILTIN_STYLES.has(style.id)} onClick={() => deleteStyle(style.id)}><Trash2 /></Button>
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    {STYLE_FIELDS.map((field) => (
                      <label key={field} className="flex items-center gap-1 text-[9px] text-muted-foreground">
                        <span className="w-14">{field}</span>
                        <Select className="h-6" value={(style[field] as string | undefined) ?? ""} onChange={(event) => mutate((draft) => {
                          draft.keyStyles[style.id] = { ...draft.keyStyles[style.id], [field]: event.target.value };
                        })}>
                          <option value="">—</option>
                          {tokenOptions.map((token) => {
                            const [state, key] = token.includes(".") ? token.split(".", 2) : ["tokens", token];
                            const value = state === "tokens" ? card.tokens[key] : card.states[state]?.[key] ?? "";
                            return <option key={token} value={token}>{token}{value ? ` · ${value}` : ""}</option>;
                          })}
                        </Select>
                        <span className="h-3 w-3 shrink-0 rounded border border-border" style={{ background: tokenValue(card, (style[field] as string | undefined)) }} />
                      </label>
                    ))}
                  </div>
                  <details className="mt-1">
                    <summary className="cursor-pointer text-[9px] text-muted-foreground">pressed / disabled</summary>
                    <div className="mt-1 grid grid-cols-2 gap-1">
                      {(["pressed", "disabled"] as const).map((state) => (
                        <div key={state} className="space-y-1">
                          <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{state}</div>
                          {STYLE_FIELDS.map((field) => (
                            <label key={field} className="flex items-center gap-1 text-[9px] text-muted-foreground">
                              <span className="w-12">{field}</span>
                              <Select className="h-6" value={style[state]?.[field] ?? ""} onChange={(event) => mutate((draft) => {
                                const current = draft.keyStyles[style.id];
                                const next = { ...(current[state] ?? {}) };
                                if (event.target.value) next[field] = event.target.value;
                                else delete next[field];
                                draft.keyStyles[style.id] = { ...current, [state]: next };
                              })}>
                                <option value="">—</option>
                                {tokenOptions.map((token) => <option key={token} value={token}>{token}</option>)}
                              </Select>
                            </label>
                          ))}
                        </div>
                      ))}
                    </div>
                  </details>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card p-4">
            <h3 className="mb-2 text-xs font-semibold">尺寸与 popup</h3>
            <div className="grid grid-cols-2 gap-2">
              {METRIC_FIELDS.map(([field, label]) => (
                <Field key={field} label={label}>
                  <Input
                    className="h-7"
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
            <p className="mt-2 text-[9px] text-muted-foreground">popup 尺寸/颜色会写入 style 与 color scheme；popup 文本颜色来自主题色卡。</p>
          </section>
        </div>
      </div>
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
