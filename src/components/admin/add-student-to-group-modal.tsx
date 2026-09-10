"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IconActionButton } from "@/components/ui/icon-action-button";
import { Modal } from "@/components/ui/modal";

interface StudentHit {
  id: string;
  matricula: string;
  user: { name: string };
  campus: { name: string };
  enrollments: { group: { name: string; level: { code: string } } }[];
}

// Shared by Recepción's Disponibilidad page ("initiate" — add a student to
// an existing group) and Dirección's Grupos page ("full" — same action,
// plus create/edit). Reuses the general /api/admin/search endpoint for the
// student picker rather than building a second lookup. Moving a student
// who already has an active enrollment elsewhere (e.g. a sabatino group)
// closes that one and opens this one — see
// /api/admin/groups/[id]/enroll — so their grades/progreso carry over
// instead of being lost, per the user's 2026-09-09 instruction.
export function AddStudentToGroupModal({ groupId, groupName }: { groupId: string; groupName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<StudentHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<StudentHit | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function runSearch(q: string) {
    setQuery(q);
    setSelected(null);
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(`/api/admin/search?q=${encodeURIComponent(q.trim())}`);
      const data = await res.json().catch(() => ({}));
      setResults(Array.isArray(data.students) ? data.students : []);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }

  async function handleConfirm() {
    if (!selected) return;
    setSubmitting(true);
    setError(null);
    const res = await fetch(`/api/admin/groups/${groupId}/enroll`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId: selected.id }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "No se pudo agregar al alumno");
      return;
    }
    close();
    router.refresh();
  }

  function close() {
    setOpen(false);
    setQuery("");
    setResults([]);
    setSelected(null);
    setError(null);
  }

  return (
    <>
      <IconActionButton icon={UserPlus} label="Agregar alumno" onClick={() => setOpen(true)} />

      <Modal open={open} onClose={close} widthClassName="max-w-md">
            <h2 className="font-display text-lg font-semibold text-primary">Agregar alumno a {groupName}</h2>
            <p className="mt-1 text-xs text-muted">
              Si el alumno ya está en otro grupo, se cerrará esa inscripción y se abrirá esta — su historial de
              calificaciones y progreso se conserva.
            </p>

            <div className="relative mt-4">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                autoFocus
                value={query}
                onChange={(e) => runSearch(e.target.value)}
                placeholder="Buscar por nombre o matrícula..."
                className="w-full rounded-xl border border-border py-2.5 pl-9 pr-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
              />
            </div>

            <div className="mt-3 min-h-[80px] flex-1 space-y-1.5 overflow-y-auto">
              {searching && <p className="p-2 text-sm text-muted">Buscando...</p>}
              {!searching && query.trim().length >= 2 && results.length === 0 && (
                <p className="p-2 text-sm text-muted">Sin resultados.</p>
              )}
              {results.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSelected(s)}
                  className={`w-full rounded-xl border p-3 text-left text-sm transition-colors ${
                    selected?.id === s.id ? "border-primary bg-primary/5" : "border-border hover:bg-surface"
                  }`}
                >
                  <p className="font-medium text-text">{s.user.name}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {s.matricula} · {s.campus.name}
                    {s.enrollments[0] && ` · Actualmente en ${s.enrollments[0].group.name}`}
                  </p>
                </button>
              ))}
            </div>

            {error && <p className="mt-2 text-xs text-accent-dark">{error}</p>}

            <div className="mt-4 flex gap-3">
              <Button type="button" variant="outline" className="flex-1" onClick={close}>
                Cancelar
              </Button>
              <Button type="button" className="flex-1" disabled={!selected || submitting} onClick={handleConfirm}>
                {submitting ? "Agregando..." : "Agregar"}
              </Button>
            </div>
      </Modal>
    </>
  );
}
