"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { clsx } from "clsx";
import { Home } from "lucide-react";
import { ADMIN_MODULES } from "@/lib/admin-modules";
import { SidebarNavIcon } from "@/components/ui/sidebar-nav-icon";

// Lateral icon rail on desktop/tablet — replaces the old horizontal pill
// capsule, which had no graceful overflow behavior for 10+ items
// (confirmed by the user 2026-09-09: "todas las barras de navegación...
// debe ser lateral, con iconos... y con un hover que diga a qué sección se
// trata"). Each icon shows its label in a small tooltip on hover instead
// of an always-visible label, so the rail stays a slim, glanceable strip
// no matter how many modules an área has. Mobile keeps the existing
// bottom tab bar (icon + label, horizontally scrollable) — already the
// most accessible pattern for a phone, per the BOOZ-modeled rework done
// earlier the same day; this change only touches the desktop shape.
export function AdminNav({ visibleModules }: { visibleModules: Set<string> }) {
  const pathname = usePathname();
  const shouldReduceMotion = useReducedMotion();
  const visible = ADMIN_MODULES.filter((mod) => visibleModules.has(mod.module));

  // Some hrefs are prefixes of others (e.g. /admin/comunicaciones and
  // /admin/comunicaciones/resenas) — only the longest matching href should
  // light up, not every ancestor.
  const matches = visible.filter(
    (mod) => pathname === mod.href || pathname.startsWith(`${mod.href}/`)
  );
  const activeHref = matches.reduce<string | null>(
    (best, mod) => (!best || mod.href.length > best.length ? mod.href : best),
    null
  );
  const isHome = pathname === "/admin";

  return (
    <>
      {/* Desktop / tablet: a fixed-width icon rail. The active item's
          background is a shared-layout element (layoutId) that slides
          between links instead of just swapping color — the same spring
          motion language as the rest of the app. */}
      <nav className="no-scrollbar sticky top-0 hidden max-h-screen w-16 shrink-0 flex-col items-center gap-1 overflow-y-auto border-r border-border bg-white py-4 md:flex">
        <SidebarNavIcon
          href="/admin"
          label="Inicio"
          icon={Home}
          isActive={isHome}
          layoutId="admin-nav-active-pill"
          shouldReduceMotion={!!shouldReduceMotion}
        />
        <div className="my-1 h-px w-8 bg-border" />
        {visible.map((mod) => (
          <SidebarNavIcon
            key={mod.href}
            href={mod.href}
            label={mod.label}
            icon={mod.icon}
            isActive={mod.href === activeHref}
            layoutId="admin-nav-active-pill"
            shouldReduceMotion={!!shouldReduceMotion}
          />
        ))}
      </nav>

      {/* Mobile: a fixed bottom tab bar, icon + label, horizontally
          scrollable — modeled on BOOZ's CoachLayout (.cl-bottom-nav). Never
          wraps; overflow scrolls instead. See main's pb-24 in
          admin/layout.tsx, which reserves room for this bar. */}
      <nav className="no-scrollbar fixed inset-x-0 bottom-0 z-40 flex gap-1 overflow-x-auto border-t border-border bg-white/95 px-2 py-1.5 backdrop-blur-sm md:hidden">
        <Link
          href="/admin"
          className={clsx(
            "relative flex min-w-[68px] flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 text-center transition-colors",
            isHome ? "text-primary" : "text-muted"
          )}
        >
          <Home size={18} strokeWidth={isHome ? 2.4 : 2} />
          <span className="text-[10px] leading-tight font-medium text-wrap">Inicio</span>
          {isHome && (
            <motion.span
              layoutId="admin-nav-active-dot"
              transition={shouldReduceMotion ? { duration: 0 } : { type: "spring", stiffness: 380, damping: 32 }}
              className="absolute -bottom-0.5 h-1 w-1 rounded-full bg-primary"
            />
          )}
        </Link>
        {visible.map((mod) => {
          const Icon = mod.icon;
          const isActive = mod.href === activeHref;
          return (
            <Link
              key={mod.href}
              href={mod.href}
              className={clsx(
                "relative flex min-w-[68px] flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 text-center transition-colors",
                isActive ? "text-primary" : "text-muted"
              )}
            >
              <Icon size={18} strokeWidth={isActive ? 2.4 : 2} />
              <span className="text-[10px] leading-tight font-medium text-wrap">{mod.label}</span>
              {isActive && (
                <motion.span
                  layoutId="admin-nav-active-dot"
                  transition={shouldReduceMotion ? { duration: 0 } : { type: "spring", stiffness: 380, damping: 32 }}
                  className="absolute -bottom-0.5 h-1 w-1 rounded-full bg-primary"
                />
              )}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
