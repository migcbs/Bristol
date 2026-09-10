"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

interface ConceptoPago {
  id: string;
  nombre: string;
  montoDefaultCents: number | null;
}

export function InvoiceForm({ students }: { students: { id: string; name: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [conceptos, setConceptos] = useState<ConceptoPago[]>([]);
  const [studentId, setStudentId] = useState(students[0]?.id ?? "");
  const [conceptoPagoId, setConceptoPagoId] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [newConceptoMode, setNewConceptoMode] = useState(false);
  const [newConceptoNombre, setNewConceptoNombre] = useState("");

  useEffect(() => {
    if (!open) return;
    fetch("/api/admin/concepto-pagos")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setConceptos(Array.isArray(data) ? data : []));
  }, [open]);

  function handleConceptoChange(id: string) {
    setConceptoPagoId(id);
    const concepto = conceptos.find((c) => c.id === id);
    if (concepto) {
      setDescription(concepto.nombre);
      if (concepto.montoDefaultCents) setAmount((concepto.montoDefaultCents / 100).toFixed(2));
    }
  }

  async function handleAddConcepto() {
    const nombre = newConceptoNombre.trim();
    if (!nombre) return;
    setError(null);
    const res = await fetch("/api/admin/concepto-pagos", {
      method: "POST",
      body: JSON.stringify({ nombre }),
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "No se pudo crear el concepto");
      return;
    }
    const created = await res.json();
    setConceptos((prev) => [...prev, created].sort((a, b) => a.nombre.localeCompare(b.nombre)));
    handleConceptoChange(created.id);
    setNewConceptoMode(false);
    setNewConceptoNombre("");
  }

  function resetForm() {
    setConceptoPagoId("");
    setDescription("");
    setAmount("");
    setDueDate("");
    setNewConceptoMode(false);
    setNewConceptoNombre("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const amountCents = Math.round(parseFloat(amount) * 100);
    const res = await fetch("/api/admin/invoices", {
      method: "POST",
      body: JSON.stringify({ studentId, description, amountCents, dueDate, conceptoPagoId: conceptoPagoId || undefined }),
      headers: { "Content-Type": "application/json" },
    });

    setSubmitting(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "No se pudo crear el cargo");
      return;
    }

    resetForm();
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>+ Nuevo cargo</Button>

      <Modal open={open} onClose={() => setOpen(false)} widthClassName="max-w-md">
            <h2 className="font-display text-lg font-semibold text-primary">Nuevo cargo</h2>
            <form onSubmit={handleSubmit} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-muted">Alumno</label>
                <select
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
                >
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted">Concepto</label>
                {!newConceptoMode ? (
                  <div className="mt-1 flex gap-2">
                    <select
                      value={conceptoPagoId}
                      onChange={(e) => handleConceptoChange(e.target.value)}
                      className="flex-1 rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
                    >
                      <option value="">Otro (descripción libre)</option>
                      {conceptos.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nombre}
                        </option>
                      ))}
                    </select>
                    <Button type="button" variant="outline" onClick={() => setNewConceptoMode(true)}>
                      + Nuevo
                    </Button>
                  </div>
                ) : (
                  <div className="mt-1 flex gap-2">
                    <Input
                      placeholder="Nombre del concepto"
                      value={newConceptoNombre}
                      onChange={(e) => setNewConceptoNombre(e.target.value)}
                      className="flex-1"
                    />
                    <Button type="button" onClick={handleAddConcepto}>
                      Guardar
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setNewConceptoMode(false)}>
                      Cancelar
                    </Button>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-muted">Descripción</label>
                <Input value={description} onChange={(e) => setDescription(e.target.value)} required className="mt-1" />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-muted">Monto (MXN)</label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                    className="mt-1"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium text-muted">Vencimiento</label>
                  <Input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    required
                    className="mt-1"
                  />
                </div>
              </div>
              {error && <p className="text-xs text-accent-dark">{error}</p>}
              <div className="flex gap-3 pt-1">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" className="flex-1" disabled={submitting}>
                  {submitting ? "Creando..." : "Crear cargo"}
                </Button>
              </div>
            </form>
      </Modal>
    </>
  );
}
