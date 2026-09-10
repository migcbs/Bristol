"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import type { CashMovementType } from "@prisma/client";

export function CashMovementModal({ campuses }: { campuses: { id: string; name: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [campusId, setCampusId] = useState(campuses[0]?.id ?? "");
  const [tipo, setTipo] = useState<CashMovementType>("ENTRADA");
  const [concepto, setConcepto] = useState("");
  const [monto, setMonto] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/admin/movimientos-caja", {
      method: "POST",
      body: JSON.stringify({
        campusId,
        tipo,
        concepto,
        montoCents: Math.round(parseFloat(monto) * 100),
      }),
      headers: { "Content-Type": "application/json" },
    });

    setSubmitting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "No se pudo registrar el movimiento");
      return;
    }

    setConcepto("");
    setMonto("");
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>+ Nuevo movimiento</Button>

      <Modal open={open} onClose={() => setOpen(false)} widthClassName="max-w-md">
            <h2 className="font-display text-lg font-semibold text-primary">Nuevo movimiento de caja</h2>
            <p className="mt-1 text-xs text-muted">
              Para entradas por pago de un alumno, usa &quot;Marcar pagada&quot; en Cobranzas — se registra sola aquí.
            </p>
            <form onSubmit={handleSubmit} className="mt-4 space-y-3">
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-muted">Tipo</label>
                  <select
                    value={tipo}
                    onChange={(e) => setTipo(e.target.value as CashMovementType)}
                    className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
                  >
                    <option value="ENTRADA">Entrada</option>
                    <option value="SALIDA">Salida</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium text-muted">Plantel</label>
                  <select
                    value={campusId}
                    onChange={(e) => setCampusId(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
                  >
                    {campuses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted">Concepto</label>
                <Input value={concepto} onChange={(e) => setConcepto(e.target.value)} required className="mt-1" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted">Monto (MXN)</label>
                <Input type="number" step="0.01" min="0.01" value={monto} onChange={(e) => setMonto(e.target.value)} required className="mt-1" />
              </div>
              {error && <p className="text-xs text-accent-dark">{error}</p>}
              <div className="flex gap-3 pt-1">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" className="flex-1" disabled={submitting}>
                  {submitting ? "Registrando..." : "Registrar"}
                </Button>
              </div>
            </form>
          </Modal>
    </>
  );
}
