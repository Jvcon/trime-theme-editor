import * as React from "react";
import { cn } from "@/lib/utils";

export function Badge({ className, variant = "default", ...props }: React.HTMLAttributes<HTMLSpanElement> & { variant?: "default" | "muted" | "success" | "warning" | "danger" }) {
  const styles = {
    default: "border-primary/40 bg-primary/12 text-primary",
    muted: "border-border bg-muted text-muted-foreground",
    success: "border-success/35 bg-success/12 text-success",
    warning: "border-warning/35 bg-warning/12 text-warning",
    danger: "border-destructive/35 bg-destructive/12 text-destructive",
  }[variant];
  return <span className={cn("inline-flex items-center rounded-sm border px-1.5 py-0.5 text-2xs font-medium leading-none", styles, className)} {...props} />;
}
