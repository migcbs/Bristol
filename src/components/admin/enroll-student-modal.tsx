"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { IconActionButton } from "@/components/ui/icon-action-button";

interface GroupOption {
  id: string;
  campusId: string;
  label: string;
}

// Add a student to a group straight from the Alumnos screen — confirmed
// with the user 2026-09-09 ("hay forma de homologar desde alumnos
// agregarlo a un grupo? para no tener que cambiar tanto de pestañas").
// Hits the same /api/admin/groups/[id]/enroll endpoint the Grupos page
// uses, so a student who's already in another group is moved (old
// enrollment closed, history preserved) rather than double-enrolled.
export function EnrollStudentModal({
  studentId,
  studentName,
  studentCampusId,
  currentGroupLabel,
  groups,
}: {
  studentId: string;
  studentName: string;
  studentCampusId: string;
  currentGroupLabel: string | null;
  groups: GroupOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [groupId, setGroupId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const sameCampusGroups = groups.filter((g) => g.campusId === studentCampusId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!groupId) return;
    setSubmitting(true);
    setError(null);
    const res = await fetch(`/api/admin/groups/${groupId}/enroll`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "No se pudo inscribir al grupo");
      return;
    }
    setOpen(false);
    setGroupId("");
    router.refresh();
  }

  return (
    <>
      <IconActionButton icon={UsersRound} label="Asignar a grupo" onClick={() => setOpen(true)} />

      <Modal open={open} onClose={() => setOpen(false)} widthClassName="max-w-sm">
        <h2 className="font-display text-lg font-semibold text-primary">Asignar a grupo</h2>
        <p className="mt-1 text-xs text-muted">
          {studentName}
          {currentGroupLabel ? ` · actualmente en ${currentGroupLabel}` : " · sin grupo activo"}
        </p>
        {currentGroupLabel && (
          <p className="mt-2 text-xs text-muted">
            Si eliges otro grupo, se cerrará la inscripción actual y se abrirá la nueva — sus calificaciones y progreso
            se conservan.
          </p>
        )}
        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <select
            required
            value={groupId}
            onChange={(e) => setGroupId(e.target.value)}
            className="w-full rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
          >
            <option value="">Selecciona un grupo...</option>
            {sameCampusGroups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.label}
              </option>
            ))}
          </select>
          {sameCampusGroups.length === 0 && (
            <p className="text-xs text-muted">No hay grupos en el plantel de este alumno.</p>
          )}
          {error && <p className="text-xs text-accent-dark">{error}</p>}
          <div className="flex gap-3 pt-1">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" className="flex-1" disabled={submitting || !groupId}>
              {submitting ? "Asignando..." : "Asignar"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
