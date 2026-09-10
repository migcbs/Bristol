"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import type { GroupChangeRequestType } from "@prisma/client";

interface StudentHit {
  id: string;
  matricula: string;
  campusId: string;
  user: { name: string };
  campus: { name: string };
  enrollments: { group: { id: string; name: string; level: { code: string } } }[];
}
interface DestinationGroup {
  id: string;
  name: string;
  campusId: string;
}

// Recepción's "who does the requesting" side of Solicitudes — confirmed
// with the user 2026-09-09: previously nothing in the UI ever called
// POST /api/admin/group-change-requests, so there was no way to actually
// create one short of hitting the API by hand. Reuses the same
// /api/admin/search student picker as AddStudentToGroupModal.
export function NewSolicitudModal({ destinationGroups }: { destinationGroups: DestinationGroup[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<StudentHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<StudentHit | null>(null);
  const [type, setType] = useState<GroupChangeRequestType>("CAMBIO_GRUPO");
  const [requestedGroupId, setRequestedGroupId] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const currentEnrollment = selected?.enrollments[0];
  const candidateGroups = destinationGroups.filter(
    (g) => g.campusId === selected?.campusId && g.id !== currentEnrollment?.group.id
  );

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected || !currentEnrollment) return;
    setSubmitting(true);
    setError(null);
    const res = await fetch("/api/admin/group-change-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type,
        studentId: selected.id,
        currentGroupId: currentEnrollment.group.id,
        requestedGroupId: type === "CAMBIO_GRUPO" ? requestedGroupId : undefined,
        reason,
      }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "No se pudo crear la solicitud");
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
    setType("CAMBIO_GRUPO");
    setRequestedGroupId("");
    setReason("");
    setError(null);
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5">
        <Plus size={16} /> Nueva solicitud
      </Button>

      <Modal open={open} onClose={close} widthClassName="max-w-md">
        <h2 className="font-display text-lg font-semibold text-primary">Nueva solicitud</h2>

        {!selected ? (
          <div className="mt-4">
            <div className="relative">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                autoFocus
                value={query}
                onChange={(e) => runSearch(e.target.value)}
                placeholder="Buscar alumno por nombre o matrícula..."
                className="w-full rounded-xl border border-border py-2.5 pl-9 pr-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div className="mt-3 max-h-60 space-y-1.5 overflow-y-auto">
              {searching && <p className="p-2 text-sm text-muted">Buscando...</p>}
              {!searching && query.trim().length >= 2 && results.length === 0 && (
                <p className="p-2 text-sm text-muted">Sin resultados.</p>
              )}
              {results.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  disabled={!s.enrollments[0]}
                  onClick={() => setSelected(s)}
                  className="w-full rounded-xl border border-border p-3 text-left text-sm transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <p className="font-medium text-text">{s.user.name}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {s.matricula} · {s.campus.name}
                    {s.enrollments[0] ? ` · ${s.enrollments[0].group.name}` : " · sin grupo activo"}
                  </p>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 space-y-3">
            <div className="rounded-xl border border-border bg-surface p-3 text-sm">
              <p className="font-medium">{selected.user.name}</p>
              <p className="text-xs text-muted">
                {selected.matricula} · Grupo actual: {currentEnrollment?.group.name}
              </p>
              <button type="button" onClick={() => setSelected(null)} className="mt-1 text-xs text-primary underline">
                Cambiar alumno
              </button>
            </div>

            <div>
              <label className="block text-xs font-medium text-muted">Tipo de solicitud</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as GroupChangeRequestType)}
                className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
              >
                <option value="CAMBIO_GRUPO">Cambio de grupo</option>
                <option value="BAJA">Baja</option>
              </select>
            </div>

            {type === "CAMBIO_GRUPO" && (
              <div>
                <label className="block text-xs font-medium text-muted">Grupo destino</label>
                <select
                  required
                  value={requestedGroupId}
                  onChange={(e) => setRequestedGroupId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
                >
                  <option value="">Selecciona un grupo...</option>
                  {candidateGroups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-muted">Motivo</label>
              <textarea
                required
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={500}
                className="mt-1 min-h-[80px] w-full rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
              />
            </div>

            {error && <p className="text-xs text-accent-dark">{error}</p>}

            <div className="flex gap-3 pt-1">
              <Button type="button" variant="outline" className="flex-1" onClick={close}>
                Cancelar
              </Button>
              <Button type="submit" className="flex-1" disabled={submitting}>
                {submitting ? "Enviando..." : "Enviar solicitud"}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
