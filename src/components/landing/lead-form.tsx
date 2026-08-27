"use client";

import { useState } from "react";
import { Section } from "@/components/ui/section";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LEAD_SOURCE_LABELS } from "@/lib/lead-source";
import type { LeadSource } from "@prisma/client";

export function LeadForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [source, setSource] = useState<LeadSource | "">("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setError(null);

    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        body: JSON.stringify({ name, email, phone: phone || undefined, source: source || undefined }),
        headers: { "Content-Type": "application/json" },
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

  return (
    <Section id="contacto">
      <div className="mx-auto grid max-w-5xl gap-10 rounded-3xl bg-primary p-2 md:grid-cols-2 md:p-3">
        <div className="flex flex-col justify-center px-6 py-10 text-primary-foreground md:px-10">
          <h2 className="font-display text-3xl font-bold md:text-4xl">
            Da el primer paso hoy
          </h2>
          <p className="mt-4 max-w-sm text-white/75">
            Déjanos tus datos y un asesor te contactará en menos de 24 horas
            para ubicarte en el nivel y plantel correctos.
          </p>
        </div>

        <Card className="m-2 md:m-3">
          <div aria-live="polite">
            {status === "sent" && (
              <p className="text-sm font-medium text-primary">
                ¡Gracias! Recibimos tu solicitud, pronto te contactaremos.
              </p>
            )}
          </div>
          {status !== "sent" && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="lead-name" className="text-sm font-medium text-muted">
                  Nombre completo
                </label>
                <Input
                  id="lead-name"
                  placeholder="Nombre completo"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="mt-1"
                />
              </div>
              <div>
                <label htmlFor="lead-email" className="text-sm font-medium text-muted">
                  Correo electrónico
                </label>
                <Input
                  id="lead-email"
                  type="email"
                  placeholder="Correo electrónico"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="mt-1"
                />
              </div>
              <div>
                <label htmlFor="lead-phone" className="text-sm font-medium text-muted">
                  Teléfono (opcional)
                </label>
                <Input
                  id="lead-phone"
                  type="tel"
                  placeholder="Teléfono (opcional)"
                  autoComplete="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <label htmlFor="lead-source" className="text-sm font-medium text-muted">
                  ¿Cómo te enteraste de nosotros?
                </label>
                <select
                  id="lead-source"
                  value={source}
                  onChange={(e) => setSource(e.target.value as LeadSource | "")}
                  className="mt-1 w-full rounded-xl border border-border px-4 py-3 text-sm outline-none transition-shadow duration-150 focus:border-primary focus:ring-2 focus:ring-primary/30"
                >
                  <option value="">Selecciona una opción</option>
                  {Object.entries(LEAD_SOURCE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              {error && (
                <p role="alert" className="text-sm text-accent-dark">
                  {error}
                </p>
              )}
              <Button type="submit" variant="accent" className="w-full" disabled={status === "sending"}>
                {status === "sending" ? "Enviando..." : "Solicitar informes"}
              </Button>
            </form>
          )}
        </Card>
      </div>
    </Section>
  );
}
