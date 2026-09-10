"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, Unlock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { formatMoneyMXN } from "@/lib/invoice-status";

interface ActiveSession {
  id: string;
  openedAt: string;
  openedByName: string;
  openingCents: number;
  entradasCents: number;
  salidasCents: number;
  expectedCents: number;
}

// Apertura / corte / cierre de caja — confirmed with the user 2026-09-09:
// "la caja se debe poder abrir con cierta cantidad de efectivo teórico...
// y poder hacer corte de caja y cerrar la caja hasta el día siguiente".
// Every sale (POS) and every cash movement (manual or de un cargo cobrado)
// requires this session to be open first — see the three API routes this
// screen talks to.
export function CashRegisterView({ campusId, campusName }: { campusId: string; campusName: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<ActiveSession | null>(null);
  const [openingCents, setOpeningCents] = useState("");
  const [countedCents, setCountedCents] = useState("");
  const [closeResult, setCloseResult] = useState<{ expectedCents: number; diffCents: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/admin/caja/sessions?campusId=${campusId}`);
    const data = await res.json().catch(() => ({ session: null }));
    setActive(data.session ?? null);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campusId]);

  async function handleOpen(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const cents = Math.round(Number(openingCents) * 100);
    const res = await fetch("/api/admin/caja/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campusId, openingCents: cents }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "No se pudo abrir la caja");
      return;
    }
    setOpeningCents("");
    load();
    router.refresh();
  }

  async function handleClose(e: React.FormEvent) {
    e.preventDefault();
    if (!active) return;
    setSubmitting(true);
    setError(null);
    const cents = Math.round(Number(countedCents) * 100);
    const res = await fetch(`/api/admin/caja/sessions/${active.id}/close`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ closingCountedCents: cents }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "No se pudo cerrar la caja");
      return;
    }
    const result = await res.json();
    setCloseResult({ expectedCents: result.expectedCents, diffCents: result.diffCents });
    setCountedCents("");
    load();
    router.refresh();
  }

  if (loading) {
    return <Card>Cargando estado de la caja...</Card>;
  }

  if (!active) {
    return (
      <Card>
        <div className="flex items-center gap-2">
          <Lock size={18} className="text-muted" />
          <h2 className="font-display text-base font-semibold">Caja cerrada — {campusName}</h2>
        </div>
        {closeResult && (
          <p className="mt-2 rounded-md bg-surface px-3 py-2 text-sm">
            Corte anterior: esperado {formatMoneyMXN(closeResult.expectedCents)}, diferencia{" "}
            <span className={closeResult.diffCents === 0 ? "text-emerald-600" : "text-accent-dark"}>
              {closeResult.diffCents >= 0 ? "+" : ""}
              {formatMoneyMXN(closeResult.diffCents)}
            </span>
            .
          </p>
        )}
        <form onSubmit={handleOpen} className="mt-4 flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-medium text-muted">Efectivo inicial (fondo de caja)</label>
            <Input
              type="number"
              step="0.01"
              min="0"
              required
              value={openingCents}
              onChange={(e) => setOpeningCents(e.target.value)}
              placeholder="0.00"
              className="mt-1 w-40"
            />
          </div>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Abriendo..." : "Abrir caja"}
          </Button>
        </form>
        {error && <p className="mt-2 text-sm text-accent-dark">{error}</p>}
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex items-center gap-2">
        <Unlock size={18} className="text-emerald-600" />
        <h2 className="font-display text-base font-semibold">Caja abierta — {campusName}</h2>
      </div>
      <p className="mt-1 text-xs text-muted">
        Abierta por {active.openedByName} a las {new Date(active.openedAt).toLocaleTimeString("es-MX")}
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-4">
        <div>
          <p className="text-xs text-muted">Fondo inicial</p>
          <p className="font-display text-lg font-bold">{formatMoneyMXN(active.openingCents)}</p>
        </div>
        <div>
          <p className="text-xs text-muted">Entradas</p>
          <p className="font-display text-lg font-bold text-emerald-600">{formatMoneyMXN(active.entradasCents)}</p>
        </div>
        <div>
          <p className="text-xs text-muted">Salidas</p>
          <p className="font-display text-lg font-bold text-accent-dark">{formatMoneyMXN(active.salidasCents)}</p>
        </div>
        <div>
          <p className="text-xs text-muted">Teórico esperado</p>
          <p className="font-display text-lg font-bold text-primary">{formatMoneyMXN(active.expectedCents)}</p>
        </div>
      </div>

      <form onSubmit={handleClose} className="mt-5 flex flex-wrap items-end gap-3 border-t border-border pt-4">
        <div>
          <label className="block text-xs font-medium text-muted">Efectivo contado (cierre)</label>
          <Input
            type="number"
            step="0.01"
            min="0"
            required
            value={countedCents}
            onChange={(e) => setCountedCents(e.target.value)}
            placeholder="0.00"
            className="mt-1 w-40"
          />
        </div>
        <Button type="submit" variant="accent" disabled={submitting}>
          {submitting ? "Cerrando..." : "Cerrar caja"}
        </Button>
      </form>
      {error && <p className="mt-2 text-sm text-accent-dark">{error}</p>}
    </Card>
  );
}
