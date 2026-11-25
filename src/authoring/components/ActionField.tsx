import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { KEYCODES, COMMANDS, TOGGLES } from "../catalogs";
import type { ActionRef, PresetLibraries } from "../types";

type Props = {
  action: ActionRef | undefined;
  libs: PresetLibraries;
  onChange: (action: ActionRef | undefined) => void;
};

export function ActionField({ action, libs, onChange }: Props) {
  const kind = action?.kind ?? "none";

  const setKind = (next: string) => {
    if (next === "none") return onChange(undefined);
    if (next === "macro") return onChange({ kind: "macro", id: libs.macros[0]?.id ?? "" });
    if (next === "page") return onChange({ kind: "page", id: libs.layouts[0]?.id ?? "" });
    if (next === "toggle") return onChange({ kind: "toggle", value: TOGGLES[0].value });
    if (next === "command") return onChange({ kind: "command", value: COMMANDS[0].value, option: COMMANDS[0].option });
    if (next === "preset") return onChange({ kind: "preset", value: "" });
    return onChange({ kind: next as "char" | "text" | "key", value: "" });
  };

  return (
    <div className="space-y-1">
      <Select className="h-7" value={kind} onChange={(event) => setKind(event.target.value)}>
        <option value="none">None</option>
        <option value="char">Character</option>
        <option value="text">Text / macro text</option>
        <option value="key">Keycode</option>
        <option value="macro">Macro preset</option>
        <option value="page">Page</option>
        <option value="toggle">Toggle</option>
        <option value="command">Command</option>
        <option value="preset">Preset key</option>
      </Select>

      {action?.kind === "key" ? (
        <Select className="h-7" value={action.value} onChange={(event) => onChange({ kind: "key", value: event.target.value })}>
          <option value="">Select keycode…</option>
          {KEYCODES.map((group) => (
            <optgroup key={group.id} label={group.label}>
              {group.items.map((item) => <option key={item} value={item}>{item}</option>)}
            </optgroup>
          ))}
        </Select>
      ) : null}

      {action?.kind === "macro" ? (
        <Select className="h-7" value={action.id} onChange={(event) => onChange({ kind: "macro", id: event.target.value })}>
          {libs.macros.map((item) => <option key={item.id} value={item.id}>{item.name}{item.builtin ? "" : " · custom"}</option>)}
        </Select>
      ) : null}

      {action?.kind === "page" ? (
        <Select className="h-7" value={action.id} onChange={(event) => onChange({ kind: "page", id: event.target.value })}>
          {libs.layouts.map((item) => <option key={item.id} value={item.id}>{item.name}{item.builtin ? "" : " · custom"}</option>)}
        </Select>
      ) : null}

      {action?.kind === "toggle" ? (
        <Select className="h-7" value={action.value} onChange={(event) => onChange({ kind: "toggle", value: event.target.value })}>
          {TOGGLES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </Select>
      ) : null}

      {action?.kind === "command" ? (
        <div className="space-y-1">
          <Select className="h-7" value={action.value} onChange={(event) => {
            const command = COMMANDS.find((item) => item.value === event.target.value);
            onChange({ kind: "command", value: event.target.value, option: command?.option });
          }}>
            {COMMANDS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </Select>
          {action.option !== undefined ? <Input className="h-7" value={action.option} onChange={(event) => onChange({ ...action, option: event.target.value })} placeholder="option" /> : null}
        </div>
      ) : null}

      {action?.kind === "preset" ? (
        <Input className="h-7" value={action.value} onChange={(event) => onChange({ kind: "preset", value: event.target.value })} placeholder="preset_keys 名称" />
      ) : null}

      {action && ["char", "text"].includes(action.kind) ? (
        <Input className="h-7" value={"value" in action ? action.value : ""} onChange={(event) => onChange({ ...action, value: event.target.value } as ActionRef)} placeholder={action.kind === "char" ? "单个字符" : "文本"} />
      ) : null}
    </div>
  );
}
