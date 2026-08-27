"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";

const MODULES = [
  { href: "/admin/admisiones", label: "Admisiones" },
  { href: "/admin/cobranzas", label: "Cobranzas" },
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
