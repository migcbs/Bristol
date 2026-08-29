"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function BlockEvaluationForm({ students }: { students: { enrollmentId: string; name: string }[] }) {
  const router = useRouter();
  const [enrollmentId, setEnrollmentId] = useState(students[0]?.enrollmentId ?? "");
  const [bloqueNumero, setBloqueNumero] = useState("1");
  const [scores, setScores] = useState({ notaListening: "", notaSpeaking: "", notaReading: "", notaWriting: "", notaGrammar: "" });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/block-evaluations", {
        method: "POST",
        body: JSON.stringify({
          enrollmentId,
          bloqueNumero: Number(bloqueNumero),
          notaListening: Number(scores.notaListening),
          notaSpeaking: Number(scores.notaSpeaking),
          notaReading: Number(scores.notaReading),
          notaWriting: Number(scores.notaWriting),
          notaGrammar: Number(scores.notaGrammar),
        }),
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "No se pudo guardar la evaluación");
        return;
      }

      setScores({ notaListening: "", notaSpeaking: "", notaReading: "", notaWriting: "", notaGrammar: "" });
      router.refresh();
    } catch {
      setError("No se pudo guardar la evaluación");
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
        type="number"
        min={1}
        value={bloqueNumero}
        onChange={(e) => setBloqueNumero(e.target.value)}
        placeholder="Número de bloque"
        className="w-24 rounded-md border border-border px-2 py-2 text-sm"
      />
      <div className="grid grid-cols-5 gap-2">
        {(["notaListening", "notaSpeaking", "notaReading", "notaWriting", "notaGrammar"] as const).map((field) => (
          <input
            key={field}
            type="number"
            min={0}
            max={100}
            value={scores[field]}
            onChange={(e) => setScores((prev) => ({ ...prev, [field]: e.target.value }))}
            placeholder={field.replace("nota", "")}
            required
            className="rounded-md border border-border px-2 py-2 text-sm"
          />
        ))}
      </div>
      {error && <p className="text-sm text-accent-dark">{error}</p>}
      <Button type="submit" disabled={submitting || !enrollmentId}>
        {submitting ? "Guardando..." : "Guardar evaluación de bloque"}
      </Button>
    </form>
  );
}
