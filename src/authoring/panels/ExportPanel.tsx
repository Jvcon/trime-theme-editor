import { useMemo, useState } from "react";
import { Check, Copy, Download, Upload, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import YAML from "yaml";
import { compileBundle, stringifyTrime } from "../compiler";
import { diffBundles } from "../diff";
import { buildManifest } from "../manifest";
import { resolveLayoutForDevice, deviceLabel } from "../resolve";
import { TRIME_SCHEMA_VERSION, validateTrimeYaml, type SchemaIssue } from "../schema";
import type { Snapshot } from "../storage";
import type { ProjectBundle } from "../types";
import { normalizeBundle, slug } from "../utils";
import { validateProject } from "../validation";

type Props = {
  project: ProjectBundle;
  snapshots: Snapshot[];
  setMessage: (message: string) => void;
  mutate: (fn: (draft: ProjectBundle) => void) => void;
};

type DriftFile = {
  name: string;
  original: string;
  canonical: string;
};

export function ExportPanel({ project, snapshots, setMessage, mutate }: Props) {
  const [copied, setCopied] = useState(false);
  const [compareKey, setCompareKey] = useState("");
  const [diffView, setDiffView] = useState<"yaml" | "structured">("yaml");
  const [diffQuery, setDiffQuery] = useState("");
  const [deviceId, setDeviceId] = useState(project.devices[0]?.id ?? "");
  const [drift, setDrift] = useState<DriftFile | null>(null);
  const device = project.devices.find((item) => item.id === deviceId) ?? project.devices[0];
  const activeDeviceId = device?.id ?? "";
  const yaml = useMemo(() => compileBundle(project, activeDeviceId), [project, activeDeviceId]);
  const schemaIssues = useMemo(() => validateTrimeYaml(yaml), [yaml]);
  const issues = useMemo(() => validateProject(project), [project]);
  const deviceResults = useMemo(() => project.devices.map((item) => {
    const deviceYaml = compileBundle(project, item.id);
    const schema = validateTrimeYaml(deviceYaml);
    const relevant = issues.filter((issue) => issue.area !== "devices" || issue.message.includes(item.id));
    return {
      device: item,
      yaml: deviceYaml,
      schema,
      layout: resolveLayoutForDevice(project, item),
      errorCount: schema.length + relevant.filter((issue) => issue.level === "error").length,
      warningCount: relevant.filter((issue) => issue.level === "warning").length,
    };
  }), [project, issues]);
  const readyCount = deviceResults.filter((result) => result.errorCount === 0).length;
  const errors = issues.filter((issue) => issue.level === "error");
  const warnings = issues.filter((issue) => issue.level === "warning");
  const fileName = `${slug(project.meta.name)}-${activeDeviceId || "device"}.yaml`;
  const driftSchemaIssues = useMemo<SchemaIssue[]>(() => (drift ? validateTrimeYaml(drift.original) : []), [drift]);
  const driftDiff = useMemo(() => (drift ? diffLines(drift.canonical, yaml) : []), [drift, yaml]);
  const driftAdded = driftDiff.filter((op) => op.type === "add").length;
  const driftRemoved = driftDiff.filter((op) => op.type === "remove").length;
  const compareYaml = useMemo(() => {
    const snapshot = snapshots.find((item) => item.key === compareKey);
    return snapshot ? compileBundle(normalizeBundle(snapshot.project), activeDeviceId) : "";
  }, [compareKey, snapshots, activeDeviceId]);
  const diff = useMemo(() => (compareYaml ? diffLines(compareYaml, yaml) : []), [compareYaml, yaml]);
  const added = diff.filter((op) => op.type === "add").length;
  const removed = diff.filter((op) => op.type === "remove").length;
  const compareSnapshot = snapshots.find((item) => item.key === compareKey);
  const structured = useMemo(() => (compareSnapshot ? diffBundles(compareSnapshot.project, project) : []), [compareSnapshot, project]);
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

  const copyDevice = async (id: string, content: string) => {
    await navigator.clipboard.writeText(content);
    setMessage(`已复制 ${id} 的 trime.yaml`);
  };

  const downloadDevice = (id: string, content: string) => {
    downloadFile(content, `${slug(project.meta.name)}-${id}.yaml`, "text/yaml;charset=utf-8");
    setMessage(`已下载 ${id} 的 trime.yaml`);
  };

  const downloadAll = () => {
    deviceResults.forEach((result, index) => {
      window.setTimeout(() => {
        downloadFile(result.yaml, `${slug(project.meta.name)}-${result.device.id}.yaml`, "text/yaml;charset=utf-8");
      }, index * 350);
    });
    setMessage(`开始导出 ${deviceResults.length} 个设备（浏览器可能询问是否允许多文件下载）`);
  };

  const downloadManifest = async () => {
    try {
      const manifest = await buildManifest(project);
      downloadFile(`${JSON.stringify(manifest, null, 2)}\n`, "manifest.json", "application/json;charset=utf-8");
      setMessage(`已下载 manifest.json（${manifest.devices.length} devices）`);
    } catch (error) {
      setMessage(`manifest 生成失败：${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const pickDriftFile = async (file: File) => {
    try {
      const original = await file.text();
      const parsed = YAML.parse(original);
      const canonical = stringifyTrime(parsed);
      setDrift({ name: file.name, original, canonical });
      setMessage(`已载入对比文件：${file.name}`);
    } catch (error) {
      setMessage(`读取对比文件失败：${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const copyDiff = async () => {
    if (!markdown) return;
    await navigator.clipboard.writeText(markdown);
    setMessage("已复制结构化 diff");
  };

  return (
    <div className="h-full overflow-auto p-section">
      <div className="mb-3 flex flex-wrap items-center gap-stack">
        <span className="text-sm font-semibold">检查与导出</span>
        <Select className="h-control-sm w-52" value={activeDeviceId} onChange={(event) => setDeviceId(event.target.value)}>
          {project.devices.map((item) => (
            <option key={item.id} value={item.id}>
              {deviceLabel(item, true)}
            </option>
          ))}
        </Select>
        <Select
          className="h-control-sm w-44"
          value={project.exportWidthPrecision ?? "exact"}
          onChange={(event) => mutate((draft) => {
            draft.exportWidthPrecision = event.target.value === "integer" ? "integer" : "exact";
          })}
          title="键宽按行归一化后如何写入 YAML"
        >
          <option value="exact">宽度：精确小数</option>
          <option value="integer">宽度：整数（合计 100）</option>
        </Select>
        <Badge variant={errors.length ? "danger" : warnings.length ? "warning" : "success"}>
          {errors.length ? `${errors.length} 个错误` : warnings.length ? `${warnings.length} 个警告` : "项目级检查通过"}
        </Badge>
        <Badge variant={schemaIssues.length ? "danger" : "success"}>
          schema {TRIME_SCHEMA_VERSION} · {schemaIssues.length ? `${schemaIssues.length} errors` : "ok"}
        </Badge>
        <div className="ml-auto flex flex-wrap gap-1">
          <Button size="sm" variant="secondary" onClick={downloadAll}><Download />导出全部</Button>
          <Button size="sm" variant="outline" onClick={() => void downloadManifest()}><Download />Manifest</Button>
          <Button size="sm" variant="outline" onClick={() => void copy()}>{copied ? <Check /> : <Copy />}{copied ? "已复制" : "复制当前"}</Button>
          <Button size="sm" variant="outline" onClick={download}><Download />下载当前</Button>
        </div>
      </div>

      <p className="mb-3 text-2xs text-muted-foreground">
        每个设备输出一份完整 <code>trime.yaml</code>；manifest 包含 device、path、sha256、projectHash 和 editorVersion。不会写盘。
      </p>

      <section className="mb-3 rounded-xl border border-border bg-card p-gutter">
        <div className="mb-2 flex flex-wrap items-center gap-stack">
          <h3 className="text-xs font-semibold">设备检查</h3>
          <Badge variant={readyCount === deviceResults.length ? "success" : "warning"}>{readyCount}/{deviceResults.length} 可导出</Badge>
          <span className="text-3xs text-muted-foreground">error 会阻断"可导出"状态；warning 不阻断</span>
          <Button size="sm" variant="ghost" className="ml-auto h-control-sm text-2xs" onClick={downloadAll}>全部下载</Button>
        </div>
        <div className="grid grid-cols-1 gap-stack md:grid-cols-2">
          {deviceResults.map((result) => (
            <div
              key={result.device.id}
              className={`rounded-lg border p-2 ${result.errorCount ? "border-destructive/40 bg-destructive/5" : result.warningCount ? "border-warning/30 bg-warning/5" : "border-border bg-muted/10"}`}
            >
              <div className="flex flex-wrap items-center gap-stack">
                <span className="text-xs font-medium">{deviceLabel(result.device, true)}</span>
                <Badge variant={result.errorCount ? "danger" : result.warningCount ? "warning" : "success"}>
                  {result.errorCount ? `${result.errorCount} 个错误` : result.warningCount ? `${result.warningCount} 个警告` : "可导出"}
                </Badge>
                <div className="ml-auto flex gap-1">
                  <Button size="sm" variant="ghost" className="h-control-xs px-1 text-3xs" onClick={() => setDeviceId(result.device.id)}>查看源码</Button>
                  <Button size="sm" variant="ghost" className="h-control-xs px-1 text-3xs" onClick={() => void copyDevice(result.device.id, result.yaml)}><Copy />复制</Button>
                  <Button size="sm" variant="ghost" className="h-control-xs px-1 text-3xs" onClick={() => downloadDevice(result.device.id, result.yaml)}><Download />下载</Button>
                </div>
              </div>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-3xs text-muted-foreground">
                <span>布局：<span className="text-foreground">{result.layout?.name ?? "—"}</span>{result.layout && result.layout.id !== result.layout.name ? ` (${result.layout.id})` : ""}</span>
                <span>schema：{result.schema.length ? `${result.schema.length} errors` : "ok"}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-3 rounded-xl border border-border bg-card p-gutter">
        <div className="flex flex-wrap items-center gap-stack">
          <h3 className="text-xs font-semibold">与快照对比</h3>
          <Select className="h-control-sm w-64" value={compareKey} onChange={(event) => setCompareKey(event.target.value)}>
            <option value="">不对比</option>
            {snapshots.map((snapshot) => <option key={snapshot.key} value={snapshot.key}>{snapshot.label} · {new Date(snapshot.createdAt).toLocaleString()}</option>)}
          </Select>
          {compareKey ? <Badge variant={added || removed ? "warning" : "success"}>+{added} / -{removed} 行</Badge> : <span className="text-2xs text-muted-foreground">在项目抽屉里创建快照后可对比</span>}
          {compareKey ? (
            <div className="ml-auto flex items-center gap-1">
              <Button size="sm" variant={diffView === "yaml" ? "secondary" : "ghost"} className="h-control-sm" onClick={() => setDiffView("yaml")}>YAML 行</Button>
              <Button size="sm" variant={diffView === "structured" ? "secondary" : "ghost"} className="h-control-sm" onClick={() => setDiffView("structured")}>结构化 · {structuredCount}</Button>
              <Button size="sm" variant="ghost" className="h-control-sm" onClick={() => void copyDiff()}>复制 .md</Button>
              <Button size="sm" variant="ghost" className="h-control-sm" onClick={() => downloadFile(markdown, `${slug(project.meta.name)}-diff.md`, "text/markdown;charset=utf-8")}>下载 .md</Button>
            </div>
          ) : null}
        </div>
        {compareKey && diffView === "structured" ? (
          <Input className="mt-2 h-control-sm" placeholder="Filter paths or values…" value={diffQuery} onChange={(event) => setDiffQuery(event.target.value)} />
        ) : null}
        {compareKey && diffView === "yaml" ? (
          <div className="mt-2 max-h-72 overflow-auto rounded border border-border bg-background p-2 font-mono text-3xs leading-relaxed">
            {diff.map((op, index) => (
              <div key={index} className={op.type === "add" ? "bg-success/10 text-success" : op.type === "remove" ? "bg-destructive/10 text-destructive" : "text-muted-foreground/60"}>
                <span className="inline-block w-3 select-none">{op.type === "add" ? "+" : op.type === "remove" ? "-" : " "}</span>
                <span className="whitespace-pre-wrap break-all">{op.text || " "}</span>
              </div>
            ))}
          </div>
        ) : null}
        {compareKey && diffView === "structured" ? (
          <div className="mt-2 max-h-72 space-y-2 overflow-auto rounded border border-border bg-background p-2">
            {visibleStructured.length === 0 ? <p className="text-2xs text-muted-foreground">{structured.length === 0 ? "没有结构化差异。" : "没有匹配的差异。"}</p> : null}
            {visibleStructured.map((section) => (
              <div key={section.id}>
                <div className="mb-1 flex items-center gap-stack text-2xs font-semibold">
                  <span>{section.title}</span>
                  <Badge variant="muted">{section.entries.length + section.truncated}</Badge>
                </div>
                <div className="space-y-0.5">
                  {section.entries.map((entry, index) => (
                    <div key={`${entry.path}-${index}`} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 rounded px-1 py-0.5 text-3xs hover:bg-muted/30">
                      <Badge variant={entry.kind === "added" ? "success" : entry.kind === "removed" ? "danger" : "warning"}>{entry.kind}</Badge>
                      <code className="min-w-0 break-all text-muted-foreground">{entry.path}</code>
                      <span className="whitespace-pre-wrap break-all">
                        {entry.before !== undefined ? <span className="text-destructive">{entry.before}</span> : null}
                        {entry.before !== undefined && entry.after !== undefined ? <span className="text-muted-foreground"> → </span> : null}
                        {entry.after !== undefined ? <span className="text-success">{entry.after}</span> : null}
                      </span>
                    </div>
                  ))}
                  {section.truncated > 0 ? <p className="px-1 text-3xs text-warning">还有 {section.truncated} 项未显示。</p> : null}
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <section className="mb-3 rounded-xl border border-border bg-card p-gutter">
        <div className="flex flex-wrap items-center gap-stack">
          <h3 className="text-xs font-semibold">更多工具 · 与现有 trime.yaml 对比</h3>
          <span className="text-2xs text-muted-foreground">归一化后对比当前 device 的生成结果</span>
          <label className="ml-auto inline-flex h-control-sm cursor-pointer items-center gap-1 rounded-control border border-border px-2 text-2xs transition-colors hover:bg-surface-hover active:bg-surface-active focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background">
            <Upload className="size-3" /> Compare file
            <input type="file" accept=".yaml,.yml,text/yaml" className="sr-only" onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void pickDriftFile(file);
            }} />
          </label>
          {drift ? (
            <Badge variant={drift.canonical === yaml ? "success" : "warning"}>
              {drift.canonical === yaml ? "up to date" : `+${driftAdded} / -${driftRemoved} lines`}
            </Badge>
          ) : null}
          {drift ? <Button size="sm" variant="ghost" className="h-control-sm px-1 text-2xs" onClick={() => setDrift(null)}><X />Clear</Button> : null}
        </div>
        {drift ? (
          <div className="mt-2">
            <div className="flex flex-wrap items-center gap-stack text-2xs text-muted-foreground">
              <span>{drift.name}</span>
              <Badge variant={driftSchemaIssues.length ? "danger" : "success"}>
                schema {driftSchemaIssues.length ? `${driftSchemaIssues.length} errors` : "ok"}
              </Badge>
            </div>
            {drift.canonical === yaml ? (
              <p className="mt-2 text-2xs text-success">与当前生成结果一致（忽略注释和键顺序）。</p>
            ) : (
              <div className="mt-2 max-h-64 overflow-auto rounded border border-border bg-background p-2 font-mono text-3xs leading-relaxed">
                {driftDiff.map((op, index) => (
                  <div key={index} className={op.type === "add" ? "bg-success/10 text-success" : op.type === "remove" ? "bg-destructive/10 text-destructive" : "text-muted-foreground/60"}>
                    <span className="inline-block w-3 select-none">{op.type === "add" ? "+" : op.type === "remove" ? "-" : " "}</span>
                    <span className="whitespace-pre-wrap break-all">{op.text || " "}</span>
                  </div>
                ))}
              </div>
            )}
            {driftSchemaIssues.length > 0 ? (
              <div className="mt-2 space-y-1">
                {driftSchemaIssues.map((issue, index) => (
                  <div key={index} className="flex items-start gap-stack text-2xs">
                    <Badge variant="danger">schema</Badge>
                    <code className="text-muted-foreground">{issue.path}</code>
                    <span className="whitespace-pre-wrap break-words">{issue.message}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      {issues.length > 0 ? (
        <section className="mb-3 rounded-xl border border-border bg-card p-gutter">
          <h3 className="mb-1 text-xs font-semibold">Validation</h3>
          <div className="space-y-1">
            {issues.map((issue, index) => (
              <div key={index} className="flex items-start gap-stack text-2xs">
                <Badge variant={issue.level === "error" ? "danger" : "warning"}>{issue.level}</Badge>
                <span className="whitespace-pre-wrap break-words">{issue.message}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {schemaIssues.length > 0 ? (
        <section className="mb-3 rounded-xl border border-border bg-card p-gutter">
          <h3 className="mb-1 flex items-center gap-stack text-xs font-semibold">
            Trime schema <Badge variant="muted">v{TRIME_SCHEMA_VERSION}</Badge>
          </h3>
          <div className="space-y-1">
            {schemaIssues.map((issue, index) => (
              <div key={index} className="flex items-start gap-stack text-2xs">
                <Badge variant="danger">schema</Badge>
                <code className="text-muted-foreground">{issue.path}</code>
                <span className="whitespace-pre-wrap break-words">{issue.message}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="rounded-xl border border-border bg-card">
        <div className="flex items-center gap-stack border-b border-border px-3 py-2">
          <span className="font-mono text-2xs">{fileName}</span>
          <span className="text-3xs text-muted-foreground">{yaml.split("\n").length} lines · {new Blob([yaml]).size} bytes</span>
          <div className="ml-auto flex gap-1">
            <Button size="sm" variant="ghost" className="h-control-xs px-1 text-3xs" onClick={() => void copy()}><Copy />Copy</Button>
          </div>
        </div>
        <textarea
          readOnly
          value={yaml}
          className="h-[calc(100vh-19rem)] min-h-96 w-full resize-none rounded-b-xl bg-background p-gutter font-mono text-2xs leading-relaxed outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          spellCheck={false}
        />
      </section>
    </div>
  );
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

function diffMarkdown(project: ProjectBundle, snapshot: Snapshot, sections: ReturnType<typeof diffBundles>): string {
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
