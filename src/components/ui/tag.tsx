import type { LucideIcon } from "lucide-react";
import { clsx } from "clsx";

type TagTone = "blue" | "purple" | "green" | "gray" | "red" | "amber";

const TONE_CLASSES: Record<TagTone, string> = {
  blue: "bg-blue-50 text-blue-700",
  purple: "bg-purple-50 text-purple-700",
  green: "bg-emerald-50 text-emerald-700",
  gray: "bg-surface text-muted",
  red: "bg-accent/10 text-accent-dark",
  amber: "bg-amber-50 text-amber-700",
};

// A small, sentence-case, icon-led pill — lighter-touch than Badge's
// uppercase/tracked treatment. Used inside RecordCard's tag row, modeled
// on the Perrucho admin's .ds-tag (confirmed with the user 2026-09-09).
export function Tag({
  tone = "gray",
  icon: Icon,
  className,
  children,
}: {
  tone?: TagTone;
  icon?: LucideIcon;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span className={clsx("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold", TONE_CLASSES[tone], className)}>
      {Icon && <Icon size={11} />}
      {children}
    </span>
  );
}
