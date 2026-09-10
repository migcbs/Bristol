"use client";

import { useMemo, useState } from "react";
import { Search, Mail, MapPin, Users, FileCheck } from "lucide-react";
import { RecordCard } from "@/components/ui/record-card";
import { Tag } from "@/components/ui/tag";
import { AlumnoViewModal } from "./alumno-view-modal";
import { AlumnoEditModal } from "./alumno-edit-modal";
import { AlumnoDeleteModal } from "./alumno-delete-modal";
import { EnrollStudentModal } from "@/components/admin/enroll-student-modal";
import { computeAgeBracket } from "@/lib/age-bracket";
import type { Sexo } from "@prisma/client";

const AGE_LABELS: Record<string, string> = {
  NINO: "Niño",
  ADOLESCENTE: "Adolescente",
  ADULTO: "Adulto",
};

interface StudentRow {
  id: string;
  matricula: string;
  curp: string | null;
  fechaNacimiento: Date | null;
  sexo: Sexo | null;
  telefonoFijo: string | null;
  telefonoMovil: string | null;
  emailContacto: string | null;
  domicilioCalle: string | null;
  domicilioNumero: string | null;
  domicilioColonia: string | null;
  domicilioCP: string | null;
  domicilioCiudad: string | null;
  contactoEmergenciaNombre: string | null;
  contactoEmergenciaTelefono: string | null;
  entregaActa: boolean;
  entregaCurp: boolean;
  entregaComprobante: boolean;
  campusId: string;
  user: { name: string; email: string };
  campus: { name: string };
  parentLinks: { parent: { name: string; email: string } }[];
  enrollments: { group: { name: string; level: { name: string } } }[];
}

interface GroupOption {
  id: string;
  campusId: string;
  label: string;
}

type Filter = "todos" | "con_tutor" | "documentos_completos";

// A grid of RecordCards instead of a table — modeled on the Perrucho
// admin's "Clientes"/"Pacientes" card grid (confirmed with the user
// 2026-09-09 as the reference for how a record list should look).
export function AlumnosTable({
  students,
  canEdit,
  isAdmin,
  groups,
}: {
  students: StudentRow[];
  canEdit: boolean;
  isAdmin: boolean;
  groups: GroupOption[];
}) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("todos");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return students.filter((s) => {
      const matchesSearch =
        !q ||
        s.user.name.toLowerCase().includes(q) ||
        s.user.email.toLowerCase().includes(q) ||
        s.matricula.toLowerCase().includes(q);
      if (!matchesSearch) return false;
      if (filter === "con_tutor") return s.parentLinks.length > 0;
      if (filter === "documentos_completos") return s.entregaActa && s.entregaCurp && s.entregaComprobante;
      return true;
    });
  }, [students, search, filter]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search size={16} className="absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, correo o matrícula..."
            className="w-full rounded-xl border border-border py-2.5 pr-4 pl-9 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <div className="flex gap-1 rounded-xl bg-surface p-1">
          {(
            [
              { id: "todos", label: "Todos" },
              { id: "con_tutor", label: "Con tutor" },
              { id: "documentos_completos", label: "Documentos completos" },
            ] as const
          ).map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                filter === f.id ? "bg-white text-primary shadow-sm" : "text-muted hover:text-primary"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
        {filtered.map((student) => {
          const ageBracket = student.fechaNacimiento ? computeAgeBracket(student.fechaNacimiento) : null;
          const tutor = student.parentLinks[0]?.parent;
          const docsCount = [student.entregaActa, student.entregaCurp, student.entregaComprobante].filter(Boolean).length;
          const docsCompletos = docsCount === 3;
          const activeGroup = student.enrollments[0]?.group;
          const activeGroupLabel = activeGroup ? `${activeGroup.level.name} · ${activeGroup.name}` : null;

          return (
            <RecordCard
              key={student.id}
              avatarId={student.id}
              avatarLabel={student.user.name.trim().charAt(0).toUpperCase() || "?"}
              name={student.user.name}
              meta={
                <>
                  <span className="flex items-center gap-1 truncate">
                    <Mail size={11} /> {student.user.email}
                  </span>
                  <span className="flex items-center gap-1">
                    <MapPin size={11} /> {student.campus.name}
                  </span>
                  <span className="font-mono">{student.matricula}</span>
                </>
              }
              tags={
                <>
                  {ageBracket && <Tag tone="blue">{AGE_LABELS[ageBracket]}</Tag>}
                  <Tag tone={tutor ? "purple" : "gray"} icon={Users}>
                    {tutor ? tutor.name : "Sin tutor"}
                  </Tag>
                  <Tag tone={activeGroupLabel ? "green" : "gray"}>{activeGroupLabel ?? "Sin grupo"}</Tag>
                  <Tag tone={docsCompletos ? "green" : "amber"} icon={FileCheck}>
                    {docsCompletos ? "Documentos completos" : `Documentos ${docsCount}/3`}
                  </Tag>
                </>
              }
              actions={
                <>
                  <AlumnoViewModal student={student} />
                  {groups.length > 0 && (
                    <EnrollStudentModal
                      studentId={student.id}
                      studentName={student.user.name}
                      studentCampusId={student.campusId}
                      currentGroupLabel={activeGroupLabel}
                      groups={groups}
                    />
                  )}
                  {canEdit && (
                    <>
                      <AlumnoEditModal student={student} />
                      <AlumnoDeleteModal studentId={student.id} studentName={student.user.name} isAdmin={isAdmin} />
                    </>
                  )}
                </>
              }
            />
          );
        })}
      </div>

      {filtered.length === 0 && (
        <p className="mt-6 text-center text-sm text-muted">
          {students.length === 0 ? "No hay alumnos registrados." : "Ningún alumno coincide con la búsqueda."}
        </p>
      )}
    </div>
  );
}
