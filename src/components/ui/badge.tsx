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
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        tone === "primary" && "bg-primary/10 text-primary",
        tone === "accent" && "bg-accent/10 text-accent",
        tone === "neutral" && "bg-surface text-gray-700",
        className
      )}
      {...props}
    />
  );
}
