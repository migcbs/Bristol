"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";

const MODULES = [
  { href: "/admin/admisiones", label: "Admisiones" },
  { href: "/admin/cobranzas", label: "Cobranzas" },
  { href: "/admin/reinscripciones", label: "Reinscripciones" },
  { href: "/admin/incidencias", label: "Incidencias" },
  { href: "/admin/comunicaciones", label: "Comunicaciones" },
  { href: "/admin/mercadotecnia", label: "Mercadotecnia" },
  { href: "/admin/recepcion/lista-espera", label: "Lista de Espera" },
  { href: "/admin/recepcion/agenda", label: "Agenda" },
  { href: "/admin/recepcion/bitacora", label: "Bitácora" },
  { href: "/admin/recepcion/grupos-disponibilidad", label: "Disponibilidad" },
  { href: "/admin/control-escolar/solicitudes", label: "Solicitudes" },
  { href: "/admin/tickets", label: "Tickets" },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-4 border-b border-border px-6 py-2 text-sm font-medium">
      {MODULES.map((mod) => (
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
