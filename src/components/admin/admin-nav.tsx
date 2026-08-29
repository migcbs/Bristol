"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";

const MODULES = [
  { href: "/admin/admisiones", label: "Admisiones", module: "admisiones" },
  { href: "/admin/cobranzas", label: "Cobranzas", module: "cobranzas" },
  { href: "/admin/reinscripciones", label: "Reinscripciones", module: "reinscripciones" },
  { href: "/admin/incidencias", label: "Incidencias", module: "incidencias" },
  { href: "/admin/comunicaciones", label: "Comunicaciones", module: "comunicaciones" },
  { href: "/admin/mercadotecnia", label: "Mercadotecnia", module: "mercadotecnia" },
  { href: "/admin/recepcion/lista-espera", label: "Lista de Espera", module: "lista_espera" },
  { href: "/admin/recepcion/agenda", label: "Agenda", module: "agenda" },
  { href: "/admin/recepcion/bitacora", label: "Bitácora", module: "bitacora" },
  { href: "/admin/recepcion/grupos-disponibilidad", label: "Disponibilidad", module: "disponibilidad" },
  { href: "/admin/control-escolar/solicitudes", label: "Solicitudes", module: "solicitudes" },
  { href: "/admin/tickets", label: "Tickets", module: "tickets" },
] as const;

export function AdminNav({ visibleModules }: { visibleModules: Set<string> }) {
  const pathname = usePathname();
  const visible = MODULES.filter((mod) => visibleModules.has(mod.module));

  return (
    <nav className="flex gap-4 border-b border-border px-6 py-2 text-sm font-medium">
      {visible.map((mod) => (
        <Link
          key={mod.href}
          href={mod.href}
          className={clsx(
            "rounded-md px-3 py-1.5 transition-colors",
            pathname.startsWith(mod.href)
              ? "bg-primary text-primary-foreground"
              : "text-muted hover:bg-surface hover:text-primary"
          )}
        >
          {mod.label}
        </Link>
      ))}
    </nav>
  );
}
