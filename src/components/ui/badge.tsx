import { HTMLAttributes } from "react";
import { clsx } from "clsx";

type Tone = "primary" | "accent" | "neutral" | "success";

export function Badge({
  className,
  tone = "neutral",
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold tracking-wide uppercase",
        tone === "primary" && "bg-primary/10 text-primary",
        tone === "accent" && "bg-accent-dark text-accent-foreground",
        tone === "neutral" && "bg-surface text-muted",
        // Soft green — a positive/complete/active state that isn't the
        // brand's own navy/red, e.g. "documento entregado" (modeled on the
        // BOOZ system's status-badge.active, confirmed with the user
        // 2026-09-09).
        tone === "success" && "bg-emerald-50 text-emerald-700",
        className
      )}
      {...props}
    />
  );
}
