import type { StepId, StepState, StepStatus } from "../flow";

const DOT: Record<StepState, string> = {
  done: "bg-emerald-400 text-emerald-950",
  warning: "bg-amber-400 text-amber-950",
  error: "bg-red-400 text-red-950",
  default: "bg-muted text-muted-foreground",
};

const STATE_LABEL: Record<StepState, string> = {
  done: "完成",
  warning: "待确认",
  error: "有错误",
  default: "使用默认",
};

export function Stepper({ steps, current, onSelect }: {
  steps: StepStatus[];
  current: StepId | "start" | "macros";
  onSelect: (id: StepId) => void;
}) {
  return (
    <nav className="flex shrink-0 flex-wrap items-center gap-1 border-b border-border bg-card/30 px-4 py-1.5">
      {steps.map((step, index) => {
        const active = current === step.id;
        return (
          <button
            key={step.id}
            type="button"
            title={`${STATE_LABEL[step.state]}\n${step.reasons.join("\n")}`}
            onClick={() => onSelect(step.id)}
            className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] transition-colors ${
              active
                ? "border-primary bg-primary/10 text-primary"
                : "border-transparent text-muted-foreground hover:bg-muted/40 hover:text-foreground"
            }`}
          >
            <span className={`grid size-4 place-items-center rounded-full text-[9px] font-semibold ${DOT[step.state]} ${active ? "ring-2 ring-primary/40" : ""}`}>
              {index + 1}
            </span>
            <span>{step.label}</span>
            {step.optional ? <span className="text-[8px] uppercase tracking-wider opacity-70">可选</span> : null}
            <span className={`size-1.5 rounded-full ${DOT[step.state].split(" ")[0]}`} />
          </button>
        );
      })}
    </nav>
  );
}
