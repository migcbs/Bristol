"use client";

import { useEffect, useState } from "react";

const COLUMNS: { status: string; label: string }[] = [
  { status: "NEW", label: "Nuevo" },
  { status: "CONTACTED", label: "Contactado" },
  { status: "PLACEMENT_SCHEDULED", label: "Examen Agendado" },
  { status: "ENROLLED", label: "Inscrito" },
];

interface LeadRow {
  id: string;
  name: string;
  email: string;
  status: string;
}

export function WaitlistBoard() {
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [loading, setLoading] = useState(true);

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
                .map((lead) => (
                  <div key={lead.id} className="rounded-md bg-white p-2 text-sm shadow-sm">
                    <p className="font-medium">{lead.name}</p>
                    <p className="text-xs text-muted">{lead.email}</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {COLUMNS.filter((c) => c.status !== col.status).map((target) => (
                        <button
                          key={target.status}
                          onClick={() => moveTo(lead.id, target.status)}
                          className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted hover:bg-surface"
                        >
                          → {target.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              {leads.filter((l) => l.status === col.status).length === 0 && (
                <p className="text-xs text-muted">Sin leads en esta columna.</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
