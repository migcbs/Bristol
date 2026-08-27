"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

const STATUS_OPTIONS = [
  { value: "PRESENT", label: "Presente" },
  { value: "ABSENT", label: "Ausente" },
  { value: "LATE", label: "Retardo" },
  { value: "EXCUSED", label: "Justificado" },
];

export function AttendanceForm({
  groupId,
  date,
  students,
}: {
  groupId: string;
  date: string;
  students: { enrollmentId: string; name: string }[];
}) {
  const router = useRouter();
  const [statuses, setStatuses] = useState<Record<string, string>>(
    Object.fromEntries(students.map((s) => [s.enrollmentId, "PRESENT"]))
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/portal/attendance", {
        method: "POST",
        body: JSON.stringify({
          groupId,
          date,
          records: students.map((s) => ({
            enrollmentId: s.enrollmentId,
            status: statuses[s.enrollmentId],
          })),
        }),
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "No se pudo guardar la asistencia");
        return;
      }

      router.refresh();
    } catch {
      setError("No se pudo guardar la asistencia");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="divide-y divide-border rounded-lg border border-border bg-white">
        {students.map((s) => (
          <div key={s.enrollmentId} className="flex items-center justify-between px-4 py-3">
            <span className="text-sm font-medium">{s.name}</span>
            <select
              value={statuses[s.enrollmentId]}
              onChange={(e) =>
                setStatuses((prev) => ({ ...prev, [s.enrollmentId]: e.target.value }))
              }
              className="rounded-md border border-border px-2 py-1 text-sm"
              aria-label={`Estatus de ${s.name}`}
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
      {error && <p className="text-sm text-accent-dark">{error}</p>}
      <Button type="submit" disabled={submitting}>
        {submitting ? "Guardando..." : "Guardar asistencia"}
      </Button>
    </form>
  );
}
