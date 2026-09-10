"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { IconActionButton } from "@/components/ui/icon-action-button";
import { formatMoneyMXN } from "@/lib/invoice-status";

// The actual point-of-sale action on each resource — confirmed with the
// user 2026-09-09: "en caja debe haber un pequeño punto de venta que
// sirva, que descuente el stock". Checks for an open caja session before
// letting the sale happen (the API enforces this too; this check is just
// so the modal can show a clear message instead of a raw error).
export function SellRecursoModal({
  recursoId,
  recursoNombre,
  campusId,
  precioUnitarioCents,
  cantidadDisponible,
}: {
  recursoId: string;
  recursoNombre: string;
  campusId: string;
  precioUnitarioCents: number | null;
  cantidadDisponible: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [cajaAbierta, setCajaAbierta] = useState<boolean | null>(null);
  const [cantidad, setCantidad] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    fetch(`/api/admin/caja/sessions?campusId=${campusId}`)
      .then((r) => r.json())
      .then((data) => setCajaAbierta(!!data.session))
      .catch(() => setCajaAbierta(false));
  }, [open, campusId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const res = await fetch("/api/admin/caja/pos/sale", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recursoMaterialId: recursoId, cantidad }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "No se pudo registrar la venta");
      return;
    }
    const data = await res.json();
    setSuccess(`Venta registrada: ${data.totalFormatted}. Quedan ${data.remaining} disponibles.`);
    router.refresh();
  }

  function close() {
    setOpen(false);
    setCantidad(1);
    setError(null);
    setSuccess(null);
    setCajaAbierta(null);
  }

  if (precioUnitarioCents == null) return null;

  return (
    <>
      <IconActionButton icon={ShoppingCart} label="Vender" onClick={() => setOpen(true)} />

      <Modal open={open} onClose={close} widthClassName="max-w-sm">
        <h2 className="font-display text-lg font-semibold text-primary">Vender: {recursoNombre}</h2>

        {cajaAbierta === false ? (
          <p className="mt-4 rounded-md bg-accent/10 px-3 py-2 text-sm text-accent-dark">
            La caja de este plantel está cerrada. Ábrela primero en la sección de Caja.
          </p>
        ) : success ? (
          <p className="mt-4 rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">{success}</p>
        ) : cajaAbierta === true ? (
          <form onSubmit={handleSubmit} className="mt-4 space-y-3">
            <div>
              <label className="block text-xs font-medium text-muted">Cantidad</label>
              <Input
                type="number"
                min={1}
                max={cantidadDisponible}
                value={cantidad}
                onChange={(e) => setCantidad(Number(e.target.value))}
                className="mt-1 w-28"
              />
              <p className="mt-1 text-xs text-muted">
                {formatMoneyMXN(precioUnitarioCents)} c/u · {cantidadDisponible} disponibles
              </p>
            </div>
            <p className="text-sm font-semibold">Total: {formatMoneyMXN(precioUnitarioCents * cantidad)}</p>
            {error && <p className="text-xs text-accent-dark">{error}</p>}
            <div className="flex gap-3 pt-1">
              <Button type="button" variant="outline" className="flex-1" onClick={close}>
                Cancelar
              </Button>
              <Button type="submit" className="flex-1" disabled={submitting || cantidad < 1 || cantidad > cantidadDisponible}>
                {submitting ? "Registrando..." : "Registrar venta"}
              </Button>
            </div>
          </form>
        ) : (
          <p className="mt-4 text-sm text-muted">Verificando estado de la caja...</p>
        )}

        {(cajaAbierta === false || success) && (
          <div className="mt-4 flex justify-end">
            <button onClick={close} className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-surface">
              Cerrar
            </button>
          </div>
        )}
      </Modal>
    </>
  );
}
