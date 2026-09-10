"use client";

import { useMemo, useState } from "react";
import { Search, Mail, MapPin, Heart, Phone } from "lucide-react";
import { RecordCard } from "@/components/ui/record-card";
import { Tag } from "@/components/ui/tag";
import { AlumniOutreachModal } from "@/components/admin/alumni-outreach-modal";
import { ExAlumnoDetailModal, type ExAlumnoDetail } from "@/components/admin/ex-alumno-detail-modal";
import type { AlumniOutreachType, StudentStatus } from "@prisma/client";

const ESTATUS_LABELS: Record<string, string> = { BAJA: "Baja", GRADUADO: "Graduado" };

interface StudentRow {
  id: string;
  matricula: string;
  telefonoMovil: string | null;
  telefonoFijo: string | null;
  emailContacto: string | null;
  estatusAlumno: StudentStatus;
  interesadoEnVolver: boolean | null;
  user: { name: string; email: string };
  campus: { name: string };
  alumniOutreachLogs: { id: string; type: AlumniOutreachType; note: string; createdAt: Date; createdBy: { name: string } }[];
}

type Filter = "todos" | "interesados" | "sin_evaluar";

// Card grid instead of a table — modeled on the Perrucho admin's card
// pattern (confirmed with the user 2026-09-09), same shape as
// AlumnosTable's cards for visual consistency across Bristol's record
// lists.
export function ExAlumnosCards({ students, canEdit }: { students: StudentRow[]; canEdit: boolean }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("todos");
  const [detail, setDetail] = useState<ExAlumnoDetail | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return students.filter((s) => {
      const matchesSearch = !q || s.user.name.toLowerCase().includes(q) || s.user.email.toLowerCase().includes(q);
      if (!matchesSearch) return false;
      if (filter === "interesados") return s.interesadoEnVolver === true;
      if (filter === "sin_evaluar") return s.interesadoEnVolver === null;
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
            placeholder="Buscar por nombre o correo..."
            className="w-full rounded-xl border border-border py-2.5 pr-4 pl-9 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <div className="flex gap-1 rounded-xl bg-surface p-1">
          {(
            [
              { id: "todos", label: "Todos" },
              { id: "interesados", label: "Interesados" },
              { id: "sin_evaluar", label: "Sin evaluar" },
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
        {filtered.map((s) => {
          const lastLog = s.alumniOutreachLogs[0];
          return (
            <RecordCard
              key={s.id}
              avatarId={s.id}
              avatarLabel={s.user.name.trim().charAt(0).toUpperCase() || "?"}
              name={s.user.name}
              onClick={() =>
                setDetail({
                  id: s.id,
                  matricula: s.matricula,
                  telefonoMovil: s.telefonoMovil,
                  telefonoFijo: s.telefonoFijo,
                  emailContacto: s.emailContacto,
                  estatusAlumno: s.estatusAlumno,
                  interesadoEnVolver: s.interesadoEnVolver,
                  user: s.user,
                  campus: s.campus,
                  outreachLogs: s.alumniOutreachLogs,
                })
              }
              dimmed={s.interesadoEnVolver === false}
              meta={
                <>
                  <span className="flex items-center gap-1 truncate">
                    <Mail size={11} /> {s.user.email}
                  </span>
                  {s.telefonoMovil && (
                    <span className="flex items-center gap-1">
                      <Phone size={11} /> {s.telefonoMovil}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <MapPin size={11} /> {s.campus.name}
                  </span>
                </>
              }
              tags={
                <>
                  <Tag tone={s.estatusAlumno === "GRADUADO" ? "blue" : "gray"}>{ESTATUS_LABELS[s.estatusAlumno]}</Tag>
                  {s.interesadoEnVolver === true && (
                    <Tag tone="green" icon={Heart}>
                      Interesado en volver
                    </Tag>
                  )}
                  {s.interesadoEnVolver === false && <Tag tone="gray">No interesado</Tag>}
                  {s.interesadoEnVolver === null && <Tag tone="amber">Sin evaluar</Tag>}
                  {lastLog && (
                    <span className="w-full truncate text-[11px] text-muted">
                      Último contacto: {lastLog.note} — {lastLog.createdBy.name}, {lastLog.createdAt.toLocaleDateString("es-MX")}
                    </span>
                  )}
                </>
              }
              actions={canEdit && <AlumniOutreachModal studentId={s.id} studentName={s.user.name} />}
            />
          );
        })}
      </div>

      {filtered.length === 0 && (
        <p className="mt-6 text-center text-sm text-muted">
          {students.length === 0 ? "No hay ex alumnos que mostrar todavía." : "Ningún ex alumno coincide con la búsqueda."}
        </p>
      )}

      {detail && <ExAlumnoDetailModal open onClose={() => setDetail(null)} student={detail} />}
    </div>
  );
}
