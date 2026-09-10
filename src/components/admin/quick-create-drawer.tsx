"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface CreatedCredentials {
  matricula: string;
  studentEmail: string;
  studentPassword: string;
  tutor: { email: string; password: string; alreadyExisted: boolean } | null;
}

export function QuickCreateDrawer({ campuses }: { campuses: { id: string; name: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [campusId, setCampusId] = useState(campuses[0]?.id ?? "");
  const [tutorName, setTutorName] = useState("");
  const [tutorEmail, setTutorEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [credentials, setCredentials] = useState<CreatedCredentials | null>(null);

  function resetForm() {
    setName("");
    setEmail("");
    setTutorName("");
    setTutorEmail("");
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/students/quick-create", {
        method: "POST",
        body: JSON.stringify({
          name,
          email,
          campusId,
          tutorName: tutorName || undefined,
          tutorEmail: tutorEmail || undefined,
        }),
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error ?? "No se pudo crear el alumno");
        return;
      }

      setCredentials({
        matricula: data.matricula,
        studentEmail: email,
        studentPassword: data.temporaryPassword,
        tutor: data.tutor
          ? { email: data.tutor.email, password: data.tutor.temporaryPassword, alreadyExisted: data.tutor.alreadyExisted }
          : null,
      });
      resetForm();
      router.refresh();
    } catch {
      setError("No se pudo crear el alumno");
    } finally {
      setSubmitting(false);
    }
  }

  function handleClose() {
    setOpen(false);
    setCredentials(null);
    resetForm();
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Nuevo alumno"
        className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-all duration-200 hover:scale-105 hover:bg-primary-dark active:scale-95 sm:rounded-md"
      >
        {/* Icon-only below sm — same "labels drop first" rule as the rest
            of the header, so the row never overflows on a phone. */}
        <Plus size={18} className="sm:hidden" />
        <span className="hidden sm:inline">+ Nuevo alumno</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={handleClose}>
          <div
            className="flex max-h-[90vh] w-full max-w-md flex-col overflow-y-auto rounded-2xl border border-border bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {credentials ? (
              <>
                <h2 className="font-display text-lg font-semibold text-primary">
                  Cuenta creada — {credentials.matricula}
                </h2>
                <p className="mt-2 text-sm text-accent-dark">
                  Guarda o imprime esto ahora: la contraseña no se puede volver a mostrar.
                </p>

                <div className="mt-5 rounded-2xl border border-border bg-surface p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">Alumno</p>
                  <p className="mt-1 text-sm">{credentials.studentEmail}</p>
                  <p className="mt-1 font-mono text-sm font-semibold text-primary">
                    {credentials.studentPassword}
                  </p>
                </div>

                {credentials.tutor && (
                  <div className="mt-4 rounded-2xl border border-border bg-surface p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                      Tutor {credentials.tutor.alreadyExisted && "(cuenta ya existente)"}
                    </p>
                    <p className="mt-1 text-sm">{credentials.tutor.email}</p>
                    {credentials.tutor.alreadyExisted ? (
                      <p className="mt-1 text-sm text-muted">
                        Ya tenía cuenta — puede entrar con su contraseña de siempre.
                      </p>
                    ) : (
                      <p className="mt-1 font-mono text-sm font-semibold text-primary">
                        {credentials.tutor.password}
                      </p>
                    )}
                  </div>
                )}

                <p className="mt-4 text-sm text-muted">
                  Ambas cuentas deberán crear su propia contraseña al iniciar sesión por primera vez.
                </p>

                <div className="mt-6 flex gap-3">
                  <Button variant="outline" className="flex-1" onClick={() => setCredentials(null)}>
                    Dar de alta a otro
                  </Button>
                  <Button className="flex-1" onClick={handleClose}>
                    Listo
                  </Button>
                </div>
              </>
            ) : (
              <>
                <h2 className="font-display text-lg font-semibold text-primary">Nuevo alumno</h2>
                <form onSubmit={handleSubmit} className="mt-4 space-y-3">
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Nombre completo del alumno"
                    required
                    maxLength={120}
                  />
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

                  <div className="pt-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                      Tutor (opcional — solo si el alumno es menor de edad)
                    </p>
                    <div className="mt-2 space-y-3">
                      <Input
                        value={tutorName}
                        onChange={(e) => setTutorName(e.target.value)}
                        placeholder="Nombre del padre/tutor"
                        maxLength={120}
                      />
                      <Input
                        value={tutorEmail}
                        onChange={(e) => setTutorEmail(e.target.value)}
                        placeholder="Correo del padre/tutor"
                        type="email"
                        maxLength={254}
                      />
                    </div>
                  </div>

                  {error && <p className="text-sm text-accent-dark">{error}</p>}
                  <Button type="submit" className="w-full" disabled={submitting}>
                    {submitting ? "Creando..." : "Crear alumno"}
                  </Button>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
