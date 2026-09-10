"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AuthLayout, GlassInputWrapper } from "@/components/ui/auth-layout";

export default function CambiarPasswordPage() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ currentPassword, newPassword }),
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "No pudimos cambiar tu contraseña.");
        return;
      }
      router.push("/portal");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      title={<span className="text-text">Crea tu contraseña</span>}
      description="Tu cuenta se creó con una contraseña temporal. Elige una nueva antes de continuar."
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="animate-element animate-delay-400">
          <label htmlFor="currentPassword" className="text-sm font-medium text-muted">
            Contraseña temporal
          </label>
          <GlassInputWrapper>
            <input
              id="currentPassword"
              name="currentPassword"
              type="password"
              placeholder="La contraseña que te dieron en recepción"
              autoComplete="current-password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full rounded-2xl bg-transparent p-4 text-sm text-text outline-none"
            />
          </GlassInputWrapper>
        </div>

        <div className="animate-element animate-delay-500">
          <label htmlFor="newPassword" className="text-sm font-medium text-muted">
            Nueva contraseña
          </label>
          <GlassInputWrapper>
            <input
              id="newPassword"
              name="newPassword"
              type="password"
              placeholder="Mínimo 8 caracteres"
              autoComplete="new-password"
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full rounded-2xl bg-transparent p-4 text-sm text-text outline-none"
            />
          </GlassInputWrapper>
        </div>

        {error && (
          <p role="alert" className="animate-element text-sm text-accent">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="animate-element animate-delay-600 w-full rounded-2xl bg-primary py-4 font-medium text-primary-foreground transition-all duration-150 ease-out hover:bg-primary-dark active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2"
        >
          {loading ? "Guardando..." : "Continuar"}
        </button>
      </form>
    </AuthLayout>
  );
}
