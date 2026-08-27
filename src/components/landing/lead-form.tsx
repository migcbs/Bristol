"use client";

import { useState } from "react";
import { Section } from "@/components/ui/section";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function LeadForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setError(null);

    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        body: JSON.stringify({ name, email, phone: phone || undefined }),
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
          {status === "sent" ? (
            <p className="text-sm font-medium text-primary">
              ¡Gracias! Recibimos tu solicitud, pronto te contactaremos.
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                placeholder="Nombre completo"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
              <Input
                type="email"
                placeholder="Correo electrónico"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <Input
                type="tel"
                placeholder="Teléfono (opcional)"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
              {error && <p className="text-sm text-accent">{error}</p>}
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
