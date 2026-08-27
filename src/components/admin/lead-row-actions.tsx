"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { LeadStatus } from "@prisma/client";
import { LEAD_STATUS_LABELS } from "@/lib/lead-status";

export function LeadRowActions({
  leadId,
  initialStatus,
  initialCampusId,
  campuses,
}: {
  leadId: string;
  initialStatus: LeadStatus;
  initialCampusId: string | null;
  campuses: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [campusId, setCampusId] = useState(initialCampusId ?? "");
  const [error, setError] = useState<string | null>(null);

  async function update(data: { status?: LeadStatus; campusId?: string | null }) {
    setError(null);
    const res = await fetch(`/api/admin/leads/${leadId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "No se pudo actualizar");
      return false;
    }
    router.refresh();
    return true;
  }

  async function handleStatusChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value as LeadStatus;
    const previous = status;
    setStatus(next);
    const ok = await update({ status: next });
    if (!ok) setStatus(previous);
  }

  async function handleCampusChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value;
    const previous = campusId;
    setCampusId(next);
    const ok = await update({ campusId: next === "" ? null : next });
    if (!ok) setCampusId(previous);
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex gap-2">
        <select
          value={status}
          onChange={handleStatusChange}
          aria-label="Estatus"
          className="rounded-md border border-border px-2 py-1 text-xs"
        >
          {Object.entries(LEAD_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select
          value={campusId}
          onChange={handleCampusChange}
          aria-label="Plantel"
          className="rounded-md border border-border px-2 py-1 text-xs"
        >
          <option value="">Sin asignar</option>
          {campuses.map((campus) => (
            <option key={campus.id} value={campus.id}>
              {campus.name}
            </option>
          ))}
        </select>
      </div>
      {error && <p className="text-xs text-accent-dark">{error}</p>}
    </div>
  );
}
