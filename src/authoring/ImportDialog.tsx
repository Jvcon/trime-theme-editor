import { useMemo, useState } from "react";
import { AlertTriangle, Upload, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { importTrimeYaml, type ImportOptions } from "./importer";
import type { ProjectDoc } from "./types";

type Props = {
  source: string;
  fileName: string;
  onApply: (project: ProjectDoc, warnings: string[]) => void;
  onCancel: () => void;
};

export function ImportDialog({ source, fileName, onApply, onCancel }: Props) {
  const [options, setOptions] = useState<ImportOptions>({ themeCard: true, interface: true, keyboards: "all" });
  const preview = useMemo(() => importTrimeYaml(source, fileName, options), [source, fileName, options]);
  const allLayouts = useMemo(() => importTrimeYaml(source, fileName, { ...options, keyboards: "all" }).project.customLayouts?.length ?? 0, [source, fileName, options]);
  const project = preview.project;
  const layouts = project.customLayouts?.length ?? 0;
  const macros = project.customMacros?.length ?? 0;
  const chrome = project.chrome;

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/60 p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
        <header className="flex items-center gap-2 border-b border-border px-4 py-3">
          <Upload className="size-4" />
          <div className="leading-tight">
            <div className="text-sm font-semibold">Import trime.yaml</div>
            <div className="text-[10px] text-muted-foreground">{fileName}</div>
          </div>
          <Button size="icon" variant="ghost" className="ml-auto" onClick={onCancel}><X /></Button>
        </header>

        <div className="min-h-0 flex-1 space-y-3 overflow-auto p-4">
          <div className="rounded-lg border border-border bg-muted/20 p-3">
            <div className="text-xs font-medium">{project.meta.name}</div>
            <div className="mt-1 flex flex-wrap gap-1">
              <Badge variant="muted">{layouts} layouts</Badge>
              <Badge variant="muted">{macros} macros</Badge>
              <Badge variant="muted">{chrome?.liquid.tabs.length ?? 0} liquid tabs</Badge>
              <Badge variant="muted">{chrome?.toolbar.buttons.length ?? 0} toolbar buttons</Badge>
            </div>
            <div className="mt-2 text-[10px] text-muted-foreground">
              main: <code>{project.layoutId}</code> · author: {project.meta.author || "—"}
            </div>
          </div>

          <section className="space-y-2">
            <h3 className="text-xs font-semibold">Style</h3>
            <label className="flex items-center gap-2 rounded border border-border px-2 py-1.5 text-[11px]">
              <input
                type="checkbox"
                checked={options.themeCard !== false}
                onChange={(event) => setOptions((current) => ({ ...current, themeCard: event.target.checked }))}
              />
              导入 preset_color_schemes 为一张可编辑色卡
            </label>
            <label className="flex items-center gap-2 rounded border border-border px-2 py-1.5 text-[11px]">
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
            <label className="flex items-center gap-2 rounded border border-border px-2 py-1.5 text-[11px]">
              <input
                type="radio"
                name="keyboards"
                checked={options.keyboards !== "main"}
                onChange={() => setOptions((current) => ({ ...current, keyboards: "all" }))}
              />
              导入全部 preset_keyboards（{allLayouts} 个布局）
            </label>
            <label className="flex items-center gap-2 rounded border border-border px-2 py-1.5 text-[11px]">
              <input
                type="radio"
                name="keyboards"
                checked={options.keyboards === "main"}
                onChange={() => setOptions((current) => ({ ...current, keyboards: "main" }))}
              />
              只导入主键盘
            </label>
            <label className="flex items-center gap-2 rounded border border-border px-2 py-1.5 text-[11px]">
              <input
                type="checkbox"
                checked={options.calibrateRows !== false}
                onChange={(event) => setOptions((current) => ({ ...current, calibrateRows: event.target.checked }))}
              />
              把导入布局的每一行宽度校准到 100%
            </label>
            <p className="text-[10px] text-muted-foreground">
              只导入主键盘时，页面跳转引用可能悬空，导入后可在 Layouts 里补 page。
            </p>
          </section>

          {preview.warnings.length > 0 ? (
            <section className="space-y-1">
              <h3 className="flex items-center gap-1 text-xs font-semibold"><AlertTriangle className="size-3 text-amber-300" /> Notes</h3>
              {preview.warnings.map((warning, index) => (
                <div key={index} className="flex items-start gap-2 rounded border border-amber-500/20 bg-amber-500/5 px-2 py-1 text-[10px] text-amber-100">
                  <span className="mt-0.5">•</span>
                  <span className="whitespace-pre-wrap break-words">{warning}</span>
                </div>
              ))}
            </section>
          ) : null}
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-border px-4 py-3">
          <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button size="sm" variant="secondary" onClick={() => onApply(preview.project, preview.warnings)}>Apply import</Button>
        </footer>
      </div>
    </div>
  );
}
