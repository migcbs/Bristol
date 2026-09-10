"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { AuthLayout, GlassInputWrapper } from "@/components/ui/auth-layout";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}

function ResetPasswordForm() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, password }),
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        setError("El enlace es inválido o expiró. Solicita uno nuevo.");
        return;
      }
      router.push("/login");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      title={<span className="text-text">Nueva contraseña</span>}
      description="Elige una contraseña nueva para tu cuenta."
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="animate-element animate-delay-400">
          <label htmlFor="password" className="text-sm font-medium text-muted">
            Nueva contraseña
          </label>
          <GlassInputWrapper>
            <input
              id="password"
              name="password"
              type="password"
              placeholder="Tu nueva contraseña"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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
          className="animate-element animate-delay-500 w-full rounded-2xl bg-primary py-4 font-medium text-primary-foreground transition-all duration-150 ease-out hover:bg-primary-dark active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2"
        >
          {loading ? "Restableciendo..." : "Restablecer contraseña"}
        </button>
      </form>
    </AuthLayout>
  );
}
