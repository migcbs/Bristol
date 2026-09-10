"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function LeaveReviewForm() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [quote, setQuote] = useState("");
  const [website, setWebsite] = useState(""); // honeypot — must stay empty
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setError(null);

    try {
      const res = await fetch("/api/public/testimonials", {
        method: "POST",
        body: JSON.stringify({ name, role: role || undefined, quote, website }),
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "No pudimos enviar tu reseña. Intenta de nuevo.");
        setStatus("error");
        return;
      }

      setStatus("sent");
    } catch {
      setError("No pudimos enviar tu reseña. Verifica tu conexión e intenta de nuevo.");
      setStatus("error");
    }
  }

  function handleClose() {
    setOpen(false);
    // Reset so a second visit to the form starts clean, whether it was sent
    // or abandoned.
    setName("");
    setRole("");
    setQuote("");
    setStatus("idle");
    setError(null);
  }

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        Dejar una reseña
      </Button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={handleClose}
          role="presentation"
        >
          <div
            className="w-full max-w-md rounded-2xl border border-border bg-white p-8 shadow-xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="review-form-heading"
          >
            {status === "sent" ? (
              <>
                <h2 id="review-form-heading" className="font-display text-xl font-bold text-primary">
                  ¡Gracias por tu reseña!
                </h2>
                <p className="mt-3 text-muted">
                  La revisaremos antes de publicarla en el sitio.
                </p>
                <Button variant="outline" className="mt-6 w-full" onClick={handleClose}>
                  Cerrar
                </Button>
              </>
            ) : (
              <>
                <h2 id="review-form-heading" className="font-display text-xl font-bold text-primary">
                  Comparte tu experiencia
                </h2>
                <p className="mt-2 text-sm text-muted">
                  Tu reseña se publicará después de que la revisemos.
                </p>
                <form onSubmit={handleSubmit} className="mt-5 space-y-4">
                  <div>
                    <label htmlFor="review-name" className="text-sm font-medium text-muted">
                      Nombre
                    </label>
                    <Input
                      id="review-name"
                      placeholder="Tu nombre"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      maxLength={120}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label htmlFor="review-role" className="text-sm font-medium text-muted">
                      ¿Cómo te describirías? (opcional)
                    </label>
                    <Input
                      id="review-role"
                      placeholder="Ej. Alumna, nivel B2 / Padre de familia"
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      maxLength={120}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label htmlFor="review-quote" className="text-sm font-medium text-muted">
                      Tu reseña
                    </label>
                    <textarea
                      id="review-quote"
                      placeholder="Cuéntanos tu experiencia en Bristol"
                      value={quote}
                      onChange={(e) => setQuote(e.target.value)}
                      required
                      minLength={10}
                      maxLength={600}
                      rows={4}
                      className="mt-1 w-full rounded-xl border border-border px-4 py-3 text-sm outline-none transition-shadow duration-150 placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                  {/* Honeypot — hidden from real visitors (off-screen, not display:none
                      so it still shows up to naive bots that fill every visible-in-DOM
                      field), never rendered to sighted or screen-reader users. */}
                  <div className="absolute -left-[9999px]" aria-hidden="true">
                    <input
                      type="text"
                      name="website"
                      tabIndex={-1}
                      autoComplete="off"
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                    />
                  </div>
                  {error && (
                    <p role="alert" className="text-sm text-accent-dark">
                      {error}
                    </p>
                  )}
                  <div className="flex gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1"
                      onClick={handleClose}
                    >
                      Cancelar
                    </Button>
                    <Button type="submit" variant="accent" className="flex-1" disabled={status === "sending"}>
                      {status === "sending" ? "Enviando..." : "Enviar"}
                    </Button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
