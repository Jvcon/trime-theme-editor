import { useMemo, useState } from "react";
import { AlertTriangle, Upload, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { importTrimeYaml, type ImportOptions } from "./importer";
import type { ProjectBundle } from "./types";

type Props = {
  source: string;
  fileName: string;
  resources?: Record<string, string>;
  onApply: (project: ProjectBundle, warnings: string[]) => void;
  onCancel: () => void;
};

const REPORT_SECTIONS = [
  ["mapped", "Mapped", "success"],
  ["passthrough", "Passthrough", "muted"],
  ["needsReview", "Needs review", "warning"],
  ["dropped", "Dropped", "danger"],
] as const;

export function ImportDialog({ source, fileName, resources, onApply, onCancel }: Props) {
  const [options, setOptions] = useState<ImportOptions>({ themeCard: true, interface: true, keyboards: "all", calibrateRows: false });
  const preview = useMemo(() => importTrimeYaml(source, fileName, options, resources), [source, fileName, options, resources]);
  const allLayouts = useMemo(() => importTrimeYaml(source, fileName, { ...options, keyboards: "all" }, resources).project.layouts.length, [source, fileName, options, resources]);
  const project = preview.project;
  const layouts = project.layouts.length;
  const macros = project.macros.length;
  const chrome = project.chrome;

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-overlay p-panel">
      <div role="dialog" aria-modal="true" aria-label="导入 trime.yaml" className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-border bg-card shadow-overlay">
        <header className="flex items-center gap-stack border-b border-border px-panel py-3">
          <Upload className="size-4" />
          <div className="leading-tight">
            <div className="text-sm font-semibold">Import trime.yaml</div>
            <div className="text-2xs text-muted-foreground">{fileName}{resources && Object.keys(resources).length > 0 ? ` + ${Object.keys(resources).length} resources` : ""}</div>
          </div>
          <Button size="icon" variant="ghost" className="ml-auto" aria-label="关闭导入对话框" onClick={onCancel}><X /></Button>
        </header>

        <div className="min-h-0 flex-1 space-y-3 overflow-auto p-panel">
          <div className="rounded-lg border border-border bg-muted/20 p-gutter">
            <div className="text-xs font-medium">{project.meta.name}</div>
            <div className="mt-1 flex flex-wrap gap-1">
              <Badge variant="muted">{layouts} layouts</Badge>
              <Badge variant="muted">{macros} macros</Badge>
              <Badge variant="muted">{chrome?.liquid.tabs.length ?? 0} liquid tabs</Badge>
              <Badge variant="muted">{chrome?.toolbar.buttons.length ?? 0} toolbar buttons</Badge>
            </div>
            <div className="mt-2 text-2xs text-muted-foreground">
              main: <code>{project.mainLayoutId}</code> · author: {project.meta.author || "—"}
            </div>
          </div>

          <section className="space-y-2">
            <h3 className="text-xs font-semibold">Style</h3>
            <label className="flex items-center gap-stack rounded border border-border px-2 py-1.5 text-caption">
              <input
                type="checkbox"
                checked={options.themeCard !== false}
                onChange={(event) => setOptions((current) => ({ ...current, themeCard: event.target.checked }))}
              />
              导入 preset_color_schemes 为浅色/深色两个可编辑方案
            </label>
            <label className="flex items-center gap-stack rounded border border-border px-2 py-1.5 text-caption">
              <input
                type="checkbox"
                checked={options.interface !== false}
                onChange={(event) => setOptions((current) => ({ ...current, interface: event.target.checked }))}
              />
              导入 tool_bar / liquid_keyboard / window / preedit
            </label>
          </section>

          <section className="space-y-2">
            <h3 className="text-xs font-semibold">Keyboards</h3>
            <label className="flex items-center gap-stack rounded border border-border px-2 py-1.5 text-caption">
              <input
                type="radio"
                name="keyboards"
                checked={options.keyboards !== "main"}
                onChange={() => setOptions((current) => ({ ...current, keyboards: "all" }))}
              />
              导入全部 preset_keyboards（{allLayouts} 个布局）
            </label>
            <label className="flex items-center gap-stack rounded border border-border px-2 py-1.5 text-caption">
              <input
                type="radio"
                name="keyboards"
                checked={options.keyboards === "main"}
                onChange={() => setOptions((current) => ({ ...current, keyboards: "main" }))}
              />
              只导入主键盘
            </label>
            <label className="flex items-center gap-stack rounded border border-border px-2 py-1.5 text-caption">
              <input
                type="checkbox"
                checked={options.calibrateRows !== false}
                onChange={(event) => setOptions((current) => ({ ...current, calibrateRows: event.target.checked }))}
              />
              把导入布局的每一行宽度校准到 100%
            </label>
            <p className="text-2xs text-muted-foreground">
              只导入主键盘时，页面跳转引用可能悬空，导入后可在 Layouts 里补 page。
            </p>
          </section>

          {REPORT_SECTIONS.map(([key, label, variant]) => {
            const entries = preview.report[key];
            if (entries.length === 0) return null;
            const tone = key === "needsReview"
              ? "border-warning/20 bg-warning/5 text-warning"
              : key === "dropped"
                ? "border-destructive/20 bg-destructive/5 text-destructive"
                : "border-border bg-muted/10 text-muted-foreground";
            return (
              <section key={key} className="space-y-1">
                <h3 className="flex items-center gap-1 text-xs font-semibold">
                  {key === "needsReview" ? <AlertTriangle className="size-3 text-warning" /> : null}
                  <Badge variant={variant}>{label} · {entries.length}</Badge>
                </h3>
                {entries.map((entry, index) => (
                  <div key={index} className={`flex items-start gap-stack rounded border px-2 py-1 text-2xs ${tone}`}>
                    <span className="mt-0.5">•</span>
                    <span className="whitespace-pre-wrap break-words">{entry}</span>
                  </div>
                ))}
              </section>
            );
          })}
        </div>

        <footer className="flex items-center justify-end gap-stack border-t border-border px-panel py-3">
          <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button size="sm" variant="secondary" onClick={() => onApply(preview.project, preview.warnings)}>Apply import</Button>
        </footer>
      </div>
    </div>
  );
}
