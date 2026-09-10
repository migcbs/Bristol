"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { IconActionButton } from "@/components/ui/icon-action-button";

interface CreatedCredentials {
  matricula: string;
  studentEmail: string;
  studentPassword: string;
}

// "Inscribir" from Admisiones — confirmed with the user 2026-09-09: a lead
// that's ready to enroll should go straight to a real enrollment screen,
// not just flip a status dropdown. Prefills the same quick-create flow
// Recepción already uses (name/email from the lead), and passes leadId so
// the lead is marked ENROLLED in the same transaction as the new Student
// — see POST /api/admin/students/quick-create.
export function InscribirLeadModal({
  leadId,
  leadName,
  leadEmail,
  campuses,
  defaultCampusId,
}: {
  leadId: string;
  leadName: string;
  leadEmail: string;
  campuses: { id: string; name: string }[];
  defaultCampusId: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(leadEmail);
  const [campusId, setCampusId] = useState(defaultCampusId ?? campuses[0]?.id ?? "");
  const [tutorName, setTutorName] = useState("");
  const [tutorEmail, setTutorEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [credentials, setCredentials] = useState<CreatedCredentials | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const res = await fetch("/api/admin/students/quick-create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: leadName,
        email,
        campusId,
        tutorName: tutorName || undefined,
        tutorEmail: tutorEmail || undefined,
        leadId,
      }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "No se pudo inscribir");
      return;
    }
    const data = await res.json();
    setCredentials({ matricula: data.matricula, studentEmail: email, studentPassword: data.temporaryPassword });
    router.refresh();
  }

  function close() {
    setOpen(false);
    setCredentials(null);
    setError(null);
  }

  return (
    <>
      <IconActionButton icon={UserCheck} label="Inscribir" onClick={() => setOpen(true)} />

      <Modal open={open} onClose={close} widthClassName="max-w-md">
        {credentials ? (
          <>
            <h2 className="font-display text-lg font-semibold text-primary">Cuenta creada — {credentials.matricula}</h2>
            <p className="mt-2 text-sm text-accent-dark">Guarda o imprime esto ahora: la contraseña no se puede volver a mostrar.</p>
            <div className="mt-4 rounded-2xl border border-border bg-surface p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Alumno</p>
              <p className="mt-1 text-sm">{credentials.studentEmail}</p>
              <p className="mt-1 font-mono text-sm font-semibold text-primary">{credentials.studentPassword}</p>
            </div>
            <div className="mt-6 flex justify-end">
              <Button onClick={close}>Listo</Button>
            </div>
          </>
        ) : (
          <>
            <h2 className="font-display text-lg font-semibold text-primary">Inscribir a {leadName}</h2>
            <form onSubmit={handleSubmit} className="mt-4 space-y-3">
              <Input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Correo del alumno"
                required
                type="email"
                maxLength={254}
              />
              <select
                value={campusId}
                onChange={(e) => setCampusId(e.target.value)}
                className="w-full rounded-xl border border-border px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
              >
                {campuses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <div className="pt-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Tutor (opcional — solo si es menor de edad)
                </p>
                <div className="mt-2 space-y-3">
                  <Input value={tutorName} onChange={(e) => setTutorName(e.target.value)} placeholder="Nombre del padre/tutor" maxLength={120} />
                  <Input value={tutorEmail} onChange={(e) => setTutorEmail(e.target.value)} placeholder="Correo del padre/tutor" type="email" maxLength={254} />
                </div>
              </div>
              {error && <p className="text-sm text-accent-dark">{error}</p>}
              <div className="flex gap-3 pt-1">
                <Button type="button" variant="outline" className="flex-1" onClick={close}>
                  Cancelar
                </Button>
                <Button type="submit" className="flex-1" disabled={submitting}>
                  {submitting ? "Inscribiendo..." : "Inscribir"}
                </Button>
              </div>
            </form>
          </>
        )}
      </Modal>
    </>
  );
}
