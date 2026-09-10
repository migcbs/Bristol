"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Package, PackagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { formatMoneyMXN } from "@/lib/invoice-status";

interface RecentSale {
  id: string;
  cantidad: number | null;
  montoCents: number;
  createdAt: Date;
  createdByName: string;
}

export interface RecursoDetail {
  id: string;
  nombre: string;
  campusName: string;
  cantidadDisponible: number;
  precioUnitarioCents: number | null;
  stockMinimo: number;
  recentSales: RecentSale[];
  totalVendido: number;
  canManage: boolean;
}

// The detail popup the user asked for 2026-09-09 ("recursos materiales
// sigue sin desplegar el pop-up, no me diste una propuesta de mejora").
// The improvement: click a resource → see its stock vs. minimum, its
// price, its recent sales and lifetime units sold, and (for Caja) a quick
// restock form + editable price/minimum. Restock goes through PATCH
// /api/admin/recursos-materiales/[id] with `agregarStock`.
export function RecursoDetailModal({
  open,
  onClose,
  recurso,
}: {
  open: boolean;
  onClose: () => void;
  recurso: RecursoDetail;
}) {
  const router = useRouter();
  const [agregar, setAgregar] = useState("");
  const [precio, setPrecio] = useState(
    recurso.precioUnitarioCents != null ? (recurso.precioUnitarioCents / 100).toString() : ""
  );
  const [minimo, setMinimo] = useState(recurso.stockMinimo.toString());
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const bajoMinimo = recurso.cantidadDisponible <= recurso.stockMinimo;

  async function patch(bodyObj: Record<string, unknown>) {
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/admin/recursos-materiales/${recurso.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bodyObj),
    });
    setSaving(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "No se pudo guardar");
      return false;
    }
    router.refresh();
    return true;
  }

  async function handleRestock(e: React.FormEvent) {
    e.preventDefault();
    const n = Number(agregar);
    if (!Number.isInteger(n) || n < 1) return;
    if (await patch({ agregarStock: n })) setAgregar("");
  }

  async function handleSaveSettings() {
    const priceCents = precio.trim() === "" ? null : Math.round(Number(precio) * 100);
    await patch({ precioUnitarioCents: priceCents, stockMinimo: Number(minimo) });
  }

  return (
    <Modal open={open} onClose={onClose}>
      <h2 className="font-display text-lg font-semibold text-primary">{recurso.nombre}</h2>
      <p className="text-sm text-muted">{recurso.campusName}</p>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-border p-3 text-center">
          <p className="text-[11px] text-muted">Disponibles</p>
          <p className={`font-display text-xl font-bold ${bajoMinimo ? "text-accent-dark" : "text-primary"}`}>
            {recurso.cantidadDisponible}
          </p>
        </div>
        <div className="rounded-xl border border-border p-3 text-center">
          <p className="text-[11px] text-muted">Precio</p>
          <p className="font-display text-xl font-bold text-primary">
            {recurso.precioUnitarioCents != null ? formatMoneyMXN(recurso.precioUnitarioCents) : "—"}
          </p>
        </div>
        <div className="rounded-xl border border-border p-3 text-center">
          <p className="text-[11px] text-muted">Vendidos (total)</p>
          <p className="font-display text-xl font-bold text-primary">{recurso.totalVendido}</p>
        </div>
      </div>

      {bajoMinimo && (
        <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Stock en o por debajo del mínimo ({recurso.stockMinimo}). Conviene reabastecer.
        </p>
      )}

      {recurso.canManage && (
        <>
          <form onSubmit={handleRestock} className="mt-4 flex items-end gap-2">
            <div>
              <label className="block text-xs font-medium text-muted">Agregar al inventario</label>
              <Input
                type="number"
                min={1}
                value={agregar}
                onChange={(e) => setAgregar(e.target.value)}
                placeholder="0"
                className="mt-1 w-28"
              />
            </div>
            <Button type="submit" disabled={saving || !agregar} className="inline-flex items-center gap-1.5">
              <PackagePlus size={15} /> Reabastecer
            </Button>
          </form>

          <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-border pt-4">
            <div>
              <label className="block text-xs font-medium text-muted">Precio unitario</label>
              <Input type="number" step="0.01" min="0" value={precio} onChange={(e) => setPrecio(e.target.value)} className="mt-1 w-32" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted">Stock mínimo</label>
              <Input type="number" min={0} value={minimo} onChange={(e) => setMinimo(e.target.value)} className="mt-1 w-24" />
            </div>
            <Button type="button" variant="outline" onClick={handleSaveSettings} disabled={saving}>
              Guardar
            </Button>
          </div>
        </>
      )}

      {error && <p className="mt-3 text-sm text-accent-dark">{error}</p>}

      <p className="mt-4 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
        <Package size={13} /> Ventas recientes
      </p>
      {recurso.recentSales.length > 0 ? (
        <ul className="mt-2 divide-y divide-border">
          {recurso.recentSales.map((s) => (
            <li key={s.id} className="flex items-center justify-between py-2 text-sm">
              <span>
                {s.cantidad ?? 1} u. · {s.createdByName}
              </span>
              <span className="text-muted">
                {formatMoneyMXN(s.montoCents)} · {s.createdAt.toLocaleDateString("es-MX")}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-muted">Todavía no hay ventas de este recurso.</p>
      )}

      <div className="mt-6 flex justify-end">
        <button onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-surface">
          Cerrar
        </button>
      </div>
    </Modal>
  );
}
