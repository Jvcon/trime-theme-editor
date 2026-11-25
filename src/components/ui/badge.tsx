import * as React from "react";
import { cn } from "@/lib/utils";

export function Badge({ className, variant = "default", ...props }: React.HTMLAttributes<HTMLSpanElement> & { variant?: "default" | "muted" | "success" | "warning" | "danger" }) {
  const styles = {
    default: "border-primary/40 bg-primary/15 text-primary",
    muted: "border-border bg-muted text-muted-foreground",
    success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
    warning: "border-amber-500/30 bg-amber-500/10 text-amber-300",
    danger: "border-red-500/30 bg-red-500/10 text-red-300",
  }[variant];
  return <span className={cn("inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] leading-none", styles, className)} {...props} />;
}
