"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

interface SearchResults {
  students: { id: string; matricula: string; user: { name: string } }[];
  leads: { id: string; name: string; email: string }[];
  groups: { id: string; name: string }[];
}

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === "Escape") {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const runSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults(null);
      return;
    }
    try {
      const res = await fetch(`/api/admin/search?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        setResults(await res.json());
      }
    } catch {
      setResults(null);
    }
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => runSearch(query), 200);
    return () => clearTimeout(timeout);
  }, [query, runSearch]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-24" onClick={() => setOpen(false)}>
      <div
        className="w-full max-w-lg rounded-2xl bg-white p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar alumno, lead o grupo..."
          className="w-full rounded-md border border-border px-3 py-2 text-sm"
        />
        {results && (
          <div className="mt-3 max-h-80 space-y-3 overflow-y-auto">
            {results.students.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted">Alumnos</p>
                {results.students.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      setOpen(false);
                      router.push(`/admin/admisiones?studentId=${s.id}`);
                    }}
                    className="block w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-surface"
                  >
                    {s.user.name} · {s.matricula}
                  </button>
                ))}
              </div>
            )}
            {results.leads.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted">Leads</p>
                {results.leads.map((l) => (
                  <div key={l.id} className="rounded-md px-2 py-1.5 text-sm">
                    {l.name} · {l.email}
                  </div>
                ))}
              </div>
            )}
            {results.groups.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted">Grupos</p>
                {results.groups.map((g) => (
                  <div key={g.id} className="rounded-md px-2 py-1.5 text-sm">
                    {g.name}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
