"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tag } from "@/components/ui/tag";
import { Modal } from "@/components/ui/modal";
import { avatarTint } from "@/lib/avatar-tint";

const COLUMNS: { status: string; label: string }[] = [
  { status: "NEW", label: "Nuevo" },
  { status: "CONTACTED", label: "Contactado" },
  { status: "PLACEMENT_SCHEDULED", label: "Examen Agendado" },
  { status: "ENROLLED", label: "Inscrito" },
];

const INTEREST_LABELS: Record<string, string> = {
  CURSO_REGULAR: "Curso regular",
  TALLER_CONVERSACION: "Taller de conversación",
  CERTIFICACION: "Certificación",
};

interface LeadRow {
  id: string;
  name: string;
  email: string;
  status: string;
  phone: string | null;
  interestType: string | null;
  notasBitacora: string | null;
}

export function WaitlistBoard({ readOnly = false }: { readOnly?: boolean }) {
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<LeadRow | null>(null);

  useEffect(() => {
    fetch("/api/admin/leads/waitlist")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setLeads(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, []);

  async function moveTo(id: string, status: string) {
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, status } : l)));
    const res = await fetch("/api/admin/leads/waitlist", {
      method: "PATCH",
      body: JSON.stringify({ id, status }),
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) {
      // revert on failure
      fetch("/api/admin/leads/waitlist")
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => setLeads(Array.isArray(data) ? data : []));
    }
  }

  function handleSaved(updated: LeadRow) {
    setLeads((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
    setSelected(null);
  }

  if (loading) return <p className="text-sm text-muted">Cargando...</p>;

  return (
    <div>
      <h1 className="text-lg font-semibold">Lista de Espera</h1>
      <p className="mt-1 text-sm text-muted">
        Da seguimiento a los leads y mueve cada tarjeta conforme avanza su proceso.
      </p>
      <div className="mt-6 grid gap-4 md:grid-cols-4">
        {COLUMNS.map((col) => (
          <div key={col.status} className="rounded-lg border border-border bg-surface p-3">
            <h2 className="text-sm font-semibold">
              {col.label} ({leads.filter((l) => l.status === col.status).length})
            </h2>
            <div className="mt-3 space-y-2">
              {leads
                .filter((l) => l.status === col.status)
                .map((lead) => {
                  const tint = avatarTint(lead.id);
                  return (
                    <button
                      key={lead.id}
                      onClick={() => setSelected(lead)}
                      className="flex w-full items-start gap-2.5 rounded-xl border border-border bg-white p-3 text-left text-sm shadow-[0_1px_2px_rgba(20,20,43,0.04)] transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
                    >
                      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${tint.bg} ${tint.text}`}>
                        {lead.name.trim().charAt(0).toUpperCase() || "?"}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-medium">{lead.name}</p>
                        <p className="truncate text-xs text-muted">{lead.email}</p>
                        {lead.interestType && (
                          <Tag tone="blue" className="mt-1.5">
                            {INTEREST_LABELS[lead.interestType]}
                          </Tag>
                        )}
                      </div>
                    </button>
                  );
                })}
              {leads.filter((l) => l.status === col.status).length === 0 && (
                <p className="text-xs text-muted">Sin leads en esta columna.</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {selected && (
        <LeadDetailModal
          lead={selected}
          onClose={() => setSelected(null)}
          onSaved={handleSaved}
          onMove={moveTo}
          readOnly={readOnly}
        />
      )}
    </div>
  );
}

function LeadDetailModal({
  lead,
  onClose,
  onSaved,
  onMove,
  readOnly,
}: {
  lead: LeadRow;
  onClose: () => void;
  onSaved: (lead: LeadRow) => void;
  onMove: (id: string, status: string) => void;
  readOnly: boolean;
}) {
  const [phone, setPhone] = useState(lead.phone ?? "");
  const [interestType, setInterestType] = useState(lead.interestType ?? "");
  const [notas, setNotas] = useState(lead.notasBitacora ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/leads/waitlist", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: lead.id, phone, interestType: interestType || undefined, notasBitacora: notas }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "No se pudo guardar");
        return;
      }
      const updated = await res.json();
      onSaved({ ...lead, ...updated });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} widthClassName="max-w-md">
        <h2 className="font-display text-lg font-semibold text-primary">{lead.name}</h2>
        <p className="text-sm text-muted">{lead.email}</p>

        <div className="mt-4 space-y-3">
          <Input placeholder="Teléfono" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={readOnly} />
          <select
            value={interestType}
            onChange={(e) => setInterestType(e.target.value)}
            disabled={readOnly}
            className="w-full rounded-xl border border-border px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 disabled:bg-surface"
          >
            <option value="">Tipo de interés (sin especificar)</option>
            {Object.entries(INTEREST_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <textarea
            placeholder="Notas de seguimiento..."
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            maxLength={2000}
            disabled={readOnly}
            className="min-h-[100px] w-full rounded-xl border border-border px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 disabled:bg-surface"
          />
        </div>

        {!readOnly && (
          <div className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Mover a</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {COLUMNS.filter((c) => c.status !== lead.status).map((target) => (
                <button
                  key={target.status}
                  onClick={() => {
                    onMove(lead.id, target.status);
                    onClose();
                  }}
                  className="rounded-full border border-border px-3 py-1 text-xs font-medium text-primary transition-colors hover:border-primary hover:bg-primary hover:text-primary-foreground"
                >
                  {target.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {error && <p className="mt-3 text-sm text-accent-dark">{error}</p>}

        <div className="mt-6 flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Cerrar
          </Button>
          {!readOnly && (
            <Button className="flex-1" onClick={handleSave} disabled={saving}>
              {saving ? "Guardando..." : "Guardar notas"}
            </Button>
          )}
        </div>
    </Modal>
  );
}
