"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function IncidentForm({
  students,
}: {
  students: { id: string; name: string; groupId: string }[];
}) {
  const router = useRouter();
  const [studentKey, setStudentKey] = useState(
    students[0] ? `${students[0].id}:${students[0].groupId}` : ""
  );
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const [studentId, groupId] = studentKey.split(":");

    try {
      const res = await fetch("/api/portal/incidents", {
        method: "POST",
        body: JSON.stringify({ studentId, groupId, description }),
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "No se pudo registrar la incidencia");
        return;
      }

      setDescription("");
      router.refresh();
    } catch {
      setError("No se pudo registrar la incidencia");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-border bg-white p-4">
      <select
        value={studentKey}
        onChange={(e) => setStudentKey(e.target.value)}
        className="w-full rounded-md border border-border px-2 py-2 text-sm"
      >
        {students.map((s) => (
          <option key={`${s.id}:${s.groupId}`} value={`${s.id}:${s.groupId}`}>
            {s.name}
          </option>
        ))}
      </select>
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Describe lo ocurrido"
        required
        rows={3}
        className="w-full rounded-md border border-border px-3 py-2 text-sm"
      />
      {error && <p className="text-sm text-accent-dark">{error}</p>}
      <Button type="submit" disabled={submitting || !studentKey}>
        {submitting ? "Guardando..." : "Registrar incidencia"}
      </Button>
    </form>
  );
}
