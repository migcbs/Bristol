"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useLandingChrome } from "./landing-chrome-context";
import { startLenis, stopLenis } from "@/lib/lenis-controller";

const LINKS = [
  { href: "#programas", label: "Programas" },
  { href: "#planteles", label: "Planteles" },
  { href: "#testimonials", label: "Reseñas" },
  { href: "#contact", label: "Contacto" },
];

export function MenuOverlay() {
  const { menuOpen, setMenuOpen, setContactOpen } = useLandingChrome();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!menuOpen) return;
    stopLenis();
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menuOpen]);

  function close() {
    setMenuOpen(false);
    startLenis();
  }

  function handleLinkClick(href: string) {
    close();
    document.querySelector(href)?.scrollIntoView({ behavior: "smooth" });
  }

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {menuOpen && (
        <div className="fixed inset-0 z-[70] flex flex-col">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
            onClick={close}
            className="absolute inset-0 bg-primary-dark"
          />
          <motion.div
            initial={{ opacity: 0, y: -24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="relative flex h-full flex-col p-6 text-white sm:p-10"
          >
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-base font-medium tracking-[0.2em] uppercase">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M4.8 5.6a9 9 0 0 0 0 12.8" />
                  <path d="M19.2 5.6a9 9 0 0 1 0 12.8" />
                </svg>
                Bristol
              </span>
              <button
                onClick={close}
                aria-label="Cerrar menú"
                className="group grid h-10 w-10 place-items-center rounded-full bg-white/15 transition-colors hover:bg-white/25"
              >
                <X size={18} className="transition-transform duration-300 group-hover:rotate-90" />
              </button>
            </div>

            <nav className="flex flex-1 flex-col justify-center gap-2">
              {LINKS.map((link, i) => (
                <motion.button
                  key={link.href}
                  initial={{ opacity: 0, y: 28 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.12 + i * 0.07, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                  onClick={() => handleLinkClick(link.href)}
                  className="block text-left text-5xl font-medium tracking-tight transition-colors hover:text-accent sm:text-7xl"
                >
                  {link.label}
                </motion.button>
              ))}
            </nav>

            <div className="flex flex-col gap-4 border-t border-white/15 pt-8 sm:flex-row sm:items-center sm:justify-between">
              <button
                onClick={() => {
                  close();
                  setContactOpen(true);
                }}
                className="inline-flex w-fit items-center gap-2 rounded-full bg-white px-7 py-3.5 text-sm font-medium tracking-wide text-primary uppercase transition-colors hover:bg-accent hover:text-white"
              >
                Solicitar información
              </button>
              <a href="/login" onClick={close} className="text-sm text-white/70 transition-colors hover:text-white">
                Iniciar sesión
              </a>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
