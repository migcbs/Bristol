"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

export function RecursoMaterialModal({ campuses }: { campuses: { id: string; name: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [nombre, setNombre] = useState("");
  const [campusId, setCampusId] = useState(campuses[0]?.id ?? "");
  const [cantidad, setCantidad] = useState("0");
  const [precio, setPrecio] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/admin/recursos-materiales", {
      method: "POST",
      body: JSON.stringify({
        nombre,
        campusId,
        cantidadDisponible: parseInt(cantidad, 10) || 0,
        precioUnitarioCents: precio ? Math.round(parseFloat(precio) * 100) : null,
      }),
      headers: { "Content-Type": "application/json" },
    });

    setSubmitting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "No se pudo crear el recurso");
      return;
    }

    setNombre("");
    setCantidad("0");
    setPrecio("");
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>+ Nuevo recurso</Button>

      <Modal open={open} onClose={() => setOpen(false)} widthClassName="max-w-md">
            <h2 className="font-display text-lg font-semibold text-primary">Nuevo recurso material</h2>
            <form onSubmit={handleSubmit} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-muted">Nombre</label>
                <Input value={nombre} onChange={(e) => setNombre(e.target.value)} required className="mt-1" />
              </div>
              <div>
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
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-muted">Cantidad disponible</label>
                  <Input type="number" min="0" value={cantidad} onChange={(e) => setCantidad(e.target.value)} className="mt-1" />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium text-muted">Precio unitario (MXN, opcional)</label>
                  <Input type="number" step="0.01" min="0" value={precio} onChange={(e) => setPrecio(e.target.value)} className="mt-1" />
                </div>
              </div>
              {error && <p className="text-xs text-accent-dark">{error}</p>}
              <div className="flex gap-3 pt-1">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" className="flex-1" disabled={submitting}>
                  {submitting ? "Creando..." : "Crear recurso"}
                </Button>
              </div>
            </form>
          </Modal>
    </>
  );
}
