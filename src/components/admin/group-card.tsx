"use client";

import { useState } from "react";
import { MapPin, GraduationCap, Users, Clock } from "lucide-react";
import { RecordCard } from "@/components/ui/record-card";
import { Tag } from "@/components/ui/tag";
import { Modal } from "@/components/ui/modal";
import { GroupEditModal } from "@/components/admin/group-edit-modal";
import { AddStudentToGroupModal } from "@/components/admin/add-student-to-group-modal";
import type { GroupStatus } from "@prisma/client";

const DAY_LABELS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

const STATUS_LABELS: Record<GroupStatus, string> = {
  ABIERTO: "Abierto",
  EN_CURSO: "En curso",
  CONCLUIDO: "Concluido",
  CANCELADO: "Cancelado",
};

interface RosterEntry {
  studentId: string;
  name: string;
  matricula: string;
}

// Clicking anywhere on the card opens a popup with the group's full detail
// and its roster — confirmed with the user 2026-09-09: "en grupos al darle
// click en la tarjeta del grupo debe salir un pop-up desplegando la
// información del grupo y la lista de alumnos que hay ahí". Replaces
// Disponibilidad, which showed only the cupo number for the same data.
export function GroupCard({
  groupId,
  groupName,
  campusName,
  teacherName,
  teacherId,
  cupoMaximo,
  estatusGrupo,
  scheduleSlots,
  roster,
  canManage,
  teachers,
}: {
  groupId: string;
  groupName: string;
  campusName: string;
  teacherName: string;
  teacherId: string;
  cupoMaximo: number;
  estatusGrupo: GroupStatus;
  scheduleSlots: { dayOfWeek: number; startTime: string; endTime: string }[];
  roster: RosterEntry[];
  canManage: boolean;
  teachers: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const enrolled = roster.length;
  const isFull = enrolled >= cupoMaximo;

  return (
    <>
      <RecordCard
        avatarId={groupId}
        avatarLabel={groupName.trim().charAt(0).toUpperCase() || "?"}
        name={groupName}
        onClick={() => setOpen(true)}
        meta={
          <>
            <span className="flex items-center gap-1">
              <MapPin size={11} /> {campusName}
            </span>
            <span className="flex items-center gap-1">
              <GraduationCap size={11} /> {teacherName}
            </span>
          </>
        }
        tags={
          <Tag tone={isFull ? "red" : "green"} icon={Users}>
            {isFull ? "Sin cupo" : "Disponible"} — {enrolled}/{cupoMaximo}
          </Tag>
        }
        actions={
          <>
            {!isFull && <AddStudentToGroupModal groupId={groupId} groupName={groupName} />}
            {canManage && (
              <GroupEditModal
                groupId={groupId}
                groupName={groupName}
                currentTeacherId={teacherId}
                currentCupo={cupoMaximo}
                currentStatus={estatusGrupo}
                teachers={teachers}
              />
            )}
          </>
        }
      />

      <Modal open={open} onClose={() => setOpen(false)} widthClassName="max-w-lg">
        <h2 className="font-display text-lg font-semibold text-primary">{groupName}</h2>
        <p className="text-sm text-muted">
          {campusName} · {teacherName} · {STATUS_LABELS[estatusGrupo]}
        </p>

        <div className="mt-4">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
            <Clock size={13} /> Horario
          </p>
          {scheduleSlots.length > 0 ? (
            <ul className="mt-1.5 space-y-1 text-sm">
              {scheduleSlots.map((slot, i) => (
                <li key={i}>
                  {DAY_LABELS[slot.dayOfWeek]} · {slot.startTime}–{slot.endTime}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1.5 text-sm text-muted">Sin horario registrado.</p>
          )}
        </div>

        <div className="mt-4">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
            <Users size={13} /> Alumnos inscritos ({enrolled}/{cupoMaximo})
          </p>
          {roster.length > 0 ? (
            <ul className="mt-1.5 divide-y divide-border">
              {roster.map((r) => (
                <li key={r.studentId} className="flex items-center justify-between py-2 text-sm">
                  <span>{r.name}</span>
                  <span className="font-mono text-xs text-muted">{r.matricula}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1.5 text-sm text-muted">Todavía no hay alumnos inscritos en este grupo.</p>
          )}
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={() => setOpen(false)}
            className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-surface"
          >
            Cerrar
          </button>
        </div>
      </Modal>
    </>
  );
}
