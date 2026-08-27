"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function GradeForm({ students }: { students: { enrollmentId: string; name: string }[] }) {
  const router = useRouter();
  const [enrollmentId, setEnrollmentId] = useState(students[0]?.enrollmentId ?? "");
  const [title, setTitle] = useState("");
  const [score, setScore] = useState("");
  const [maxScore, setMaxScore] = useState("100");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/portal/grades", {
        method: "POST",
        body: JSON.stringify({
          enrollmentId,
          title,
          score: Number(score),
          maxScore: Number(maxScore),
        }),
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "No se pudo registrar la calificación");
        return;
      }

      setTitle("");
      setScore("");
      router.refresh();
    } catch {
      setError("No se pudo registrar la calificación");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-border bg-white p-4">
      <select
        value={enrollmentId}
        onChange={(e) => setEnrollmentId(e.target.value)}
        className="w-full rounded-md border border-border px-2 py-2 text-sm"
      >
        {students.map((s) => (
          <option key={s.enrollmentId} value={s.enrollmentId}>
            {s.name}
          </option>
        ))}
      </select>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Evaluación (p. ej. Examen parcial 1)"
        required
        className="w-full rounded-md border border-border px-3 py-2 text-sm"
      />
      <div className="flex items-center gap-2">
        <input
          value={score}
          onChange={(e) => setScore(e.target.value)}
          placeholder="Puntos"
          required
          type="number"
          min={0}
          className="w-24 rounded-md border border-border px-3 py-2 text-sm"
        />
        <span className="text-sm text-muted">de</span>
        <input
          value={maxScore}
          onChange={(e) => setMaxScore(e.target.value)}
          placeholder="Máximo"
          required
          type="number"
          min={1}
          className="w-24 rounded-md border border-border px-3 py-2 text-sm"
        />
      </div>
      {error && <p className="text-sm text-accent-dark">{error}</p>}
      <Button type="submit" disabled={submitting || !enrollmentId}>
        {submitting ? "Guardando..." : "Registrar calificación"}
      </Button>
    </form>
  );
}
