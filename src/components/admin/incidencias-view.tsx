"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Users, Calendar, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Tag } from "@/components/ui/tag";
import { RecordCard } from "@/components/ui/record-card";
import { MonthCalendar, type CalendarEvent } from "@/components/ui/month-calendar";
import type { IncidentStatus } from "@prisma/client";

export interface IncidenciaRow {
  id: string;
  studentUserId: string;
  studentName: string;
  groupName: string | null;
  description: string;
  status: IncidentStatus;
  resolucion: string | null;
  resolvedByName: string | null;
  reportedByName: string;
  createdAt: string;
}

const STATUS_LABELS: Record<IncidentStatus, string> = {
  ABIERTA: "Abierta",
  EN_SEGUIMIENTO: "En seguimiento",
  RESUELTA: "Resuelta",
};
const STATUS_TONE: Record<IncidentStatus, "amber" | "blue" | "green"> = {
  ABIERTA: "amber",
  EN_SEGUIMIENTO: "blue",
  RESUELTA: "green",
};
const CHIP_TONE: Record<IncidentStatus, string> = {
  ABIERTA: "bg-amber-100 text-amber-800",
  EN_SEGUIMIENTO: "bg-blue-100 text-blue-800",
  RESUELTA: "bg-green-100 text-green-800 line-through",
};

// Incidencias with a calendar and a proper resolution popup — both asked
// for by the user (2026-09-09). The month grid shows when incidents were
// reported; clicking one (chip or card) opens a detail modal where
// Calidad y Control advances it and writes the resolución in a real
// textarea instead of the old cramped inline input.
export function IncidenciasView({
  incidents,
  canManage,
}: {
  incidents: IncidenciaRow[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<IncidenciaRow | null>(null);
  const [resolucion, setResolucion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const events = useMemo<CalendarEvent[]>(
    () =>
      incidents.map((i) => ({
        id: i.id,
        date: new Date(i.createdAt),
        title: i.studentName,
        toneClass: CHIP_TONE[i.status],
      })),
    [incidents]
  );

  function open(row: IncidenciaRow) {
    setSelected(row);
    setResolucion(row.resolucion ?? "");
    setError(null);
  }

  async function patch(status: IncidentStatus) {
    if (!selected) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/incidents/${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, resolucion: status === "RESUELTA" ? resolucion.trim() : undefined }),
    });
    setBusy(false);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setError(b.error ?? "No se pudo actualizar");
      return;
    }
    setSelected(null);
    router.refresh();
  }

  return (
    <>
      <MonthCalendar events={events} onEventClick={(id) => {
        const row = incidents.find((i) => i.id === id);
        if (row) open(row);
      }} />

      <div className="mt-6 grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
        {incidents.map((incident) => (
          <RecordCard
            key={incident.id}
            avatarId={incident.studentUserId}
            avatarLabel={incident.studentName.trim().charAt(0).toUpperCase() || "?"}
            name={incident.studentName}
            dimmed={incident.status === "RESUELTA"}
            onClick={() => open(incident)}
            meta={
              <>
                {incident.groupName && (
                  <span className="flex items-center gap-1">
                    <Users size={11} /> {incident.groupName}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Calendar size={11} /> {new Date(incident.createdAt).toLocaleDateString("es-MX")}
                </span>
                <span>Registrado por {incident.reportedByName}</span>
              </>
            }
            tags={
              <>
                <Tag tone={STATUS_TONE[incident.status]} icon={Clock}>
                  {STATUS_LABELS[incident.status]}
                </Tag>
                <p className="w-full truncate rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-900">
                  {incident.description}
                </p>
                {incident.resolucion && (
                  <p className="w-full truncate rounded-md bg-emerald-50 px-2 py-1 text-xs text-emerald-900">
                    Resolución: {incident.resolucion} {incident.resolvedByName && `— ${incident.resolvedByName}`}
                  </p>
                )}
              </>
            }
          />
        ))}
      </div>

      {incidents.length === 0 && <p className="mt-6 text-center text-sm text-muted">No hay incidencias que mostrar.</p>}

      <Modal open={selected !== null} onClose={() => setSelected(null)} widthClassName="max-w-md">
        {selected && (
          <>
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-lg font-semibold text-primary">{selected.studentName}</h2>
              <Tag tone={STATUS_TONE[selected.status]}>{STATUS_LABELS[selected.status]}</Tag>
            </div>
            <div className="mt-2 space-y-1 text-sm text-muted">
              {selected.groupName && <p>{selected.groupName}</p>}
              <p>{new Date(selected.createdAt).toLocaleString("es-MX")}</p>
              <p>Registrado por {selected.reportedByName}</p>
            </div>
            <p className="mt-3 whitespace-pre-wrap rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {selected.description}
            </p>

            {selected.resolucion && (
              <p className="mt-2 whitespace-pre-wrap rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                Resolución: {selected.resolucion}
                {selected.resolvedByName && ` — ${selected.resolvedByName}`}
              </p>
            )}

            {canManage && selected.status !== "RESUELTA" && (
              <div className="mt-4 space-y-3">
                <div>
                  <label htmlFor="inc-resolucion" className="text-xs font-medium text-muted">
                    Resolución (obligatoria para cerrar)
                  </label>
                  <textarea
                    id="inc-resolucion"
                    value={resolucion}
                    onChange={(e) => setResolucion(e.target.value)}
                    maxLength={300}
                    placeholder="Describe cómo se resolvió la incidencia..."
                    className="mt-1 min-h-[90px] w-full rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                {error && <p className="text-xs text-accent-dark">{error}</p>}
                <div className="flex flex-wrap gap-2">
                  {selected.status === "ABIERTA" && (
                    <Button type="button" variant="outline" disabled={busy} onClick={() => patch("EN_SEGUIMIENTO")}>
                      Marcar en seguimiento
                    </Button>
                  )}
                  <Button type="button" disabled={busy || resolucion.trim().length === 0} onClick={() => patch("RESUELTA")}>
                    Resolver
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </Modal>
    </>
  );
}
