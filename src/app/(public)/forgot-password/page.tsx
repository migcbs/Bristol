"use client";

import { useState } from "react";
import { AuthLayout, GlassInputWrapper } from "@/components/ui/auth-layout";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch("/api/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email }),
        headers: { "Content-Type": "application/json" },
      });
      setSent(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      title={<span className="text-text">Recuperar contraseña</span>}
      description={
        sent
          ? undefined
          : "Ingresa tu correo y te enviaremos instrucciones para restablecer tu contraseña."
      }
    >
      {sent ? (
        <p className="animate-element animate-delay-300 text-sm text-muted">
          Si el correo existe en Bristol, te enviamos instrucciones para
          restablecer tu contraseña.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="animate-element animate-delay-400">
            <label htmlFor="email" className="text-sm font-medium text-muted">
              Correo electrónico
            </label>
            <GlassInputWrapper>
              <input
                id="email"
                name="email"
                type="email"
                placeholder="tucorreo@ejemplo.com"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-2xl bg-transparent p-4 text-sm text-text outline-none"
              />
            </GlassInputWrapper>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="animate-element animate-delay-500 w-full rounded-2xl bg-primary py-4 font-medium text-primary-foreground transition-all duration-150 ease-out hover:bg-primary-dark active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2"
          >
            {loading ? "Enviando..." : "Enviar instrucciones"}
          </button>

          <p className="animate-element animate-delay-600 text-center text-sm text-muted">
            <a
              href="/login"
              className="rounded font-semibold text-accent transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
            >
              Volver a iniciar sesión
            </a>
          </p>
        </form>
      )}
    </AuthLayout>
  );
}
