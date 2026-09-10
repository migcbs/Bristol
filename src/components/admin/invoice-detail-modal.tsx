"use client";

import { Modal } from "@/components/ui/modal";
import { Tag } from "@/components/ui/tag";
import { INVOICE_STATUS_LABELS, formatMoneyMXN } from "@/lib/invoice-status";
import type { InvoiceStatus } from "@prisma/client";

export interface InvoiceDetail {
  id: string;
  description: string;
  conceptoNombre: string | null;
  amountCents: number;
  baseCents: number | null;
  scholarshipPercent: number | null;
  earlyPaymentDiscountCents: number | null;
  dueDate: Date;
  paidAt: Date | null;
  status: InvoiceStatus;
  reciboFiscalEnviado: boolean;
  reciboFiscalEnviadoAt: Date | null;
  student: { id: string; user: { name: string; email: string } };
  parentLinks: { parent: { name: string; email: string } }[];
}

const STATUS_TAG_TONE: Record<InvoiceStatus, "amber" | "red" | "green" | "gray"> = {
  PENDING: "amber",
  OVERDUE: "red",
  PAID: "green",
  CANCELED: "gray",
};

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border py-2 text-sm last:border-0">
      <span className="text-muted">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

// The detail popup that was missing entirely before — confirmed with the
// user 2026-09-09: "si entro al perfil que tiene el cargo no me dice
// nada". Shown from both the admin Cobranzas card grid and the portal
// Cobranzas list, so a cargo means the same thing to Caja and to the
// alumno/padre looking at it.
//
// "Folio de pago" here is a stable reference derived from the invoice id
// (not a bank-issued "línea de captura") — Bristol's real payment path is
// the Stripe checkout already wired up via PayButton, not a manual
// bank-deposit-by-reference flow, and no real bank account is configured
// in this project to reconcile one against. This folio still gives Caja
// and the family a short, stable code to reference the cargo by (over the
// phone, on a receipt, etc.) without fabricating a bank integration that
// doesn't exist.
export function InvoiceDetailModal({
  open,
  onClose,
  invoice,
  payAction,
}: {
  open: boolean;
  onClose: () => void;
  invoice: InvoiceDetail;
  payAction?: React.ReactNode;
}) {
  const folio = `BRI-${invoice.id.slice(-8).toUpperCase()}`;
  const scholarshipCents =
    invoice.baseCents && invoice.scholarshipPercent
      ? Math.round((invoice.baseCents * Number(invoice.scholarshipPercent)) / 100)
      : 0;

  return (
    <Modal open={open} onClose={onClose}>
      <h2 className="font-display text-lg font-semibold text-primary">{invoice.conceptoNombre ?? invoice.description}</h2>
      <p className="text-sm text-muted">
        {invoice.student.user.name} · {invoice.student.user.email}
      </p>

      <div className="mt-4 rounded-xl border border-dashed border-primary/40 bg-primary/5 p-3 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Folio de pago</p>
        <p className="font-mono text-lg font-bold text-primary">{folio}</p>
        <p className="mt-1 text-xs text-muted">Referencia para consultar o aclarar este cargo con Caja.</p>
      </div>

      <div className="mt-4">
        {invoice.baseCents != null && <Row label="Monto base" value={formatMoneyMXN(invoice.baseCents)} />}
        {scholarshipCents > 0 && (
          <Row label={`Beca (${invoice.scholarshipPercent}%)`} value={`− ${formatMoneyMXN(scholarshipCents)}`} />
        )}
        {invoice.earlyPaymentDiscountCents ? (
          <Row label="Descuento por pronto pago" value={`− ${formatMoneyMXN(invoice.earlyPaymentDiscountCents)}`} />
        ) : null}
        <Row label="Total a pagar" value={<span className="text-base text-primary">{formatMoneyMXN(invoice.amountCents)}</span>} />
        <Row label="Fecha límite de pago" value={invoice.dueDate.toLocaleDateString("es-MX")} />
        {invoice.paidAt && <Row label="Fecha de pago" value={invoice.paidAt.toLocaleDateString("es-MX")} />}
        <Row
          label="Recibo fiscal"
          value={invoice.reciboFiscalEnviado ? `Enviado ${invoice.reciboFiscalEnviadoAt?.toLocaleDateString("es-MX") ?? ""}` : "No enviado"}
        />
      </div>

      {invoice.parentLinks.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Tutor / padre de familia</p>
          {invoice.parentLinks.map((link, i) => (
            <p key={i} className="mt-1 text-sm">
              {link.parent.name} <span className="text-muted">· {link.parent.email}</span>
            </p>
          ))}
        </div>
      )}

      <div className="mt-4">
        <Tag tone={STATUS_TAG_TONE[invoice.status]}>{INVOICE_STATUS_LABELS[invoice.status]}</Tag>
      </div>

      <div className="mt-6 flex items-center justify-end gap-3">
        {payAction}
        <button
          onClick={onClose}
          className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-surface"
        >
          Cerrar
        </button>
      </div>
    </Modal>
  );
}
