"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

const ROLE_OPTIONS = ["ADMIN", "STAFF", "TEACHER", "STUDENT", "PARENT"];

export function AnnouncementForm({
  isAdmin,
  campuses,
}: {
  isAdmin: boolean;
  campuses: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<"ALL" | "CAMPUS" | "ROLE">("CAMPUS");
  const [campusId, setCampusId] = useState(campuses[0]?.id ?? "");
  const [targetRole, setTargetRole] = useState("TEACHER");
  const [sendEmail, setSendEmail] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/announcements", {
        method: "POST",
        body: JSON.stringify({
          title,
          body,
          audience,
          campusId: audience === "CAMPUS" ? campusId : undefined,
          role: audience === "ROLE" ? targetRole : undefined,
          sendEmail,
        }),
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "No se pudo publicar el anuncio");
        return;
      }

      setTitle("");
      setBody("");
      router.refresh();
    } catch {
      setError("No se pudo publicar el anuncio");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-border bg-white p-4">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Título"
        required
        className="w-full rounded-md border border-border px-3 py-2 text-sm"
      />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Contenido del anuncio"
        required
        rows={3}
        className="w-full rounded-md border border-border px-3 py-2 text-sm"
      />
      <div className="flex flex-wrap gap-3">
        <select
          value={audience}
          onChange={(e) => setAudience(e.target.value as "ALL" | "CAMPUS" | "ROLE")}
          className="rounded-md border border-border px-2 py-1 text-sm"
        >
          {isAdmin && <option value="ALL">Toda la escuela</option>}
          <option value="CAMPUS">Un plantel</option>
          {isAdmin && <option value="ROLE">Un rol</option>}
        </select>

        {audience === "CAMPUS" && (
          <select
            value={campusId}
            onChange={(e) => setCampusId(e.target.value)}
            className="rounded-md border border-border px-2 py-1 text-sm"
          >
            {campuses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}

        {audience === "ROLE" && isAdmin && (
          <select
            value={targetRole}
            onChange={(e) => setTargetRole(e.target.value)}
            className="rounded-md border border-border px-2 py-1 text-sm"
          >
            {ROLE_OPTIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        )}

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} />
          Enviar por correo
        </label>
      </div>
      {error && <p className="text-sm text-accent-dark">{error}</p>}
      <Button type="submit" disabled={submitting}>
        {submitting ? "Publicando..." : "Publicar anuncio"}
      </Button>
    </form>
  );
}
