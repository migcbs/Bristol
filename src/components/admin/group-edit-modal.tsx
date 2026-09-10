"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { IconActionButton } from "@/components/ui/icon-action-button";
import { Modal } from "@/components/ui/modal";
import type { GroupStatus } from "@prisma/client";

const STATUS_LABELS: Record<GroupStatus, string> = {
  ABIERTO: "Abierto",
  EN_CURSO: "En curso",
  CONCLUIDO: "Concluido",
  CANCELADO: "Cancelado",
};

// Editing an existing group — including reassigning its teacher — is
// Dirección-only ("grupos" full). Recepción can add students (see
// AddStudentToGroupModal) but never touches the group itself.
export function GroupEditModal({
  groupId,
  groupName,
  currentTeacherId,
  currentCupo,
  currentStatus,
  teachers,
}: {
  groupId: string;
  groupName: string;
  currentTeacherId: string;
  currentCupo: number;
  currentStatus: GroupStatus;
  teachers: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [teacherId, setTeacherId] = useState(currentTeacherId);
  const [cupoMaximo, setCupoMaximo] = useState(currentCupo);
  const [estatusGrupo, setEstatusGrupo] = useState<GroupStatus>(currentStatus);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const res = await fetch(`/api/admin/groups/${groupId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teacherId, cupoMaximo, estatusGrupo }),
    });

    setSubmitting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "No se pudo actualizar el grupo");
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <IconActionButton icon={Pencil} label="Editar grupo" onClick={() => setOpen(true)} />

      <Modal open={open} onClose={() => setOpen(false)} widthClassName="max-w-md">
            <h2 className="font-display text-lg font-semibold text-primary">Editar {groupName}</h2>
            <form onSubmit={handleSubmit} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-muted">Maestro</label>
                <select
                  value={teacherId}
                  onChange={(e) => setTeacherId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
                >
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted">Cupo máximo</label>
                <Input
                  type="number"
                  min={1}
                  max={200}
                  value={cupoMaximo}
                  onChange={(e) => setCupoMaximo(Number(e.target.value))}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted">Estatus</label>
                <select
                  value={estatusGrupo}
                  onChange={(e) => setEstatusGrupo(e.target.value as GroupStatus)}
                  className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
                >
                  {(Object.keys(STATUS_LABELS) as GroupStatus[]).map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
              </div>
              {error && <p className="text-xs text-accent-dark">{error}</p>}
              <div className="flex gap-3 pt-1">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" className="flex-1" disabled={submitting}>
                  {submitting ? "Guardando..." : "Guardar"}
                </Button>
              </div>
            </form>
          </Modal>
    </>
  );
}
