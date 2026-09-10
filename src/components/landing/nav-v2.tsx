"use client";

import Link from "next/link";
import { User } from "lucide-react";
import { useLandingChrome } from "./landing-chrome-context";

// The header lives inside the hero, transparent over the shader — there's
// no separate sticky nav bar on the new landing (matches the reference
// design's "header inside the hero" structure). Other pages (/login,
// /programas, /planteles) keep the original always-visible Nav component
// untouched.
export function NavHeader() {
  const { setMenuOpen, setContactOpen } = useLandingChrome();

  return (
    <header className="relative z-20 flex items-center px-6 pt-6 text-xs text-white sm:px-10 sm:pt-8">
      <nav className="hidden flex-1 gap-8 lg:flex">
        <a href="#programas" className="text-white/90 transition-colors hover:text-white">
          Programas y profesores
        </a>
        <a href="#planteles" className="text-white/90 transition-colors hover:text-white">
          Planteles y eventos
        </a>
      </nav>

      <Link
        href="/"
        className="flex flex-1 items-center justify-center gap-2 text-base font-medium tracking-[0.2em] uppercase lg:justify-center"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <circle cx="12" cy="12" r="9" />
          <path d="M4.8 5.6a9 9 0 0 0 0 12.8" />
          <path d="M19.2 5.6a9 9 0 0 1 0 12.8" />
        </svg>
        Bristol
      </Link>

      <div className="flex flex-1 items-center justify-end gap-4 sm:gap-5">
        <button
          type="button"
          onClick={() => setContactOpen(true)}
          className="hidden text-xs font-medium tracking-wide text-white/90 uppercase underline-offset-4 hover:text-white hover:underline sm:inline"
        >
          Solicitar información
        </button>
        {/* Login as a visible user-icon button — confirmed with the user
            2026-09-09: "el botón de iniciar sesión debe ser un icono de
            user que quede con la interfáz y que sea muy visible". Same
            circular chrome as the burger so it reads as part of the set. */}
        <Link
          href="/login"
          aria-label="Iniciar sesión"
          title="Iniciar sesión"
          className="grid h-10 w-10 place-items-center rounded-full bg-white/15 text-white backdrop-blur-sm transition-colors hover:bg-white/25"
        >
          <User size={18} strokeWidth={2} />
        </Link>
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          aria-label="Abrir menú"
          className="grid h-10 w-10 place-items-center rounded-full bg-white/15 backdrop-blur-sm transition-colors hover:bg-white/25"
        >
          <span className="flex flex-col gap-[5px]">
            <span className="h-px w-4 bg-white" />
            <span className="h-px w-4 bg-white" />
          </span>
        </button>
      </div>
    </header>
  );
}
