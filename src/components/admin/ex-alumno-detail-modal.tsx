"use client";

import { Modal } from "@/components/ui/modal";
import { Phone, Mail, MessageCircle, MapPin } from "lucide-react";
import type { StudentStatus, AlumniOutreachType } from "@prisma/client";

const ESTATUS_LABELS: Record<string, string> = { BAJA: "Baja", GRADUADO: "Graduado" };
const TYPE_LABELS: Record<AlumniOutreachType, string> = {
  LLAMADA: "Llamada",
  MENSAJE: "Mensaje",
  VISITA: "Visita",
  OTRO: "Otro",
};

export interface ExAlumnoDetail {
  id: string;
  matricula: string;
  telefonoMovil: string | null;
  telefonoFijo: string | null;
  emailContacto: string | null;
  estatusAlumno: StudentStatus;
  interesadoEnVolver: boolean | null;
  user: { name: string; email: string };
  campus: { name: string };
  outreachLogs: { id: string; type: AlumniOutreachType; note: string; createdAt: Date; createdBy: { name: string } }[];
}

function waLink(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return `https://wa.me/${digits.startsWith("52") ? digits : `52${digits}`}`;
}

// Detail popup for an ex-alumno — confirmed with the user 2026-09-09: "hay
// que desplegar la información del exalumno para poder llamarle por
// teléfono, de lo contrario cómo sé cuál es el contacto?". The phone is a
// real `tel:` link (and a wa.me link), the email a `mailto:`, plus the
// full reengagement history in one place.
export function ExAlumnoDetailModal({
  open,
  onClose,
  student,
}: {
  open: boolean;
  onClose: () => void;
  student: ExAlumnoDetail;
}) {
  const phones = [student.telefonoMovil, student.telefonoFijo].filter(Boolean) as string[];
  const emails = [student.user.email, student.emailContacto].filter(Boolean) as string[];

  return (
    <Modal open={open} onClose={onClose}>
      <h2 className="font-display text-lg font-semibold text-primary">{student.user.name}</h2>
      <p className="text-sm text-muted">
        {student.matricula} · {ESTATUS_LABELS[student.estatusAlumno]}
        {student.interesadoEnVolver === true && " · Interesado en volver"}
      </p>
      <p className="mt-1 flex items-center gap-1 text-sm text-muted">
        <MapPin size={12} /> {student.campus.name}
      </p>

      <div className="mt-4 space-y-2">
        {phones.length > 0 ? (
          phones.map((p) => (
            <div key={p} className="flex items-center justify-between rounded-xl border border-border p-3 text-sm">
              <span className="font-mono">{p}</span>
              <span className="flex gap-1">
                <a
                  href={`tel:${p.replace(/\s/g, "")}`}
                  aria-label={`Llamar a ${p}`}
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary hover:bg-primary/20"
                >
                  <Phone size={14} />
                </a>
                <a
                  href={waLink(p)}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`WhatsApp a ${p}`}
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                >
                  <MessageCircle size={14} />
                </a>
              </span>
            </div>
          ))
        ) : (
          <p className="rounded-xl border border-dashed border-border p-3 text-sm text-muted">
            No hay teléfono registrado — usa el correo.
          </p>
        )}
        {emails.map((e) => (
          <a
            key={e}
            href={`mailto:${e}`}
            className="flex items-center gap-2 rounded-xl border border-border p-3 text-sm text-primary hover:bg-surface"
          >
            <Mail size={14} /> {e}
          </a>
        ))}
      </div>

      <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted">Historial de reenganche</p>
      {student.outreachLogs.length > 0 ? (
        <ul className="mt-2 space-y-2">
          {student.outreachLogs.map((log) => (
            <li key={log.id} className="rounded-xl bg-surface p-3 text-sm">
              <p className="text-xs text-muted">
                {TYPE_LABELS[log.type]} · {log.createdBy.name} · {log.createdAt.toLocaleDateString("es-MX")}
              </p>
              <p className="mt-1">{log.note}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-muted">Sin contactos registrados todavía.</p>
      )}

      <div className="mt-6 flex justify-end">
        <button
          onClick={onClose}
          className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-surface"
        >
          Cerrar
        </button>
      </div>
    </Modal>
  );
}
