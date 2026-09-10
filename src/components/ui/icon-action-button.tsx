import { forwardRef, type ButtonHTMLAttributes } from "react";
import { clsx } from "clsx";
import type { LucideIcon } from "lucide-react";

// Icon-only row action (Ver/Editar/Eliminar, etc.) — modeled on the BOOZ
// system's .btn-edit/.btn-del (confirmed with the user 2026-09-09): a
// muted rounded-square button that only reveals its color on hover,
// instead of a wall of text buttons competing for attention in every row.
export const IconActionButton = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { icon: LucideIcon; label: string; tone?: "neutral" | "danger" }
>(({ icon: Icon, label, tone = "neutral", className, ...props }, ref) => (
  <button
    ref={ref}
    aria-label={label}
    title={label}
    className={clsx(
      "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors",
      tone === "neutral" && "bg-surface text-muted hover:bg-primary/10 hover:text-primary",
      tone === "danger" && "bg-accent/5 text-accent-dark hover:bg-accent/15",
      className
    )}
    {...props}
  >
    <Icon size={16} />
  </button>
));
IconActionButton.displayName = "IconActionButton";
