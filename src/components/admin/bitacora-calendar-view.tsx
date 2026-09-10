"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Tag } from "@/components/ui/tag";
import { MonthCalendar, type CalendarEvent } from "@/components/ui/month-calendar";
import type { ReceptionLogType } from "@prisma/client";

export interface BitacoraEntry {
  id: string;
  type: ReceptionLogType;
  note: string;
  createdAt: string;
  campusName: string;
  authorName: string;
}

const TYPE_LABELS: Record<ReceptionLogType, string> = {
  LLAMADA: "Llamada",
  INCIDENCIA: "Incidencia",
  NOTA: "Nota",
};
const TYPE_TONE: Record<ReceptionLogType, "blue" | "red" | "gray"> = {
  LLAMADA: "blue",
  INCIDENCIA: "red",
  NOTA: "gray",
};
const CHIP_TONE: Record<ReceptionLogType, string> = {
  LLAMADA: "bg-blue-100 text-blue-800",
  INCIDENCIA: "bg-red-100 text-red-800",
  NOTA: "bg-gray-200 text-gray-700",
};

// Bitácora as a month calendar — the user suggested (2026-09-09) a
// calendar "would work here too". Browse past days at a glance, click a
// day to add a note, click an entry to read it in full.
export function BitacoraCalendarView({
  entries,
  campuses,
}: {
  entries: BitacoraEntry[];
  campuses: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [dayView, setDayView] = useState<Date | null>(null);
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<BitacoraEntry | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [campusId, setCampusId] = useState(campuses[0]?.id ?? "");
  const [type, setType] = useState<ReceptionLogType>("NOTA");
  const [note, setNote] = useState("");

  const events = useMemo<CalendarEvent[]>(
    () =>
      entries.map((e) => ({
        id: e.id,
        date: new Date(e.createdAt),
        title: `${TYPE_LABELS[e.type]}: ${e.note}`,
        toneClass: CHIP_TONE[e.type],
      })),
    [entries]
  );

  const dayEntries = useMemo(() => {
    if (!dayView) return [];
    return entries
      .filter((e) => {
        const d = new Date(e.createdAt);
        return (
          d.getFullYear() === dayView.getFullYear() &&
          d.getMonth() === dayView.getMonth() &&
          d.getDate() === dayView.getDate()
        );
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [entries, dayView]);

  async function submitCreate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/reception-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campusId, type, note: note.trim() }),
    });
    setBusy(false);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setError(b.error ?? "No se pudo guardar");
      return;
    }
    setNote("");
    setCreating(false);
    setDayView(null);
    router.refresh();
  }

  return (
    <>
      <MonthCalendar
        events={events}
        onDayClick={(d) => {
          setDayView(d);
          setError(null);
        }}
        onEventClick={(id) => setSelected(entries.find((e) => e.id === id) ?? null)}
      />

      {/* Day view */}
      <Modal open={dayView !== null && !creating} onClose={() => setDayView(null)} widthClassName="max-w-md">
        {dayView && (
          <>
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-lg font-semibold capitalize text-primary">
                {dayView.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" })}
              </h2>
              <Button type="button" onClick={() => setCreating(true)}>
                + Nota
              </Button>
            </div>
            <div className="mt-4 space-y-2">
              {dayEntries.length === 0 && <p className="text-sm text-muted">Sin registros este día.</p>}
              {dayEntries.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => setSelected(e)}
                  className="block w-full rounded-lg border border-border bg-white p-3 text-left text-sm hover:bg-surface"
                >
                  <div className="flex items-center justify-between">
                    <Tag tone={TYPE_TONE[e.type]}>{TYPE_LABELS[e.type]}</Tag>
                    <span className="text-xs text-muted">
                      {new Date(e.createdAt).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-muted">{e.note}</p>
                </button>
              ))}
            </div>
          </>
        )}
      </Modal>

      {/* Create */}
      <Modal open={creating} onClose={() => setCreating(false)} widthClassName="max-w-md">
        <h2 className="font-display text-lg font-semibold text-primary">Nueva nota de bitácora</h2>
        <p className="mt-1 text-xs text-muted">Se registra con la fecha y hora actuales.</p>
        <form onSubmit={submitCreate} className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-3">
            <select
              value={campusId}
              onChange={(e) => setCampusId(e.target.value)}
              required
              aria-label="Plantel"
              className="flex-1 rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
            >
              {campuses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as ReceptionLogType)}
              required
              aria-label="Tipo"
              className="flex-1 rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
            >
              {(Object.keys(TYPE_LABELS) as ReceptionLogType[]).map((t) => (
                <option key={t} value={t}>
                  {TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            required
            placeholder="Nota..."
            maxLength={2000}
            className="min-h-[100px] w-full rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
          />
          {error && <p className="text-xs text-accent-dark">{error}</p>}
          <div className="flex gap-3 pt-1">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setCreating(false)}>
              Cancelar
            </Button>
            <Button type="submit" className="flex-1" disabled={busy}>
              {busy ? "Guardando..." : "Agregar"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Entry detail */}
      <Modal open={selected !== null} onClose={() => setSelected(null)} widthClassName="max-w-md">
        {selected && (
          <>
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-lg font-semibold text-primary">{TYPE_LABELS[selected.type]}</h2>
              <Tag tone={TYPE_TONE[selected.type]}>{selected.campusName}</Tag>
            </div>
            <p className="mt-3 whitespace-pre-wrap text-sm text-foreground">{selected.note}</p>
            <p className="mt-4 text-xs text-muted">
              {new Date(selected.createdAt).toLocaleString("es-MX")} · por {selected.authorName}
            </p>
          </>
        )}
      </Modal>
    </>
  );
}
