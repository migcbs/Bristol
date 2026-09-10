"use client";

import type { ReactNode } from "react";
import { clsx } from "clsx";
import { avatarTint } from "@/lib/avatar-tint";

// "use client" added 2026-09-09 alongside the optional `onClick` prop —
// RecordCard now always attaches an inline stopPropagation handler on its
// actions column (so an action button click never also triggers the
// card's own onClick), and a Server Component can't pass an inline event
// handler to a plain function component. The `name`/`meta`/`tags`/
// `actions` props themselves can still be server-rendered content passed
// down as already-rendered ReactNode — that's the standard Next.js
// Server-Component-renders-into-a-Client-Component's-children pattern,
// so this didn't require touching any of RecordCard's ~15 callers.
//
// A single record as a card — avatar, name, meta line, tag row, actions —
// instead of a table row. Modeled directly on the Perrucho admin's
// ClientCard/PetCard (.ds-card), confirmed with the user 2026-09-09 as the
// reference for how records should look across Bristol's own record
// lists (alumnos, ex-alumnos, etc.).
//
// `onClick` is optional — pass it to make the whole card open a detail
// popup (confirmed with the user 2026-09-09: "al darles click deben
// desplegar la información en un pop-up"). The actions column stops the
// click from bubbling up to it, so an icon action (editar, eliminar,
// agregar alumno...) never also triggers the card's own onClick.
export function RecordCard({
  avatarId,
  avatarLabel,
  name,
  badge,
  meta,
  tags,
  actions,
  dimmed,
  onClick,
}: {
  avatarId: string;
  avatarLabel: string;
  name: ReactNode;
  badge?: ReactNode;
  meta?: ReactNode;
  tags?: ReactNode;
  actions?: ReactNode;
  dimmed?: boolean;
  onClick?: () => void;
}) {
  const tint = avatarTint(avatarId);
  return (
    <div
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      className={clsx(
        "flex items-start gap-3.5 rounded-2xl border border-border bg-white p-4 shadow-[0_1px_2px_rgba(20,20,43,0.04)] transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-[0_12px_28px_-18px_rgba(20,20,43,0.25)]",
        dimmed && "bg-surface opacity-70",
        onClick && "cursor-pointer"
      )}
    >
      <div className={clsx("flex h-12 w-12 shrink-0 items-center justify-center rounded-full font-display text-lg font-bold", tint.bg, tint.text)}>
        {avatarLabel}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate font-medium text-text">{name}</p>
          {badge}
        </div>
        {meta && <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">{meta}</div>}
        {tags && <div className="mt-2 flex flex-wrap gap-1.5">{tags}</div>}
      </div>
      {actions && (
        <div className="flex shrink-0 flex-col gap-1.5" onClick={(e) => e.stopPropagation()}>
          {actions}
        </div>
      )}
    </div>
  );
}
