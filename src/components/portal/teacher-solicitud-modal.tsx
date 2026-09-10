"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import type { GroupChangeRequestType } from "@prisma/client";

interface StudentOption {
  studentId: string;
  name: string;
  groupId: string;
  groupName: string;
}
interface DestinationGroup {
  id: string;
  name: string;
}

// A teacher's side of Solicitudes — confirmed with the user 2026-09-09: a
// docente should be able to ask for a BAJA or a group change for a
// student in their own class, same as Recepción's NewSolicitudModal, just
// scoped to the teacher's own roster instead of a free-text search
// (they'd only ever be requesting for their own students anyway).
export function TeacherSolicitudModal({
  students,
  destinationGroups,
}: {
  students: StudentOption[];
  destinationGroups: DestinationGroup[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [studentId, setStudentId] = useState(students[0]?.studentId ?? "");
  const [type, setType] = useState<GroupChangeRequestType>("CAMBIO_GRUPO");
  const [requestedGroupId, setRequestedGroupId] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const selectedStudent = students.find((s) => s.studentId === studentId);
  const candidateGroups = destinationGroups.filter((g) => g.id !== selectedStudent?.groupId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedStudent) return;
    setSubmitting(true);
    setError(null);
    const res = await fetch("/api/admin/group-change-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type,
        studentId: selectedStudent.studentId,
        currentGroupId: selectedStudent.groupId,
        requestedGroupId: type === "CAMBIO_GRUPO" ? requestedGroupId : undefined,
        reason,
      }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "No se pudo enviar la solicitud");
      return;
    }
    close();
    router.refresh();
  }

  function close() {
    setOpen(false);
    setType("CAMBIO_GRUPO");
    setRequestedGroupId("");
    setReason("");
    setError(null);
  }

  if (students.length === 0) {
    return null;
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5">
        <Plus size={16} /> Nueva solicitud
      </Button>

      <Modal open={open} onClose={close} widthClassName="max-w-md">
        <h2 className="font-display text-lg font-semibold text-primary">Nueva solicitud</h2>
        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-muted">Alumno</label>
            <select
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
            >
              {students.map((s) => (
                <option key={s.studentId} value={s.studentId}>
                  {s.name} — {s.groupName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted">Tipo de solicitud</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as GroupChangeRequestType)}
              className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
            >
              <option value="CAMBIO_GRUPO">Cambio de grupo</option>
              <option value="BAJA">Baja</option>
            </select>
          </div>

          {type === "CAMBIO_GRUPO" && (
            <div>
              <label className="block text-xs font-medium text-muted">Grupo destino</label>
              <select
                required
                value={requestedGroupId}
                onChange={(e) => setRequestedGroupId(e.target.value)}
                className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
              >
                <option value="">Selecciona un grupo...</option>
                {candidateGroups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-muted">Motivo</label>
            <textarea
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={500}
              className="mt-1 min-h-[80px] w-full rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
            />
          </div>

          {error && <p className="text-xs text-accent-dark">{error}</p>}

          <div className="flex gap-3 pt-1">
            <Button type="button" variant="outline" className="flex-1" onClick={close}>
              Cancelar
            </Button>
            <Button type="submit" className="flex-1" disabled={submitting}>
              {submitting ? "Enviando..." : "Enviar solicitud"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
