import { Card } from "@/components/ui/card";
import type { LucideIcon } from "lucide-react";
import { clsx } from "clsx";

// A single "número clave del día" card — the visual anchor for each area's
// home dashboard (replaces the old plain-text stub at /admin). Reads at a
// glance: big number, icon, short label — no need to read a sentence to
// know what it means.
export function KpiCard({
  icon: Icon,
  label,
  value,
  tone = "primary",
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  tone?: "primary" | "accent";
}) {
  return (
    <Card className="flex items-center gap-4 p-5">
      <div
        className={clsx(
          "flex h-11 w-11 shrink-0 items-center justify-center rounded-full",
          tone === "accent" ? "bg-accent/10 text-accent-dark" : "bg-primary/10 text-primary"
        )}
      >
        <Icon size={20} />
      </div>
      <div className="min-w-0">
        <p className="font-display text-2xl font-bold text-primary">{value}</p>
        <p className="text-xs text-muted">{label}</p>
      </div>
    </Card>
  );
}
