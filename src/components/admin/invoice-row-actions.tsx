"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CircleDollarSign, Receipt, Send } from "lucide-react";
import { IconActionButton } from "@/components/ui/icon-action-button";

export function InvoiceRowActions({
  invoiceId,
  status,
  reciboFiscalEnviado,
  canCollect,
}: {
  invoiceId: string;
  status: "PENDING" | "PAID" | "OVERDUE" | "CANCELED";
  reciboFiscalEnviado: boolean;
  // Recepción can initiate a charge but not collect it — only Caja
  // ("full" on cobranzas) can mark a charge paid or send its receipt.
  canCollect: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<"pay" | "recibo" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function markPaid() {
    setLoading("pay");
    setError(null);
    const res = await fetch(`/api/admin/invoices/${invoiceId}`, {
      method: "PATCH",
      body: JSON.stringify({ action: "mark-paid" }),
      headers: { "Content-Type": "application/json" },
    });
    setLoading(null);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "No se pudo marcar como pagado");
      return;
    }
    router.refresh();
  }

  async function enviarRecibo() {
    setLoading("recibo");
    setError(null);
    const res = await fetch(`/api/admin/invoices/${invoiceId}/enviar-recibo`, { method: "POST" });
    setLoading(null);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "No se pudo enviar el recibo");
      return;
    }
    router.refresh();
  }

  if (!canCollect) return null;

  if (status === "PENDING" || status === "OVERDUE") {
    return (
      <div className="flex flex-col items-end gap-1">
        <IconActionButton
          icon={CircleDollarSign}
          label={loading === "pay" ? "Marcando..." : "Marcar pagada"}
          onClick={markPaid}
          disabled={loading === "pay"}
        />
        {error && <p className="w-24 text-right text-[10px] text-accent-dark">{error}</p>}
      </div>
    );
  }

  if (status === "PAID") {
    return (
      <div className="flex flex-col items-end gap-1">
        <Link
          href={`/admin/cobranzas/${invoiceId}/recibo`}
          aria-label="Ver recibo"
          title="Ver recibo"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface text-muted transition-colors hover:bg-primary/10 hover:text-primary"
        >
          <Receipt size={16} />
        </Link>
        <IconActionButton
          icon={Send}
          label={loading === "recibo" ? "Enviando..." : reciboFiscalEnviado ? "Reenviar recibo" : "Enviar recibo"}
          onClick={enviarRecibo}
          disabled={loading === "recibo"}
        />
        {error && <p className="w-24 text-right text-[10px] text-accent-dark">{error}</p>}
      </div>
    );
  }

  return null;
}
