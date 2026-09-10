"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { IconActionButton } from "@/components/ui/icon-action-button";
import { Modal } from "@/components/ui/modal";
import { StudentDocumentField } from "@/components/admin/student-document-field";
import type { Sexo } from "@prisma/client";

interface StudentDetail {
  id: string;
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
}

function toDateInputValue(date: Date | null): string {
  if (!date) return "";
  return new Date(date).toISOString().slice(0, 10);
}

function formFromStudent(student: StudentDetail) {
  return {
    curp: student.curp ?? "",
    fechaNacimiento: toDateInputValue(student.fechaNacimiento),
    sexo: student.sexo ?? "",
    telefonoFijo: student.telefonoFijo ?? "",
    telefonoMovil: student.telefonoMovil ?? "",
    emailContacto: student.emailContacto ?? "",
    domicilioCalle: student.domicilioCalle ?? "",
    domicilioNumero: student.domicilioNumero ?? "",
    domicilioColonia: student.domicilioColonia ?? "",
    domicilioCP: student.domicilioCP ?? "",
    domicilioCiudad: student.domicilioCiudad ?? "",
    contactoEmergenciaNombre: student.contactoEmergenciaNombre ?? "",
    contactoEmergenciaTelefono: student.contactoEmergenciaTelefono ?? "",
  };
}

export function AlumnoEditModal({ student }: { student: StudentDetail }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(() => formFromStudent(student));

  // Re-sync from the current `student` every time the modal is opened —
  // the list re-renders after router.refresh() and React can keep this
  // component instance mounted at a position now showing a different
  // student, so a plain useState initializer would show stale data.
  function openModal() {
    setForm(formFromStudent(student));
    setError(null);
    setOpen(true);
  }

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/students/${student.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, sexo: form.sexo || undefined }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "No se pudo guardar");
        return;
      }
      setOpen(false);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <IconActionButton icon={Pencil} label="Editar" onClick={openModal} />

      <Modal open={open} onClose={() => setOpen(false)} widthClassName="max-w-2xl">
            <h2 className="font-display text-lg font-semibold text-primary">Editar alumno</h2>
            <form onSubmit={handleSubmit} className="mt-4 space-y-5">
              <fieldset className="grid gap-3 sm:grid-cols-2">
                <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">
                  Identificación
                </legend>
                <Input
                  placeholder="CURP"
                  maxLength={18}
                  value={form.curp}
                  onChange={(e) => update("curp", e.target.value.toUpperCase())}
                />
                <Input
                  type="date"
                  aria-label="Fecha de nacimiento"
                  value={form.fechaNacimiento}
                  onChange={(e) => update("fechaNacimiento", e.target.value)}
                />
                <select
                  aria-label="Sexo"
                  value={form.sexo}
                  onChange={(e) => update("sexo", e.target.value as Sexo | "")}
                  className="w-full rounded-xl border border-border px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
                >
                  <option value="">Sexo (sin especificar)</option>
                  <option value="MASCULINO">Masculino</option>
                  <option value="FEMENINO">Femenino</option>
                </select>
              </fieldset>

              <fieldset className="grid gap-3 sm:grid-cols-2">
                <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Contacto</legend>
                <Input
                  placeholder="Teléfono fijo"
                  value={form.telefonoFijo}
                  onChange={(e) => update("telefonoFijo", e.target.value)}
                />
                <Input
                  placeholder="Teléfono móvil"
                  value={form.telefonoMovil}
                  onChange={(e) => update("telefonoMovil", e.target.value)}
                />
                <Input
                  placeholder="Correo de contacto"
                  type="email"
                  className="sm:col-span-2"
                  value={form.emailContacto}
                  onChange={(e) => update("emailContacto", e.target.value)}
                />
              </fieldset>

              <fieldset className="grid gap-3 sm:grid-cols-2">
                <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Domicilio</legend>
                <Input
                  placeholder="Calle"
                  value={form.domicilioCalle}
                  onChange={(e) => update("domicilioCalle", e.target.value)}
                />
                <Input
                  placeholder="Número"
                  value={form.domicilioNumero}
                  onChange={(e) => update("domicilioNumero", e.target.value)}
                />
                <Input
                  placeholder="Colonia"
                  value={form.domicilioColonia}
                  onChange={(e) => update("domicilioColonia", e.target.value)}
                />
                <Input
                  placeholder="Código postal"
                  value={form.domicilioCP}
                  onChange={(e) => update("domicilioCP", e.target.value)}
                />
                <Input
                  placeholder="Ciudad"
                  className="sm:col-span-2"
                  value={form.domicilioCiudad}
                  onChange={(e) => update("domicilioCiudad", e.target.value)}
                />
              </fieldset>

              <fieldset className="grid gap-3 sm:grid-cols-2">
                <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">
                  Contacto de emergencia
                </legend>
                <Input
                  placeholder="Nombre"
                  value={form.contactoEmergenciaNombre}
                  onChange={(e) => update("contactoEmergenciaNombre", e.target.value)}
                />
                <Input
                  placeholder="Teléfono"
                  value={form.contactoEmergenciaTelefono}
                  onChange={(e) => update("contactoEmergenciaTelefono", e.target.value)}
                />
              </fieldset>

              <fieldset>
                <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                  Documentos
                </legend>
                <div className="space-y-2">
                  <StudentDocumentField studentId={student.id} tipo="ACTA" entregado={student.entregaActa} canUpload />
                  <StudentDocumentField studentId={student.id} tipo="CURP" entregado={student.entregaCurp} canUpload />
                  <StudentDocumentField
                    studentId={student.id}
                    tipo="COMPROBANTE"
                    entregado={student.entregaComprobante}
                    canUpload
                  />
                </div>
              </fieldset>

              {error && <p className="text-sm text-accent-dark">{error}</p>}

              <div className="flex gap-3 pt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" className="flex-1" disabled={submitting}>
                  {submitting ? "Guardando..." : "Guardar cambios"}
                </Button>
              </div>
            </form>
      </Modal>
    </>
  );
}
