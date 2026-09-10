"use client";

import { useState } from "react";
import { Eye, Users } from "lucide-react";
import { IconActionButton } from "@/components/ui/icon-action-button";
import { Modal } from "@/components/ui/modal";
import { StudentDocumentField } from "@/components/admin/student-document-field";
import type { Sexo } from "@prisma/client";

interface StudentDetail {
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
  user: { name: string; email: string };
  campus: { name: string };
  parentLinks: { parent: { name: string; email: string } }[];
}

const SEXO_LABELS: Record<Sexo, string> = { MASCULINO: "Masculino", FEMENINO: "Femenino" };

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border py-2 text-sm last:border-0">
      <span className="text-muted">{label}</span>
      <span className="text-right font-medium">{value || "—"}</span>
    </div>
  );
}

// Read-only consult popup — separate from AlumnoEditModal so "just looking
// something up" doesn't open an editable form by accident.
export function AlumnoViewModal({ student }: { student: StudentDetail }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <IconActionButton icon={Eye} label="Ver" onClick={() => setOpen(true)} />

      <Modal open={open} onClose={() => setOpen(false)}>
            <h2 className="font-display text-lg font-semibold text-primary">{student.user.name}</h2>
            <p className="text-sm text-muted">
              {student.matricula} · {student.campus.name}
            </p>

            <div className="mt-4">
              <Row label="Correo" value={student.user.email} />
              <Row label="CURP" value={student.curp ?? ""} />
              <Row
                label="Fecha de nacimiento"
                value={student.fechaNacimiento ? new Date(student.fechaNacimiento).toLocaleDateString("es-MX") : ""}
              />
              <Row label="Sexo" value={student.sexo ? SEXO_LABELS[student.sexo] : ""} />
              <Row label="Teléfono fijo" value={student.telefonoFijo ?? ""} />
              <Row label="Teléfono móvil" value={student.telefonoMovil ?? ""} />
              <Row label="Correo de contacto" value={student.emailContacto ?? ""} />
              <Row
                label="Domicilio"
                value={[student.domicilioCalle, student.domicilioNumero, student.domicilioColonia]
                  .filter(Boolean)
                  .join(" ")}
              />
              <Row
                label="Ciudad / CP"
                value={[student.domicilioCiudad, student.domicilioCP].filter(Boolean).join(" · ")}
              />
              <Row label="Contacto de emergencia" value={student.contactoEmergenciaNombre ?? ""} />
              <Row label="Teléfono de emergencia" value={student.contactoEmergenciaTelefono ?? ""} />
            </div>

            <p className="mt-4 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
              <Users size={13} /> Tutor / padre de familia
            </p>
            {student.parentLinks.length > 0 ? (
              <div className="mt-1.5 space-y-1">
                {student.parentLinks.map((link, i) => (
                  <p key={i} className="text-sm">
                    {link.parent.name} <span className="text-muted">· {link.parent.email}</span>
                  </p>
                ))}
              </div>
            ) : (
              <p className="mt-1.5 text-sm text-muted">Sin tutor registrado — el alumno es su propio responsable.</p>
            )}

            <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted">Documentos</p>
            <div className="mt-1.5 space-y-2">
              <StudentDocumentField studentId={student.id} tipo="ACTA" entregado={student.entregaActa} canUpload={false} />
              <StudentDocumentField studentId={student.id} tipo="CURP" entregado={student.entregaCurp} canUpload={false} />
              <StudentDocumentField
                studentId={student.id}
                tipo="COMPROBANTE"
                entregado={student.entregaComprobante}
                canUpload={false}
              />
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
