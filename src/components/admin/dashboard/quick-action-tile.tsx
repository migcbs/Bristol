import Link from "next/link";
import type { LucideIcon } from "lucide-react";

// A big, obvious, icon-led entry point to one module — the "easier to
// understand" fix the user asked for 2026-09-09: someone new to the system
// shouldn't have to read a paragraph to find where to click.
export function QuickActionTile({
  href,
  icon: Icon,
  label,
  description,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  description?: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-4 rounded-2xl border border-border bg-white p-4 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[0_12px_28px_-16px_rgba(20,20,43,0.28)]"
    >
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-transform group-hover:scale-105">
        <Icon size={20} />
      </div>
      <div className="min-w-0">
        <p className="font-medium text-text">{label}</p>
        {description && <p className="truncate text-xs text-muted">{description}</p>}
      </div>
    </Link>
  );
}
