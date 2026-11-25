import { useMemo, useState } from "react";
import { Check, Copy, Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { compileProject } from "../compiler";
import { diffProjects } from "../diff";
import { BUILTIN_PRESETS } from "../presets";
import type { Snapshot } from "../storage";
import type { PresetLibraries, ProjectDoc } from "../types";
import { normalizeProject, slug } from "../utils";

type Props = {
  project: ProjectDoc;
  libs: PresetLibraries;
  yaml: string;
  snapshots: Snapshot[];
  setMessage: (message: string) => void;
};

type Issue = { level: "error" | "warning"; message: string };

export function ExportPanel({ project, libs, yaml, snapshots, setMessage }: Props) {
  const [copied, setCopied] = useState(false);
  const [compareKey, setCompareKey] = useState("");
  const [diffView, setDiffView] = useState<"yaml" | "structured">("yaml");
  const [diffQuery, setDiffQuery] = useState("");
  const main = libs.layouts.find((item) => item.id === project.layoutId);
  const pageLayouts = [main, ...(project.pageIds ?? []).map((id) => libs.layouts.find((item) => item.id === id))].filter(Boolean);
  const issues = useMemo(() => validate(project, libs), [project, libs]);
  const errors = issues.filter((issue) => issue.level === "error");
  const warnings = issues.filter((issue) => issue.level === "warning");
  const fileName = `${slug(project.meta.name)}.yaml`;
  const compareYaml = useMemo(() => {
    const snapshot = snapshots.find((item) => item.key === compareKey);
    return snapshot ? compileProject(normalizeProject(snapshot.project), BUILTIN_PRESETS) : "";
  }, [compareKey, snapshots]);
  const diff = useMemo(() => (compareYaml ? diffLines(compareYaml, yaml) : []), [compareYaml, yaml]);
  const added = diff.filter((op) => op.type === "add").length;
  const removed = diff.filter((op) => op.type === "remove").length;
  const compareSnapshot = snapshots.find((item) => item.key === compareKey);
  const structured = useMemo(() => (compareSnapshot ? diffProjects(compareSnapshot.project, project) : []), [compareSnapshot, project]);
  const structuredCount = structured.reduce((sum, section) => sum + section.entries.length + section.truncated, 0);
  const visibleStructured = useMemo(() => {
    const query = diffQuery.trim().toLowerCase();
    if (!query) return structured;
    return structured
      .map((section) => ({
        ...section,
        entries: section.entries.filter((entry) => `${entry.path} ${entry.before ?? ""} ${entry.after ?? ""}`.toLowerCase().includes(query)),
      }))
      .filter((section) => section.entries.length > 0);
  }, [structured, diffQuery]);
  const markdown = useMemo(() => (compareSnapshot ? diffMarkdown(project, compareSnapshot, structured) : ""), [compareSnapshot, project, structured]);

  const copy = async () => {
    await navigator.clipboard.writeText(yaml);
    setCopied(true);
    setMessage("已复制 trime.yaml");
    window.setTimeout(() => setCopied(false), 1500);
  };

  const downloadFile = (content: string, name: string, type = "text/plain;charset=utf-8") => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = name;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const download = () => {
    downloadFile(yaml, fileName, "text/yaml;charset=utf-8");
    setMessage(`已下载 ${fileName}`);
  };

  const copyDiff = async () => {
    if (!markdown) return;
    await navigator.clipboard.writeText(markdown);
    setMessage("已复制结构化 diff");
  };

  return (
    <div className="h-full overflow-auto p-5">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold">Export trime.yaml</span>
        <Badge variant="muted">{pagesLabel(pageLayouts.length)}</Badge>
        <Badge variant="muted">{project.macroIds.length} macros</Badge>
        <Badge variant={errors.length ? "danger" : warnings.length ? "warning" : "success"}>
          {errors.length ? `${errors.length} errors` : warnings.length ? `${warnings.length} warnings` : "ready"}
        </Badge>
        <div className="ml-auto flex gap-1">
          <Button size="sm" variant="outline" onClick={() => void copy()}>{copied ? <Check /> : <Copy />}{copied ? "Copied" : "Copy YAML"}</Button>
          <Button size="sm" variant="secondary" onClick={download}><Download />Download</Button>
        </div>
      </div>

      <p className="mb-3 text-[10px] text-muted-foreground">
        这是唯一产物：主题色卡 + 键位配色 + 键盘布局 + 宏 + 方案 meta 编译成一份完整 <code>trime.yaml</code>。不会写盘。
      </p>

      <section className="mb-3 rounded-xl border border-border bg-card p-3">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-xs font-semibold">Diff against snapshot</h3>
          <Select className="h-7 w-64" value={compareKey} onChange={(event) => setCompareKey(event.target.value)}>
            <option value="">No snapshot</option>
            {snapshots.map((snapshot) => <option key={snapshot.key} value={snapshot.key}>{snapshot.label} · {new Date(snapshot.createdAt).toLocaleString()}</option>)}
          </Select>
          {compareKey ? <Badge variant={added || removed ? "warning" : "success"}>+{added} / -{removed} lines</Badge> : <span className="text-[10px] text-muted-foreground">在 Basic 里创建快照后可对比</span>}
          {compareKey ? (
            <div className="ml-auto flex items-center gap-1">
              <Button size="sm" variant={diffView === "yaml" ? "secondary" : "ghost"} className="h-7" onClick={() => setDiffView("yaml")}>YAML lines</Button>
              <Button size="sm" variant={diffView === "structured" ? "secondary" : "ghost"} className="h-7" onClick={() => setDiffView("structured")}>Structured · {structuredCount}</Button>
              <Button size="sm" variant="ghost" className="h-7" onClick={() => void copyDiff()}>Copy .md</Button>
              <Button size="sm" variant="ghost" className="h-7" onClick={() => downloadFile(markdown, `${slug(project.meta.name)}-diff.md`, "text/markdown;charset=utf-8")}>Download .md</Button>
            </div>
          ) : null}
        </div>
        {compareKey && diffView === "structured" ? (
          <Input className="mt-2 h-7" placeholder="Filter paths or values…" value={diffQuery} onChange={(event) => setDiffQuery(event.target.value)} />
        ) : null}
        {compareKey && diffView === "yaml" ? (
          <div className="mt-2 max-h-72 overflow-auto rounded border border-border bg-background p-2 font-mono text-[9px] leading-relaxed">
            {diff.map((op, index) => (
              <div key={index} className={op.type === "add" ? "bg-emerald-500/10 text-emerald-200" : op.type === "remove" ? "bg-red-500/10 text-red-200" : "text-muted-foreground/60"}>
                <span className="inline-block w-3 select-none">{op.type === "add" ? "+" : op.type === "remove" ? "-" : " "}</span>
                <span className="whitespace-pre-wrap break-all">{op.text || " "}</span>
              </div>
            ))}
          </div>
        ) : null}
        {compareKey && diffView === "structured" ? (
          <div className="mt-2 max-h-72 space-y-2 overflow-auto rounded border border-border bg-background p-2">
            {visibleStructured.length === 0 ? <p className="text-[10px] text-muted-foreground">{structured.length === 0 ? "没有结构化差异。" : "没有匹配的差异。"}</p> : null}
            {visibleStructured.map((section) => (
              <div key={section.id}>
                <div className="mb-1 flex items-center gap-2 text-[10px] font-semibold">
                  <span>{section.title}</span>
                  <Badge variant="muted">{section.entries.length + section.truncated}</Badge>
                </div>
                <div className="space-y-0.5">
                  {section.entries.map((entry, index) => (
                    <div key={`${entry.path}-${index}`} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 rounded px-1 py-0.5 text-[9px] hover:bg-muted/30">
                      <Badge variant={entry.kind === "added" ? "success" : entry.kind === "removed" ? "danger" : "warning"}>{entry.kind}</Badge>
                      <code className="min-w-0 break-all text-muted-foreground">{entry.path}</code>
                      <span className="whitespace-pre-wrap break-all">
                        {entry.before !== undefined ? <span className="text-red-300">{entry.before}</span> : null}
                        {entry.before !== undefined && entry.after !== undefined ? <span className="text-muted-foreground"> → </span> : null}
                        {entry.after !== undefined ? <span className="text-emerald-300">{entry.after}</span> : null}
                      </span>
                    </div>
                  ))}
                  {section.truncated > 0 ? <p className="px-1 text-[9px] text-amber-300">还有 {section.truncated} 项未显示。</p> : null}
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      {issues.length > 0 ? (
        <section className="mb-3 rounded-xl border border-border bg-card p-3">
          <h3 className="mb-1 text-xs font-semibold">Validation</h3>
          <div className="space-y-1">
            {issues.map((issue, index) => (
              <div key={index} className="flex items-start gap-2 text-[10px]">
                <Badge variant={issue.level === "error" ? "danger" : "warning"}>{issue.level}</Badge>
                <span className="whitespace-pre-wrap break-words">{issue.message}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="rounded-xl border border-border bg-card">
        <div className="flex items-center gap-2 border-b border-border px-3 py-2">
          <span className="font-mono text-[10px]">{fileName}</span>
          <span className="text-[9px] text-muted-foreground">{yaml.split("\n").length} lines · {new Blob([yaml]).size} bytes</span>
          <div className="ml-auto flex gap-1">
            <Button size="sm" variant="ghost" className="h-6 px-1 text-[9px]" onClick={() => void copy()}><Copy />Copy</Button>
          </div>
        </div>
        <textarea
          readOnly
          value={yaml}
          className="h-[calc(100vh-19rem)] min-h-96 w-full resize-none rounded-b-xl bg-background p-3 font-mono text-[10px] leading-relaxed outline-none"
          spellCheck={false}
        />
      </section>
    </div>
  );
}

function pagesLabel(count: number): string {
  return `${count} keyboards`;
}

function validate(project: ProjectDoc, libs: PresetLibraries): Issue[] {
  const issues: Issue[] = [];
  const macroIds = new Set(libs.macros.map((item) => item.id));
  const layoutIds = new Set(libs.layouts.map((item) => item.id));
  const sanitize = (value: string) => value.replace(/[^A-Za-z0-9_]/g, "_");
  const knownPresets = new Set<string>([
    "Keyboard_main", "Keyboard_default", "liquid_keyboard_exit", "space1", "Return1",
    "liquid_keyboard_clipboard", ...Object.keys(project.customPresetKeys ?? {}),
    ...libs.macros.map((item) => `macro_${sanitize(item.id)}`),
  ]);
  for (const id of [project.layoutId, ...(project.pageIds ?? [])]) knownPresets.add(`Keyboard_${sanitize(id)}`);
  const liquidTabs = project.chrome?.liquid.tabs ?? [];
  const tabIds = new Set<string>();
  for (const tab of liquidTabs) {
    if (!tab.id) issues.push({ level: "error", message: "liquid tab id 不能为空" });
    if (tabIds.has(tab.id)) issues.push({ level: "error", message: `liquid tab id 重复：${tab.id}` });
    tabIds.add(tab.id);
    knownPresets.add(`liquid_keyboard_${sanitize(tab.id)}`);
    if (tab.type === "SINGLE" && !tab.keys?.length) {
      issues.push({ level: "warning", message: `liquid tab ${tab.id} 是 SINGLE 但没有 keys` });
    }
    if (tab.type === "SYMBOL" && !tab.symbols?.length) {
      issues.push({ level: "warning", message: `liquid tab ${tab.id} 是 SYMBOL 但没有 symbols` });
    }
  }
  const toolbarButtons = project.chrome ? [project.chrome.toolbar.primaryButton, ...project.chrome.toolbar.buttons] : [];
  for (const button of toolbarButtons) {
    if (button.action.startsWith("liquid_keyboard_") && !knownPresets.has(button.action)) {
      issues.push({ level: "warning", message: `toolbar 引用了不存在的 liquid action：${button.action}` });
    }
  }

  if (!libs.layouts.some((item) => item.id === project.layoutId)) {
    issues.push({ level: "error", message: `主布局不存在：${project.layoutId}` });
  }
  for (const id of project.pageIds ?? []) {
    if (!layoutIds.has(id)) issues.push({ level: "error", message: `页面引用的布局不存在：${id}` });
    if (id === project.layoutId) issues.push({ level: "warning", message: `页面与主布局重复：${id}` });
  }
  for (const id of project.macroIds) {
    if (!macroIds.has(id)) issues.push({ level: "error", message: `宏引用不存在：${id}` });
  }

  const pageLayouts = [
    libs.layouts.find((item) => item.id === project.layoutId),
    ...(project.pageIds ?? []).map((id) => libs.layouts.find((item) => item.id === id)),
  ].filter((item): item is NonNullable<typeof item> => Boolean(item));

  for (const layout of pageLayouts) {
    layout.rows.forEach((row, rowIndex) => {
      const sum = row.keys.reduce((total, key) => total + (key.width || 0), 0);
      if (Math.abs(sum - 100) > 0.5) {
        issues.push({ level: "warning", message: `${layout.name} 第 ${rowIndex + 1} 行宽度合计 ${sum.toFixed(1)}%，不是 100%（可用 Fit 100% 修正）` });
      }
      row.keys.forEach((key, keyIndex) => {
        if (key.popup?.length && key.long_click) {
          issues.push({ level: "warning", message: `${layout.name} 第 ${rowIndex + 1} 行第 ${keyIndex + 1} 键同时有 popup 和 long_click；运行时 popup 优先生效` });
        }
        for (const behavior of ["click", "long_click", "double_click", "swipe_up", "swipe_down", "swipe_left", "swipe_right"] as const) {
          const action = key[behavior];
          if (action?.kind === "macro" && !macroIds.has(action.id)) {
            issues.push({ level: "error", message: `${layout.name} 第 ${rowIndex + 1} 行第 ${keyIndex + 1} 键的 ${behavior} 引用了不存在的宏：${action.id}` });
          }
          if (action?.kind === "page" && !layoutIds.has(action.id)) {
            issues.push({ level: "error", message: `${layout.name} 第 ${rowIndex + 1} 行第 ${keyIndex + 1} 键的 ${behavior} 引用了不存在的页面：${action.id}` });
          }
          if (action?.kind === "preset" && !knownPresets.has(action.value)) {
            issues.push({ level: "error", message: `${layout.name} 第 ${rowIndex + 1} 行第 ${keyIndex + 1} 键的 ${behavior} 引用了不存在的 preset_key：${action.value}` });
          }
        }
        if (!key.click && !(key.label === undefined && key.style === "off")) {
          issues.push({ level: "warning", message: `${layout.name} 第 ${rowIndex + 1} 行第 ${keyIndex + 1} 键没有 click 行为` });
        }
        if (!project.keyStyles[key.style]) {
          issues.push({ level: "warning", message: `${layout.name} 第 ${rowIndex + 1} 行第 ${keyIndex + 1} 键引用了不存在的 style type：${key.style}` });
        }
      });
    });
  }
  return issues.slice(0, 40);
}

type DiffOp = { type: "same" | "add" | "remove"; text: string };

function diffLines(before: string, after: string): DiffOp[] {
  const left = before.split("\n");
  const right = after.split("\n");
  const rows = left.length;
  const columns = right.length;
  const table: Uint32Array[] = Array.from({ length: rows + 1 }, () => new Uint32Array(columns + 1));
  for (let row = rows - 1; row >= 0; row -= 1) {
    for (let column = columns - 1; column >= 0; column -= 1) {
      table[row][column] = left[row] === right[column]
        ? table[row + 1][column + 1] + 1
        : Math.max(table[row + 1][column], table[row][column + 1]);
    }
  }
  const output: DiffOp[] = [];
  let row = 0;
  let column = 0;
  while (row < rows && column < columns) {
    if (left[row] === right[column]) {
      output.push({ type: "same", text: left[row] });
      row += 1;
      column += 1;
    } else if (table[row + 1][column] >= table[row][column + 1]) {
      output.push({ type: "remove", text: left[row] });
      row += 1;
    } else {
      output.push({ type: "add", text: right[column] });
      column += 1;
    }
  }
  while (row < rows) {
    output.push({ type: "remove", text: left[row] });
    row += 1;
  }
  while (column < columns) {
    output.push({ type: "add", text: right[column] });
    column += 1;
  }
  return output;
}

function diffMarkdown(project: ProjectDoc, snapshot: Snapshot, sections: ReturnType<typeof diffProjects>): string {
  const lines = [
    `# ${project.meta.name} vs ${snapshot.label}`,
    "",
    `- Project: ${project.meta.name}`,
    `- Snapshot: ${snapshot.label}`,
    `- Snapshot time: ${new Date(snapshot.createdAt).toISOString()}`,
    `- Generated: ${new Date().toISOString()}`,
    "",
  ];
  if (sections.length === 0) {
    lines.push("No structured changes.");
    return lines.join("\n");
  }
  const cell = (value: string | undefined) => (value === undefined ? "" : `\`${value.replace(/`/g, "\\`").replace(/\n/g, "\\n")}\``);
  for (const section of sections) {
    lines.push(`## ${section.title}`, "");
    for (const entry of section.entries) {
      const arrow = entry.before !== undefined && entry.after !== undefined
        ? `${cell(entry.before)} → ${cell(entry.after)}`
        : entry.before !== undefined
          ? `${cell(entry.before)} →`
          : `→ ${cell(entry.after)}`;
      lines.push(`- **${entry.kind}** \`${entry.path}\`: ${arrow}`);
    }
    if (section.truncated > 0) lines.push(`- … ${section.truncated} more entries not shown`);
    lines.push("");
  }
  return lines.join("\n");
}
