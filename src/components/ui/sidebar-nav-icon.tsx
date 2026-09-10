"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { motion } from "framer-motion";
import { clsx } from "clsx";
import type { LucideIcon } from "lucide-react";

// One icon in the lateral rail. Two fixes over the first version
// (2026-09-09):
//
//  1. The active state now KEEPS the icon visible. The sliding pill is a
//     `position: absolute` framer-motion element, and positioned elements
//     paint on top of static siblings regardless of DOM order — so the
//     navy pill was covering the icon, and the whole cell just read as a
//     solid blue square ("no sé dónde estoy"). Wrapping the icon in a
//     `relative z-10` span lifts it back above the pill; on the pill it's
//     white (text-primary-foreground), off it it's muted.
//
//  2. The hover label is rendered through a portal with `position: fixed`,
//     positioned from the icon's bounding rect. The rail scrolls
//     (`overflow-y-auto`), and an `overflow` ancestor clips any absolutely
//     positioned child that extends past it — which is why the labels were
//     "encerrados en la barra". A fixed, portalled tooltip has no such
//     ancestor and always sits on the top layer.
export function SidebarNavIcon({
  href,
  label,
  icon: Icon,
  isActive,
  layoutId,
  shouldReduceMotion,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  isActive: boolean;
  layoutId: string;
  shouldReduceMotion: boolean;
}) {
  const ref = useRef<HTMLAnchorElement>(null);
  const [tip, setTip] = useState<{ top: number; left: number } | null>(null);

  function showTip() {
    const r = ref.current?.getBoundingClientRect();
    if (r) setTip({ top: r.top + r.height / 2, left: r.right + 10 });
  }

  return (
    <Link
      ref={ref}
      href={href}
      aria-label={label}
      onMouseEnter={showTip}
      onMouseLeave={() => setTip(null)}
      onFocus={showTip}
      onBlur={() => setTip(null)}
      className={clsx(
        "relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors",
        isActive ? "text-primary-foreground" : "text-muted hover:text-primary"
      )}
    >
      {isActive && (
        <motion.span
          layoutId={layoutId}
          transition={shouldReduceMotion ? { duration: 0 } : { type: "spring", stiffness: 380, damping: 32 }}
          className="absolute inset-0 rounded-xl bg-primary shadow-sm"
        />
      )}
      <span className="relative z-10">
        <Icon size={19} strokeWidth={isActive ? 2.4 : 2} />
      </span>

      {tip &&
        createPortal(
          <span
            role="tooltip"
            style={{ top: tip.top, left: tip.left }}
            className="pointer-events-none fixed z-[100] -translate-y-1/2 whitespace-nowrap rounded-lg bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground shadow-lg"
          >
            {label}
          </span>,
          document.body
        )}
    </Link>
  );
}
