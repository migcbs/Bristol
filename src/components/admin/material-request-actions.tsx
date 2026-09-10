"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { IconActionButton } from "@/components/ui/icon-action-button";

export function MaterialRequestActions({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState<"APROBADA" | "RECHAZADA" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function decide(decision: "APROBADA" | "RECHAZADA") {
    setLoading(decision);
    setError(null);
    const res = await fetch(`/api/admin/material-access-requests/${requestId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision }),
    });
    setLoading(null);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "No se pudo procesar la solicitud");
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <IconActionButton icon={Check} label="Aprobar" onClick={() => decide("APROBADA")} disabled={loading !== null} />
      <IconActionButton
        icon={X}
        label="Rechazar"
        tone="danger"
        onClick={() => decide("RECHAZADA")}
        disabled={loading !== null}
      />
      {error && <p className="w-24 text-right text-[10px] text-accent-dark">{error}</p>}
    </div>
  );
}
