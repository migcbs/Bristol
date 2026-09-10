"use client";

import { useMemo, useState } from "react";
import { Search, Calendar, Mail } from "lucide-react";
import { RecordCard } from "@/components/ui/record-card";
import { Tag } from "@/components/ui/tag";
import { InvoiceRowActions } from "@/components/admin/invoice-row-actions";
import { InvoiceDetailModal, type InvoiceDetail } from "@/components/admin/invoice-detail-modal";
import { INVOICE_STATUS_LABELS, formatMoneyMXN } from "@/lib/invoice-status";
import type { InvoiceStatus } from "@prisma/client";

type InvoiceRow = InvoiceDetail;

const STATUS_TAG_TONE: Record<InvoiceStatus, "amber" | "red" | "green" | "gray"> = {
  PENDING: "amber",
  OVERDUE: "red",
  PAID: "green",
  CANCELED: "gray",
};

type Filter = "todos" | InvoiceStatus;

// Card grid instead of a table — same RecordCard pattern as
// AlumnosTable/ExAlumnosCards (modeled on the Perrucho admin, confirmed
// with the user 2026-09-09), extended to Cobranzas per the user's explicit
// follow-up request.
export function InvoiceCards({ invoices, canCollect }: { invoices: InvoiceRow[]; canCollect: boolean }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("todos");
  const [openInvoice, setOpenInvoice] = useState<InvoiceRow | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return invoices.filter((inv) => {
      const matchesSearch =
        !q || inv.student.user.name.toLowerCase().includes(q) || inv.description.toLowerCase().includes(q);
      if (!matchesSearch) return false;
      if (filter !== "todos") return inv.status === filter;
      return true;
    });
  }, [invoices, search, filter]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search size={16} className="absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por alumno o descripción..."
            className="w-full rounded-xl border border-border py-2.5 pr-4 pl-9 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <div className="flex flex-wrap gap-1 rounded-xl bg-surface p-1">
          {(
            [
              { id: "todos", label: "Todos" },
              { id: "PENDING", label: "Pendiente" },
              { id: "OVERDUE", label: "Vencido" },
              { id: "PAID", label: "Pagado" },
              { id: "CANCELED", label: "Cancelado" },
            ] as const
          ).map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                filter === f.id ? "bg-white text-primary shadow-sm" : "text-muted hover:text-primary"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
        {filtered.map((invoice) => (
          <RecordCard
            key={invoice.id}
            avatarId={invoice.student.id}
            avatarLabel={invoice.student.user.name.trim().charAt(0).toUpperCase() || "?"}
            name={invoice.student.user.name}
            dimmed={invoice.status === "CANCELED"}
            onClick={() => setOpenInvoice(invoice)}
            meta={
              <>
                <span className="truncate">{invoice.description}</span>
                <span className="flex items-center gap-1">
                  <Calendar size={11} /> {invoice.dueDate.toLocaleDateString("es-MX")}
                </span>
              </>
            }
            tags={
              <>
                <Tag tone={STATUS_TAG_TONE[invoice.status]}>{INVOICE_STATUS_LABELS[invoice.status]}</Tag>
                <Tag tone="blue">{formatMoneyMXN(invoice.amountCents)}</Tag>
                {invoice.reciboFiscalEnviado && (
                  <Tag tone="gray" icon={Mail}>
                    Recibo enviado
                  </Tag>
                )}
              </>
            }
            actions={
              <InvoiceRowActions
                invoiceId={invoice.id}
                status={invoice.status}
                reciboFiscalEnviado={invoice.reciboFiscalEnviado}
                canCollect={canCollect}
              />
            }
          />
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="mt-6 text-center text-sm text-muted">
          {invoices.length === 0 ? "No hay cargos que mostrar todavía." : "Ningún cargo coincide con la búsqueda."}
        </p>
      )}

      {openInvoice && (
        <InvoiceDetailModal open onClose={() => setOpenInvoice(null)} invoice={openInvoice} />
      )}
    </div>
  );
}
