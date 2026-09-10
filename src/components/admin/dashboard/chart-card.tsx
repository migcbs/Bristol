import type { ReactNode } from "react";

// A titled panel that holds one chart on a dashboard. Lighter padding than
// the marketing-weight Card so several fit in a row on an inicio.
export function ChartCard({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-white p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-semibold text-text">{title}</h3>
        {hint && <span className="text-[11px] text-muted">{hint}</span>}
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}
