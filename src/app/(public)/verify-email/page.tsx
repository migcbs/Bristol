"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

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
    <main className="flex min-h-screen items-center justify-center bg-surface px-4">
      <Card className="w-full max-w-sm text-center">
        <h1 className="mb-4 text-xl font-bold text-primary">Verifica tu cuenta</h1>
        {status === "success" && (
          <p className="text-sm text-primary">Tu correo fue verificado correctamente.</p>
        )}
        {status === "error" && (
          <p className="text-sm text-accent">
            El enlace es inválido o expiró. Solicita uno nuevo.
          </p>
        )}
        {status === "loading" && <p className="text-sm">Verificando...</p>}
        {(status === "idle" || status === "error") && (
          <Button className="mt-4 w-full" onClick={verify} disabled={!token}>
            Verificar correo
          </Button>
        )}
      </Card>
    </main>
  );
}
