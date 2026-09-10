"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IconActionButton } from "@/components/ui/icon-action-button";
import { Modal } from "@/components/ui/modal";

// Reinscripción, per the user's 2026-09-09 question ("¿cuál es la función
// de reinscribir?"). It closes the student's current enrollment and opens
// a new one in the target group — used to promote a student to the next
// level for a new term, or to move them between the sabatino / entre
// semana schedules. It acts on ONE student at a time (the flat grid made
// that unclear before), so it now runs inside a confirmation modal that
// names the student and both groups. The student's academic history stays
// attached to the closed enrollment and remains visible in their boleta;
// nothing is deleted.
export function ReenrollRowActions({
  enrollmentId,
  studentName,
  currentGroupLabel,
  groups,
}: {
  enrollmentId: string;
  studentName: string;
  currentGroupLabel: string;
  groups: { id: string; label: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [groupId, setGroupId] = useState(groups[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleReenroll() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/reinscripciones", {
        method: "POST",
        body: JSON.stringify({ enrollmentId, newGroupId: groupId }),
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "No se pudo reinscribir");
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      setError("No se pudo reinscribir");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <IconActionButton icon={GraduationCap} label="Reinscribir a otro grupo" onClick={() => setOpen(true)} />

      <Modal open={open} onClose={() => setOpen(false)} widthClassName="max-w-md">
        <h2 className="font-display text-lg font-semibold text-primary">Reinscribir alumno</h2>
        <p className="mt-1 text-sm text-muted">
          {studentName} — actualmente en <span className="font-medium text-foreground">{currentGroupLabel}</span>.
        </p>

        <div className="mt-4">
          <label htmlFor="reenroll-group" className="text-xs font-medium text-muted">
            Grupo destino
          </label>
          <select
            id="reenroll-group"
            value={groupId}
            onChange={(e) => setGroupId(e.target.value)}
            className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
          >
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.label}
              </option>
            ))}
          </select>
        </div>

        <p className="mt-3 rounded-lg bg-surface px-3 py-2 text-xs text-muted">
          Se cierra la inscripción actual y se abre una nueva en el grupo destino. Las calificaciones y evaluaciones
          del alumno se conservan en su historial y siguen visibles en su boleta.
        </p>

        {error && <p className="mt-2 text-xs text-accent-dark">{error}</p>}

        <div className="mt-4 flex gap-3">
          <Button type="button" variant="outline" className="flex-1" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button type="button" className="flex-1" onClick={handleReenroll} disabled={submitting || !groupId}>
            {submitting ? "Reinscribiendo..." : "Confirmar reinscripción"}
          </Button>
        </div>
      </Modal>
    </>
  );
}
