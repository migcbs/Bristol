"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function ReenrollRowActions({
  enrollmentId,
  groups,
}: {
  enrollmentId: string;
  groups: { id: string; label: string }[];
}) {
  const router = useRouter();
  const [groupId, setGroupId] = useState(groups[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleReenroll() {
    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/admin/reinscripciones", {
      method: "POST",
      body: JSON.stringify({ enrollmentId, newGroupId: groupId }),
      headers: { "Content-Type": "application/json" },
    });

    setSubmitting(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "No se pudo reinscribir");
      return;
    }

    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={groupId}
        onChange={(e) => setGroupId(e.target.value)}
        className="rounded-md border border-border px-2 py-1 text-xs"
        aria-label="Grupo destino"
      >
        {groups.map((g) => (
          <option key={g.id} value={g.id}>
            {g.label}
          </option>
        ))}
      </select>
      <Button type="button" onClick={handleReenroll} disabled={submitting || !groupId}>
        {submitting ? "Reinscribiendo..." : "Reinscribir"}
      </Button>
      {error && <p className="text-xs text-accent-dark">{error}</p>}
    </div>
  );
}
