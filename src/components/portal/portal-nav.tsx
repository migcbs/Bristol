"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { clsx } from "clsx";
import { Home, Wallet, CalendarCheck, AlertTriangle, MessageSquare, Clock, BookOpen, Library, GraduationCap, FileText, type LucideIcon } from "lucide-react";
import { SidebarNavIcon } from "@/components/ui/sidebar-nav-icon";

// `roles` omitted means visible to every portal role (student/parent/
// teacher alike). Asistencia/Incidencias/Biblioteca are TEACHER-only pages
// (each redirects a non-TEACHER back to /portal) — Biblioteca already had
// its `roles` restriction, but Asistencia and Incidencias didn't, so
// STUDENT/PARENT saw both pills in nav only to bounce off a redirect when
// clicked. Fixed 2026-09-09 alongside the rest of the portal dashboard
// work, same declutter rule already applied to AdminNav.
// `icon` feeds the mobile bottom bar only — see AdminNav for the same
// pattern (modeled on BOOZ's CoachLayout).
const MODULES: { href: string; label: string; roles?: string[]; icon: LucideIcon }[] = [
  // Cobranzas is for whoever pays — the alumno (if adult) and the tutor —
  // not the maestro. Confirmed with the user 2026-09-09.
  { href: "/portal/cobranzas", label: "Cobranzas", roles: ["STUDENT", "PARENT"], icon: Wallet },
  { href: "/portal/asistencia", label: "Asistencia", roles: ["TEACHER"], icon: CalendarCheck },
  { href: "/portal/incidencias", label: "Incidencias", roles: ["TEACHER"], icon: AlertTriangle },
  { href: "/portal/solicitudes", label: "Solicitudes", roles: ["TEACHER"], icon: FileText },
  { href: "/portal/comunicaciones", label: "Comunicaciones", icon: MessageSquare },
  { href: "/portal/horario", label: "Horario", icon: Clock },
  { href: "/portal/materiales", label: "Materiales", icon: BookOpen },
  { href: "/portal/biblioteca", label: "Biblioteca", roles: ["TEACHER"], icon: Library },
  { href: "/portal/calificaciones", label: "Calificaciones", icon: GraduationCap },
];

// Lateral icon rail on desktop/tablet, same treatment as AdminNav — see
// that file's comment for the full reasoning (2026-09-09: "todas las
// barras de navegación... debe ser lateral, con iconos... con un hover que
// diga a qué sección se trata"). Mobile keeps the existing bottom tab bar.
export function PortalNav({ role }: { role?: string }) {
  const pathname = usePathname();
  const shouldReduceMotion = useReducedMotion();
  const visible = MODULES.filter((mod) => !mod.roles || (role && mod.roles.includes(role)));
  const isHome = pathname === "/portal";

  return (
    <>
      <nav className="no-scrollbar sticky top-0 hidden max-h-screen w-16 shrink-0 flex-col items-center gap-1 overflow-y-auto border-r border-border bg-white py-4 md:flex">
        <SidebarNavIcon
          href="/portal"
          label="Inicio"
          icon={Home}
          isActive={isHome}
          layoutId="portal-nav-active-pill"
          shouldReduceMotion={!!shouldReduceMotion}
        />
        <div className="my-1 h-px w-8 bg-border" />
        {visible.map((mod) => (
          <SidebarNavIcon
            key={mod.href}
            href={mod.href}
            label={mod.label}
            icon={mod.icon}
            isActive={pathname === mod.href || pathname.startsWith(`${mod.href}/`)}
            layoutId="portal-nav-active-pill"
            shouldReduceMotion={!!shouldReduceMotion}
          />
        ))}
      </nav>

      {/* Mobile: fixed bottom tab bar, never wraps — see main's pb-24 in
          portal/layout.tsx, which reserves room for this bar. */}
      <nav className="no-scrollbar fixed inset-x-0 bottom-0 z-40 flex gap-1 overflow-x-auto border-t border-border bg-white/95 px-2 py-1.5 backdrop-blur-sm md:hidden">
        <Link
          href="/portal"
          className={clsx(
            "relative flex min-w-[68px] flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 text-center transition-colors",
            isHome ? "text-primary" : "text-muted"
          )}
        >
          <Home size={18} strokeWidth={isHome ? 2.4 : 2} />
          <span className="text-[10px] leading-tight font-medium text-wrap">Inicio</span>
          {isHome && (
            <motion.span
              layoutId="portal-nav-active-dot"
              transition={shouldReduceMotion ? { duration: 0 } : { type: "spring", stiffness: 380, damping: 32 }}
              className="absolute -bottom-0.5 h-1 w-1 rounded-full bg-primary"
            />
          )}
        </Link>
        {visible.map((mod) => {
          const Icon = mod.icon;
          const isActive = pathname.startsWith(mod.href);
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
                  layoutId="portal-nav-active-dot"
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
