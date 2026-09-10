"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Option {
  id: string;
  name: string;
}

// Group creation — Dirección de Campus only ("grupos" full access). Kept
// as a plain inline form (not a modal) since it's the primary action on
// its own page, matching InvoiceForm's placement at the top of Cobranzas.
export function GroupForm({
  campuses,
  levels,
  cursos,
  teachers,
}: {
  campuses: Option[];
  levels: Option[];
  cursos: Option[];
  teachers: Option[];
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [campusId, setCampusId] = useState(campuses[0]?.id ?? "");
  const [levelId, setLevelId] = useState(levels[0]?.id ?? "");
  const [cursoId, setCursoId] = useState("");
  const [teacherId, setTeacherId] = useState(teachers[0]?.id ?? "");
  const [cupoMaximo, setCupoMaximo] = useState(20);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/admin/groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, campusId, levelId, cursoId: cursoId || null, teacherId, cupoMaximo }),
    });

    setSubmitting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "No se pudo crear el grupo");
      return;
    }

    setName("");
    router.refresh();
  }

  if (teachers.length === 0) {
    return (
      <p className="rounded-2xl border border-border bg-surface p-4 text-sm text-muted">
        No hay maestros dados de alta todavía — se necesita al menos uno para crear un grupo.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-3 rounded-2xl border border-border bg-white p-4 sm:grid-cols-2 lg:grid-cols-6">
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Nombre del grupo (ej. B2-Sáb-Mañana)"
        required
        maxLength={120}
        className="lg:col-span-2"
      />
      <select
        value={campusId}
        onChange={(e) => setCampusId(e.target.value)}
        className="rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
      >
        {campuses.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <select
        value={levelId}
        onChange={(e) => setLevelId(e.target.value)}
        className="rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
      >
        {levels.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name}
          </option>
        ))}
      </select>
      <select
        value={cursoId}
        onChange={(e) => setCursoId(e.target.value)}
        className="rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
      >
        <option value="">Sin curso específico</option>
        {cursos.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <select
        value={teacherId}
        onChange={(e) => setTeacherId(e.target.value)}
        className="rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
      >
        {teachers.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
      <div className="flex gap-2 lg:col-span-6">
        <Input
          type="number"
          min={1}
          max={200}
          value={cupoMaximo}
          onChange={(e) => setCupoMaximo(Number(e.target.value))}
          className="w-28"
        />
        {error && <p className="self-center text-xs text-accent-dark">{error}</p>}
        <Button type="submit" disabled={submitting} className="ml-auto">
          {submitting ? "Creando..." : "Crear grupo"}
        </Button>
      </div>
    </form>
  );
}
