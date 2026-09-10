"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AuthLayout } from "@/components/ui/auth-layout";

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailForm />
    </Suspense>
  );
}

type Status = "idle" | "loading" | "success" | "error";

function VerifyEmailForm() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [status, setStatus] = useState<Status>("idle");

  async function verify() {
    setStatus("loading");
    try {
      const res = await fetch("/api/auth/verify-email", {
        method: "POST",
        body: JSON.stringify({ token }),
        headers: { "Content-Type": "application/json" },
      });
      setStatus(res.ok ? "success" : "error");
    } catch {
      setStatus("error");
    }
  }

  useEffect(() => {
    if (token) {
      verify();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <AuthLayout title={<span className="text-text">Verifica tu cuenta</span>}>
      <div className="animate-element animate-delay-300 space-y-5">
        {status === "success" && (
          <p className="text-sm font-medium text-primary">
            Tu correo fue verificado correctamente.
          </p>
        )}
        {status === "error" && (
          <p role="alert" className="text-sm text-accent">
            El enlace es inválido o expiró. Solicita uno nuevo.
          </p>
        )}
        {status === "loading" && <p className="text-sm text-muted">Verificando...</p>}
        {(status === "idle" || status === "error") && (
          <button
            type="button"
            onClick={verify}
            disabled={!token}
            className="w-full rounded-2xl bg-primary py-4 font-medium text-primary-foreground transition-all duration-150 ease-out hover:bg-primary-dark active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2"
          >
            Verificar correo
          </button>
        )}
        {status === "success" && (
          <a
            href="/login"
            className="block rounded text-center text-sm font-semibold text-accent transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
          >
            Ir a iniciar sesión
          </a>
        )}
      </div>
    </AuthLayout>
  );
}
