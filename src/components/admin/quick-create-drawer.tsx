"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function QuickCreateDrawer({ campuses }: { campuses: { id: string; name: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [campusId, setCampusId] = useState(campuses[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/students/quick-create", {
        method: "POST",
        body: JSON.stringify({ name, email, campusId }),
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "No se pudo crear el alumno");
        return;
      }

      setName("");
      setEmail("");
      setOpen(false);
      router.refresh();
    } catch {
      setError("No se pudo crear el alumno");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
      >
        + Nuevo alumno
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={() => setOpen(false)}>
          <div className="h-full w-full max-w-md bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold">Nuevo alumno</h2>
            <form onSubmit={handleSubmit} className="mt-4 space-y-3">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nombre completo"
                required
                className="w-full rounded-md border border-border px-3 py-2 text-sm"
              />
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Correo electrónico"
                required
                type="email"
                className="w-full rounded-md border border-border px-3 py-2 text-sm"
              />
              <select
                value={campusId}
                onChange={(e) => setCampusId(e.target.value)}
                className="w-full rounded-md border border-border px-2 py-2 text-sm"
              >
                {campuses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              {error && <p className="text-sm text-accent-dark">{error}</p>}
              <Button type="submit" disabled={submitting}>
                {submitting ? "Creando..." : "Crear alumno"}
              </Button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
