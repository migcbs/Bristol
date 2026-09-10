"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { IconActionButton } from "@/components/ui/icon-action-button";

// "Si no es área competente, mandarle esa acción al área correspondiente
// y que allá haya como una lista de to do" — confirmed with the user
// 2026-09-09. Reuses the existing InterAreaTicket/Tickets infrastructure
// rather than inventing a parallel routing system: turning over a lead
// just creates a ticket assigned to whoever should pick it up, and
// /admin/tickets is already that área's to-do list.
export function TurnarLeadModal({
  leadId,
  leadName,
  staff,
}: {
  leadId: string;
  leadName: string;
  staff: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [assignedToId, setAssignedToId] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const res = await fetch("/api/admin/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: `Lead: ${leadName}`,
        description: note,
        assignedToId: assignedToId || undefined,
      }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "No se pudo turnar");
      return;
    }
    close();
    router.refresh();
  }

  function close() {
    setOpen(false);
    setAssignedToId("");
    setNote("");
    setError(null);
  }

  return (
    <>
      <IconActionButton icon={Send} label="Turnar a otra área" onClick={() => setOpen(true)} />

      <Modal open={open} onClose={close} widthClassName="max-w-sm">
        <h2 className="font-display text-lg font-semibold text-primary">Turnar a otra área</h2>
        <p className="mt-1 text-xs text-muted">
          Crea un ticket con este lead — aparecerá en Tickets para que el área correspondiente le dé seguimiento.
        </p>
        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-muted">Asignar a</label>
            <select
              required
              value={assignedToId}
              onChange={(e) => setAssignedToId(e.target.value)}
              className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
            >
              <option value="">Selecciona a quién...</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted">Nota</label>
            <textarea
              required
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={2000}
              placeholder={`Por qué se turna a ${leadName}...`}
              className="mt-1 min-h-[80px] w-full rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
            />
          </div>
          {error && <p className="text-xs text-accent-dark">{error}</p>}
          <div className="flex gap-3 pt-1">
            <Button type="button" variant="outline" className="flex-1" onClick={close}>
              Cancelar
            </Button>
            <Button type="submit" className="flex-1" disabled={submitting}>
              {submitting ? "Turnando..." : "Turnar"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
