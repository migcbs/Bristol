"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";

const SECTION_LINKS = [
  { href: "#programas", label: "Programas" },
  { href: "#planteles", label: "Planteles" },
  { href: "#precios", label: "Precios" },
];

const PAGE_LINKS = [
  { href: "/programas", label: "Programas" },
  { href: "/planteles", label: "Planteles" },
  { href: "/precios", label: "Precios" },
];

export function Nav() {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const links = isHome ? SECTION_LINKS : PAGE_LINKS;
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-white/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2 font-display text-xl font-bold text-primary">
          Bristol
          <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />
        </Link>
        <nav className="hidden gap-8 text-sm font-medium text-muted md:flex">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="relative py-1 transition-colors hover:text-primary after:absolute after:-bottom-1 after:left-0 after:h-0.5 after:w-0 after:bg-accent after:transition-all after:duration-200 hover:after:w-full"
            >
              {link.label}
            </a>
          ))}
        </nav>
        <div className="hidden md:block">
          <Link href="/login">
            <Button variant="outline">Iniciar sesión</Button>
          </Link>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={open ? "Cerrar menú" : "Abrir menú"}
          aria-controls="mobile-menu"
          className="flex h-10 w-10 items-center justify-center rounded-full text-primary md:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            {open ? <path d="M6 6 18 18M6 18 18 6" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
        </button>
      </div>

      {open && (
        <nav id="mobile-menu" className="flex flex-col gap-1 border-t border-border bg-white px-6 py-4 md:hidden">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="rounded-lg px-2 py-3 text-base font-medium text-muted transition-colors hover:bg-surface hover:text-primary"
            >
              {link.label}
            </a>
          ))}
          <Link href="/login" onClick={() => setOpen(false)} className="mt-2">
            <Button variant="outline" className="w-full">
              Iniciar sesión
            </Button>
          </Link>
        </nav>
      )}
    </header>
  );
}
