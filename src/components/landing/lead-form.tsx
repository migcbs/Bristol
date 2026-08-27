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
      <Card className="mx-auto max-w-lg">
        <h2 className="text-2xl font-bold text-primary">Solicita informes</h2>
        <p className="mt-2 text-sm text-gray-600">
          Déjanos tus datos y un asesor te contactará en menos de 24 horas.
        </p>
        {status === "sent" ? (
          <p className="mt-6 text-sm font-medium text-primary">
            ¡Gracias! Recibimos tu solicitud, pronto te contactaremos.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
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
    </Section>
  );
}
