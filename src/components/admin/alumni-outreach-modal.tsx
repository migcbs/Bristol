"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PhoneCall } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IconActionButton } from "@/components/ui/icon-action-button";
import { Modal } from "@/components/ui/modal";
import type { AlumniOutreachType } from "@prisma/client";

const TYPE_LABELS: Record<AlumniOutreachType, string> = {
  LLAMADA: "Llamada",
  MENSAJE: "Mensaje",
  VISITA: "Visita",
  OTRO: "Otro",
};

export function AlumniOutreachModal({ studentId, studentName }: { studentId: string; studentName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<AlumniOutreachType>("LLAMADA");
  const [note, setNote] = useState("");
  const [interesado, setInteresado] = useState<"sin_cambio" | "true" | "false">("sin_cambio");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const res = await fetch(`/api/admin/ex-alumnos/${studentId}/log`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type,
        note,
        ...(interesado !== "sin_cambio" && { interesadoEnVolver: interesado === "true" }),
      }),
    });

    setSubmitting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "No se pudo registrar el contacto");
      return;
    }

    setNote("");
    setInteresado("sin_cambio");
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <IconActionButton icon={PhoneCall} label="Registrar contacto" onClick={() => setOpen(true)} />

      <Modal open={open} onClose={() => setOpen(false)} widthClassName="max-w-md">
            <h2 className="font-display text-lg font-semibold text-primary">Registrar contacto con {studentName}</h2>
            <form onSubmit={handleSubmit} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-muted">Tipo</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as AlumniOutreachType)}
                  className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
                >
                  {(Object.keys(TYPE_LABELS) as AlumniOutreachType[]).map((t) => (
                    <option key={t} value={t}>
                      {TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted">Nota</label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  required
                  maxLength={2000}
                  className="mt-1 min-h-[100px] w-full rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted">¿Interesado en volver?</label>
                <select
                  value={interesado}
                  onChange={(e) => setInteresado(e.target.value as typeof interesado)}
                  className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
                >
                  <option value="sin_cambio">Sin cambio</option>
                  <option value="true">Sí, interesado</option>
                  <option value="false">No interesado</option>
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
