import type { StepId, StepState, StepStatus } from "../flow";

const DOT: Record<StepState, string> = {
  done: "bg-success text-success-foreground",
  warning: "bg-warning text-warning-foreground",
  error: "bg-destructive text-destructive-foreground",
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
    <nav className="flex shrink-0 flex-wrap items-center gap-1 border-b border-border bg-card/30 px-panel py-1.5">
      {steps.map((step, index) => {
        const active = current === step.id;
        return (
          <button
            key={step.id}
            type="button"
            title={`${STATE_LABEL[step.state]}\n${step.reasons.join("\n")}`}
            aria-current={active ? "step" : undefined}
            onClick={() => onSelect(step.id)}
            className={`flex min-h-control-sm items-center gap-1.5 rounded-md border px-2 py-1 text-caption transition-colors ${
              active
                ? "border-primary bg-primary/10 text-primary"
                : "border-transparent text-muted-foreground hover:bg-surface-hover active:bg-surface-active hover:text-foreground"
            }`}
          >
            <span className={`grid size-4 place-items-center rounded-full text-3xs font-semibold ${DOT[step.state]} ${active ? "ring-2 ring-primary/40" : ""}`}>
              {index + 1}
            </span>
            <span>{step.label}</span>
            {step.optional ? <span className="text-4xs uppercase tracking-wider opacity-70">可选</span> : null}
            <span className={`size-1.5 rounded-full ${DOT[step.state].split(" ")[0]}`} />
          </button>
        );
      })}
    </nav>
  );
}
