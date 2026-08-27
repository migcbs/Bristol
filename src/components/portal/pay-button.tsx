"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function PayButton({ invoiceId }: { invoiceId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePay() {
    setLoading(true);
    setError(null);

    const res = await fetch(`/api/invoices/${invoiceId}/checkout`, { method: "POST" });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "No se pudo iniciar el pago");
      setLoading(false);
      return;
    }

    const { url } = await res.json();
    if (!url) {
      setError("No se pudo iniciar el pago");
      setLoading(false);
      return;
    }
    window.location.href = url;
  }

  return (
    <div>
      <Button variant="accent" onClick={handlePay} disabled={loading}>
        {loading ? "Redirigiendo..." : "Pagar"}
      </Button>
      {error && <p className="mt-1 text-xs text-accent-dark">{error}</p>}
    </div>
  );
}
