"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X, Check } from "lucide-react";
import { useLandingChrome } from "./landing-chrome-context";
import { ClipLines } from "./clip-reveal";
import { Eyebrow } from "./eyebrow";
import { startLenis, stopLenis } from "@/lib/lenis-controller";

// Unlike the reference design's stub, this actually posts to the school's
// real lead-capture endpoint (the same one src/components/landing/lead-form.tsx
// uses) — Bristol has a working backend for this, so a fake no-op submit
// would be a step down, not a faithful recreation.
export function ContactModal() {
  const { contactOpen, setContactOpen } = useLandingChrome();
  const [mounted, setMounted] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!contactOpen) return;
    stopLenis();
    const focusTimer = setTimeout(() => nameRef.current?.focus(), 120);
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      clearTimeout(focusTimer);
      document.removeEventListener("keydown", onKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactOpen]);

  function close() {
    setContactOpen(false);
    startLenis();
    setTimeout(() => {
      setName("");
      setEmail("");
      setMessage("");
      setStatus("idle");
      setError(null);
    }, 350);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setError(null);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, message: message || undefined, source: "WEB" }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "No pudimos enviar tu solicitud. Intenta de nuevo.");
        setStatus("error");
        return;
      }
      setStatus("sent");
    } catch {
      setError("No pudimos enviar tu solicitud. Verifica tu conexión e intenta de nuevo.");
      setStatus("error");
    }
  }

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {contactOpen && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center p-3 sm:items-center sm:p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            onClick={close}
            className="absolute inset-0 bg-primary-dark/40 backdrop-blur-sm"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            initial={{ opacity: 0, y: 28, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.97 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="relative max-h-[92svh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-6 text-text shadow-2xl sm:p-8"
          >
            {status === "sent" ? (
              <div className="mt-2 rounded-2xl bg-surface p-6 text-center">
                <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-primary text-white">
                  <Check size={22} />
                </div>
                <p className="mt-4 text-lg font-medium text-primary">Solicitud recibida</p>
                <p className="mt-1 text-sm text-muted">
                  Gracias, {name.split(" ")[0] || "estimado(a)"} — un asesor te contactará pronto.
                </p>
                <button
                  onClick={close}
                  className="mt-6 rounded-full bg-text px-7 py-3 text-sm font-medium tracking-wide text-white uppercase transition-colors hover:bg-primary-dark"
                >
                  Listo
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between">
                  <div>
                    <Eyebrow>Solicita información</Eyebrow>
                    <ClipLines
                      lines={["Ven a conocer", "los planteles"]}
                      className="mt-3 text-4xl font-medium tracking-tight text-primary sm:text-5xl"
                      gate="immediate"
                      stagger={0.09}
                      duration={0.8}
                    />
                  </div>
                  <button
                    onClick={close}
                    aria-label="Cerrar"
                    className="group grid h-10 w-10 shrink-0 place-items-center rounded-full bg-surface transition-colors hover:bg-border"
                  >
                    <X size={18} className="transition-transform duration-300 group-hover:rotate-90" />
                  </button>
                </div>

                <form onSubmit={handleSubmit} noValidate className="mt-7 flex flex-col gap-4">
                  <div>
                    <label htmlFor="contact-name" className="text-xs font-medium tracking-[0.18em] text-muted uppercase">
                      Nombre completo
                    </label>
                    <input
                      ref={nameRef}
                      id="contact-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Alex Rivera"
                      required
                      maxLength={120}
                      className="mt-1.5 w-full rounded-xl border border-border bg-white px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                  <div>
                    <label htmlFor="contact-email" className="text-xs font-medium tracking-[0.18em] text-muted uppercase">
                      Correo
                    </label>
                    <input
                      id="contact-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="tu@correo.com"
                      required
                      maxLength={254}
                      className="mt-1.5 w-full rounded-xl border border-border bg-white px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                  <div>
                    <label htmlFor="contact-message" className="text-xs font-medium tracking-[0.18em] text-muted uppercase">
                      ¿Qué te gustaría estudiar?
                    </label>
                    <textarea
                      id="contact-message"
                      rows={3}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Ej. quiero inscribir a mi hijo de 10 años, o retomar mi inglés para el trabajo…"
                      maxLength={2000}
                      className="mt-1.5 w-full rounded-xl border border-border bg-white px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                  {error && (
                    <p role="alert" className="text-sm text-accent-dark">
                      {error}
                    </p>
                  )}
                  <button
                    type="submit"
                    disabled={status === "sending"}
                    className="mt-1 rounded-full bg-text px-7 py-3.5 text-sm font-medium tracking-wide text-white uppercase transition-colors hover:bg-primary-dark disabled:opacity-60"
                  >
                    {status === "sending" ? "Enviando…" : "Solicitar información"}
                  </button>
                </form>
              </>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
