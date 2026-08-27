import { HTMLAttributes } from "react";
import { clsx } from "clsx";

type Tone = "primary" | "accent" | "neutral";

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
        className
      )}
      {...props}
    />
  );
}
