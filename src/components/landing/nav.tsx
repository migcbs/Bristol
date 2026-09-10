"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";

const SECTION_LINKS = [
  { href: "#programas", label: "Programas" },
  { href: "#planteles", label: "Planteles" },
];

const PAGE_LINKS = [
  { href: "/programas", label: "Programas" },
  { href: "/planteles", label: "Planteles" },
];

export function Nav() {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const links = isHome ? SECTION_LINKS : PAGE_LINKS;
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // On the home page, the nav floats transparent over the dark hero shader
  // until the user scrolls past it — then it becomes the same opaque white
  // bar every other page always uses.
  const transparent = isHome && !scrolled && !open;

  useEffect(() => {
    if (!isHome) return;
    function handleScroll() {
      setScrolled(window.scrollY > 64);
    }
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [isHome]);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <header
      className={`sticky top-0 z-50 transition-colors duration-300 ${
        transparent
          ? "border-b border-transparent bg-transparent"
          : open
            ? "border-b border-border bg-white"
            : "border-b border-border bg-white/85 backdrop-blur-md"
      }`}
    >
      <div className="mx-auto flex h-[72px] max-w-6xl items-center justify-between px-6">
        <Link
          href="/"
          className={`flex items-center gap-2 font-display text-xl font-bold transition-colors ${
            transparent ? "text-white" : "text-primary"
          }`}
        >
          Bristol
          <span className={`h-1.5 w-1.5 rounded-full transition-colors ${transparent ? "bg-white" : "bg-accent"}`} aria-hidden />
        </Link>
        <nav
          className={`hidden gap-8 text-sm font-medium md:flex ${transparent ? "text-white/80" : "text-muted"}`}
        >
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className={`relative py-1 transition-colors after:absolute after:-bottom-1 after:left-0 after:h-0.5 after:w-0 after:transition-all after:duration-200 hover:after:w-full ${
                transparent ? "hover:text-white after:bg-white" : "hover:text-primary after:bg-accent"
              }`}
            >
              {link.label}
            </a>
          ))}
        </nav>
        <div className="hidden md:block">
          <Link href="/login">
            {transparent ? (
              <span className="inline-flex items-center justify-center rounded-full bg-white px-6 py-3 text-sm font-semibold tracking-tight text-primary transition-all duration-200 ease-out hover:bg-white/90 active:scale-[0.97]">
                Iniciar sesión
              </span>
            ) : (
              <Button variant="outline">Iniciar sesión</Button>
            )}
          </Link>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={open ? "Cerrar menú" : "Abrir menú"}
          aria-controls="mobile-menu"
          className={`relative flex h-10 w-10 items-center justify-center rounded-full md:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
            transparent ? "text-white focus-visible:ring-white" : "text-primary focus-visible:ring-primary"
          }`}
        >
          <span
            className={`absolute h-0.5 w-6 rounded-full bg-current transition-all duration-300 ease-[cubic-bezier(0.76,0,0.24,1)] ${
              open ? "translate-y-0 rotate-45" : "-translate-y-1.5"
            }`}
          />
          <span
            className={`absolute h-0.5 w-6 rounded-full bg-current transition-all duration-300 ease-[cubic-bezier(0.76,0,0.24,1)] ${
              open ? "scale-x-0 opacity-0" : "scale-x-100 opacity-100"
            }`}
          />
          <span
            className={`absolute h-0.5 w-6 rounded-full bg-current transition-all duration-300 ease-[cubic-bezier(0.76,0,0.24,1)] ${
              open ? "translate-y-0 -rotate-45" : "translate-y-1.5"
            }`}
          />
        </button>
      </div>

      <div
        className={`fixed inset-0 z-40 md:hidden ${open ? "" : "pointer-events-none"}`}
      >
        <div
          onClick={() => setOpen(false)}
          aria-hidden
          className={`absolute inset-0 bg-black/20 backdrop-blur-sm transition-opacity duration-300 ${
            open ? "opacity-100" : "opacity-0"
          }`}
        />
        <nav
          id="mobile-menu"
          className={`absolute right-0 top-0 flex h-full w-[85%] max-w-sm flex-col justify-center gap-1 bg-white px-8 shadow-2xl transition-transform duration-500 ease-[cubic-bezier(0.76,0,0.24,1)] ${
            open ? "translate-x-0" : "translate-x-full"
          }`}
        >
          {links.map((link, i) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              style={{ transitionDelay: open ? `${100 + i * 60}ms` : "0ms" }}
              className={`py-2 font-display text-4xl font-bold text-primary transition-all duration-500 ease-[cubic-bezier(0.76,0,0.24,1)] hover:text-accent ${
                open ? "translate-x-0 opacity-100" : "translate-x-8 opacity-0"
              }`}
            >
              {link.label}
            </a>
          ))}
          <div
            style={{ transitionDelay: open ? "450ms" : "0ms" }}
            className={`mt-8 border-t border-border pt-8 transition-all duration-500 ease-[cubic-bezier(0.76,0,0.24,1)] ${
              open ? "translate-x-0 opacity-100" : "translate-x-8 opacity-0"
            }`}
          >
            <Link href="/login" onClick={() => setOpen(false)}>
              <Button variant="outline" className="w-full">
                Iniciar sesión
              </Button>
            </Link>
          </div>
        </nav>
      </div>
    </header>
  );
}
