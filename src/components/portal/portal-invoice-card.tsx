"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PayButton } from "@/components/portal/pay-button";
import { InvoiceDetailModal, type InvoiceDetail } from "@/components/admin/invoice-detail-modal";
import { INVOICE_STATUS_LABELS, formatMoneyMXN } from "@/lib/invoice-status";

// The portal side of the same detail popup admin's Cobranzas got —
// confirmed with the user 2026-09-09 that clicking a cargo should
// actually tell you something (folio, desglose, fecha límite), not just
// show the one-line summary that was there before. The real "pay" action
// stays exactly what it already was — Stripe checkout via PayButton — this
// just makes the cargo's own detail visible before getting there.
export function PortalInvoiceCard({ invoice, canPay }: { invoice: InvoiceDetail; canPay: boolean }) {
  const [open, setOpen] = useState(false);
  const canShowPay = invoice.status === "PENDING" || invoice.status === "OVERDUE";

  return (
    <>
      <Card
        onClick={() => setOpen(true)}
        role="button"
        tabIndex={0}
        className="flex cursor-pointer items-center justify-between transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_28px_-18px_rgba(20,20,43,0.25)]"
      >
        <div>
          <p className="font-semibold">{invoice.conceptoNombre ?? invoice.description}</p>
          <p className="text-sm text-muted">Vence {invoice.dueDate.toLocaleDateString("es-MX")}</p>
          <p className="mt-1 text-lg font-bold text-primary">{formatMoneyMXN(invoice.amountCents)}</p>
        </div>
        <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
          <Badge tone="primary">{INVOICE_STATUS_LABELS[invoice.status]}</Badge>
          {canShowPay &&
            (canPay ? (
              <PayButton invoiceId={invoice.id} />
            ) : (
              <p className="text-xs text-muted">El pago debe realizarlo tu padre o tutor.</p>
            ))}
        </div>
      </Card>

      <InvoiceDetailModal
        open={open}
        onClose={() => setOpen(false)}
        invoice={invoice}
        payAction={canShowPay && canPay ? <PayButton invoiceId={invoice.id} /> : undefined}
      />
    </>
  );
}
