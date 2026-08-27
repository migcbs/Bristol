"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function InvoiceForm({ students }: { students: { id: string; name: string }[] }) {
  const router = useRouter();
  const [studentId, setStudentId] = useState(students[0]?.id ?? "");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const amountCents = Math.round(parseFloat(amount) * 100);
    const res = await fetch("/api/admin/invoices", {
      method: "POST",
      body: JSON.stringify({ studentId, description, amountCents, dueDate }),
      headers: { "Content-Type": "application/json" },
    });

    setSubmitting(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "No se pudo crear el cargo");
      return;
    }

    setDescription("");
    setAmount("");
    setDueDate("");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-white p-4">
      <div>
        <label className="block text-xs font-medium text-muted">Alumno</label>
        <select
          value={studentId}
          onChange={(e) => setStudentId(e.target.value)}
          className="mt-1 rounded-md border border-border px-2 py-2 text-sm"
        >
          {students.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-muted">Descripción</label>
        <Input value={description} onChange={(e) => setDescription(e.target.value)} required className="mt-1" />
      </div>
      <div>
        <label className="block text-xs font-medium text-muted">Monto (MXN)</label>
        <Input
          type="number"
          step="0.01"
          min="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
          className="mt-1 w-32"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-muted">Vencimiento</label>
        <Input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          required
          className="mt-1"
        />
      </div>
      {error && <p className="text-xs text-accent-dark">{error}</p>}
      <Button type="submit" disabled={submitting}>
        {submitting ? "Creando..." : "Crear cargo"}
      </Button>
    </form>
  );
}
