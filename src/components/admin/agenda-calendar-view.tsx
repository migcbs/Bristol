"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Tag } from "@/components/ui/tag";
import { MonthCalendar, type CalendarEvent } from "@/components/ui/month-calendar";
import type { PlacementAppointmentStatus } from "@prisma/client";

export interface AgendaAppointment {
  id: string;
  leadId: string;
  leadName: string;
  campusId: string;
  campusName: string;
  scheduledFor: string;
  status: PlacementAppointmentStatus;
  resultado: string | null;
  notes: string | null;
}

// A free-form Recepción agenda entry (a StaffCalendarEvent, area
// RECEPCION). The user wanted the Agenda itself to work as a full
// calendar you can add anything to (2026-09-09) — no separate screen.
export interface AgendaEntry {
  id: string;
  title: string;
  description: string | null;
  startsAt: string;
  endsAt: string | null;
  campusId: string | null;
  campusName: string | null;
  createdByName: string;
}

const STATUS_LABELS: Record<PlacementAppointmentStatus, string> = {
  PROGRAMADA: "Programada",
  REALIZADA: "Realizada",
  CANCELADA: "Cancelada",
  NO_ASISTIO: "No asistió",
};
const STATUS_TONE: Record<PlacementAppointmentStatus, "blue" | "green" | "gray" | "red"> = {
  PROGRAMADA: "blue",
  REALIZADA: "green",
  CANCELADA: "gray",
  NO_ASISTIO: "red",
};
const CHIP_TONE: Record<PlacementAppointmentStatus, string> = {
  PROGRAMADA: "bg-blue-100 text-blue-800",
  REALIZADA: "bg-green-100 text-green-800",
  CANCELADA: "bg-gray-200 text-gray-600 line-through",
  NO_ASISTIO: "bg-red-100 text-red-800",
};
const ENTRY_CHIP = "bg-primary/10 text-primary";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

// Agenda as a month calendar — the user asked for it to look "literally
// like Google Calendar" (2026-09-09), modeled on BOOZ's class-creation
// calendar. Two kinds of events live here: placement exams (tied to a
// lead, with an outcome) and free-form agenda entries (like the área
// calendar). Click a day to add either; click a chip to open it.
export function AgendaCalendarView({
  appointments,
  entries,
  leads,
  campuses,
  canManageEntries,
}: {
  appointments: AgendaAppointment[];
  entries: AgendaEntry[];
  leads: { id: string; name: string }[];
  campuses: { id: string; name: string }[];
  canManageEntries: boolean;
}) {
  const router = useRouter();
  const [createFor, setCreateFor] = useState<Date | null>(null);
  const [mode, setMode] = useState<"entrada" | "examen">("entrada");
  const [selectedAppt, setSelectedAppt] = useState<AgendaAppointment | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<AgendaEntry | null>(null);
  const [editingEntry, setEditingEntry] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // placement-exam form
  const [leadId, setLeadId] = useState("");
  const [examCampusId, setExamCampusId] = useState("");
  const [examTime, setExamTime] = useState("09:00");
  const [resultado, setResultado] = useState("");

  // entry form
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("");
  const [entryCampusId, setEntryCampusId] = useState("");

  const events = useMemo<CalendarEvent[]>(() => {
    const apptEvents = appointments.map((a) => {
      const d = new Date(a.scheduledFor);
      return {
        id: `appt:${a.id}`,
        date: d,
        title: `${pad(d.getHours())}:${pad(d.getMinutes())} ${a.leadName}`,
        toneClass: CHIP_TONE[a.status],
      };
    });
    const entryEvents = entries.map((e) => {
      const d = new Date(e.startsAt);
      return {
        id: `entry:${e.id}`,
        date: d,
        title: `${pad(d.getHours())}:${pad(d.getMinutes())} ${e.title}`,
        toneClass: ENTRY_CHIP,
      };
    });
    return [...apptEvents, ...entryEvents];
  }, [appointments, entries]);

  function combine(day: Date, hhmm: string) {
    const [hh, mm] = hhmm.split(":").map(Number);
    const out = new Date(day);
    out.setHours(hh || 0, mm || 0, 0, 0);
    return out;
  }

  function openCreate(date: Date) {
    setCreateFor(date);
    setMode(canManageEntries ? "entrada" : "examen");
    setError(null);
    // reset both forms
    setLeadId(leads[0]?.id ?? "");
    setExamCampusId(campuses[0]?.id ?? "");
    setExamTime("09:00");
    setTitle("");
    setDescription("");
    setStartTime("09:00");
    setEndTime("");
    setEntryCampusId("");
  }

  function onEventClick(rawId: string) {
    const [kind, id] = rawId.split(":");
    if (kind === "appt") {
      const appt = appointments.find((a) => a.id === id) ?? null;
      setResultado(appt?.resultado ?? "");
      setError(null);
      setSelectedAppt(appt);
    } else {
      const entry = entries.find((e) => e.id === id) ?? null;
      if (entry) {
        setTitle(entry.title);
        setDescription(entry.description ?? "");
        const s = new Date(entry.startsAt);
        setStartTime(`${pad(s.getHours())}:${pad(s.getMinutes())}`);
        setEndTime(entry.endsAt ? new Date(entry.endsAt).toTimeString().slice(0, 5) : "");
        setEntryCampusId(entry.campusId ?? "");
      }
      setEditingEntry(false);
      setError(null);
      setSelectedEntry(entry);
    }
  }

  async function submitExam(e: React.FormEvent) {
    e.preventDefault();
    if (!createFor || !leadId || !examCampusId) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/placement-appointments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leadId, campusId: examCampusId, scheduledFor: combine(createFor, examTime).toISOString() }),
    });
    setBusy(false);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setError(b.error ?? "No se pudo agendar");
      return;
    }
    setCreateFor(null);
    router.refresh();
  }

  async function submitEntry(e: React.FormEvent) {
    e.preventDefault();
    if (!createFor || !title.trim()) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/calendario", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        area: "RECEPCION",
        campusId: entryCampusId || null,
        title: title.trim(),
        description: description.trim() || undefined,
        startsAt: combine(createFor, startTime).toISOString(),
        endsAt: endTime ? combine(createFor, endTime).toISOString() : null,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setError(b.error ?? "No se pudo guardar");
      return;
    }
    setCreateFor(null);
    router.refresh();
  }

  async function setStatus(status: PlacementAppointmentStatus) {
    if (!selectedAppt) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/placement-appointments/${selectedAppt.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, resultado: status === "REALIZADA" ? resultado : undefined }),
    });
    setBusy(false);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setError(b.error ?? "No se pudo actualizar");
      return;
    }
    setSelectedAppt(null);
    router.refresh();
  }

  async function submitEntryEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedEntry) return;
    setBusy(true);
    setError(null);
    const day = new Date(selectedEntry.startsAt);
    const res = await fetch(`/api/admin/calendario/${selectedEntry.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.trim(),
        description: description.trim() || null,
        startsAt: combine(day, startTime).toISOString(),
        endsAt: endTime ? combine(day, endTime).toISOString() : null,
        campusId: entryCampusId || null,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setError(b.error ?? "No se pudo guardar");
      return;
    }
    setSelectedEntry(null);
    router.refresh();
  }

  async function deleteEntry() {
    if (!selectedEntry) return;
    setBusy(true);
    const res = await fetch(`/api/admin/calendario/${selectedEntry.id}`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setError(b.error ?? "No se pudo eliminar");
      return;
    }
    setSelectedEntry(null);
    router.refresh();
  }

  const noLeads = leads.length === 0;

  return (
    <>
      <MonthCalendar events={events} onDayClick={(d) => openCreate(d)} onEventClick={onEventClick} />

      {/* Create */}
      <Modal open={createFor !== null} onClose={() => setCreateFor(null)} widthClassName="max-w-md">
        {createFor && (
          <p className="text-sm capitalize text-muted">
            {createFor.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" })}
          </p>
        )}

        {canManageEntries && (
          <div className="mt-2 flex gap-1 rounded-lg bg-surface p-1 text-xs">
            {(["entrada", "examen"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMode(m);
                  setError(null);
                }}
                className={`flex-1 rounded-md px-3 py-1.5 font-medium transition-colors ${
                  mode === m ? "bg-white text-primary shadow-sm" : "text-muted"
                }`}
              >
                {m === "entrada" ? "Entrada de agenda" : "Examen de ubicación"}
              </button>
            ))}
          </div>
        )}

        {mode === "entrada" && canManageEntries ? (
          <form onSubmit={submitEntry} className="mt-4 space-y-3">
            <div>
              <label htmlFor="ag-title" className="text-xs font-medium text-muted">
                Título
              </label>
              <input
                id="ag-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                maxLength={160}
                className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label htmlFor="ag-start" className="text-xs font-medium text-muted">
                  Inicio
                </label>
                <input
                  id="ag-start"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  required
                  className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div className="flex-1">
                <label htmlFor="ag-end" className="text-xs font-medium text-muted">
                  Fin (opcional)
                </label>
                <input
                  id="ag-end"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
                />
              </div>
            </div>
            {campuses.length > 1 && (
              <div>
                <label htmlFor="ag-campus" className="text-xs font-medium text-muted">
                  Plantel (opcional)
                </label>
                <select
                  id="ag-campus"
                  value={entryCampusId}
                  onChange={(e) => setEntryCampusId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
                >
                  <option value="">Sin plantel</option>
                  {campuses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label htmlFor="ag-desc" className="text-xs font-medium text-muted">
                Notas (opcional)
              </label>
              <textarea
                id="ag-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={2000}
                className="mt-1 min-h-[70px] w-full rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
              />
            </div>
            {error && <p className="text-xs text-accent-dark">{error}</p>}
            <div className="flex gap-3 pt-1">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setCreateFor(null)}>
                Cancelar
              </Button>
              <Button type="submit" className="flex-1" disabled={busy}>
                {busy ? "Guardando..." : "Agregar entrada"}
              </Button>
            </div>
          </form>
        ) : (
          <>
            <h2 className="mt-3 font-display text-lg font-semibold text-primary">Agendar examen de ubicación</h2>
            {noLeads ? (
              <p className="mt-3 text-sm text-muted">
                No hay leads sin cita programada. Registra un lead en Admisiones primero.
              </p>
            ) : (
              <form onSubmit={submitExam} className="mt-4 space-y-3">
                <div>
                  <label htmlFor="ag-leadId" className="text-xs font-medium text-muted">
                    Lead
                  </label>
                  <select
                    id="ag-leadId"
                    value={leadId}
                    onChange={(e) => setLeadId(e.target.value)}
                    required
                    className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
                  >
                    {leads.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="ag-examCampus" className="text-xs font-medium text-muted">
                    Plantel
                  </label>
                  <select
                    id="ag-examCampus"
                    value={examCampusId}
                    onChange={(e) => setExamCampusId(e.target.value)}
                    required
                    className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
                  >
                    {campuses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="ag-examTime" className="text-xs font-medium text-muted">
                    Hora
                  </label>
                  <input
                    id="ag-examTime"
                    type="time"
                    value={examTime}
                    onChange={(e) => setExamTime(e.target.value)}
                    required
                    className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                {error && <p className="text-xs text-accent-dark">{error}</p>}
                <div className="flex gap-3 pt-1">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setCreateFor(null)}>
                    Cancelar
                  </Button>
                  <Button type="submit" className="flex-1" disabled={busy}>
                    {busy ? "Agendando..." : "Agendar"}
                  </Button>
                </div>
              </form>
            )}
          </>
        )}
      </Modal>

      {/* Placement-exam detail / outcome */}
      <Modal open={selectedAppt !== null} onClose={() => setSelectedAppt(null)} widthClassName="max-w-md">
        {selectedAppt && (
          <>
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-lg font-semibold text-primary">{selectedAppt.leadName}</h2>
              <Tag tone={STATUS_TONE[selectedAppt.status]}>{STATUS_LABELS[selectedAppt.status]}</Tag>
            </div>
            <div className="mt-2 space-y-1 text-sm text-muted">
              <p>{selectedAppt.campusName}</p>
              <p>{new Date(selectedAppt.scheduledFor).toLocaleString("es-MX")}</p>
              {selectedAppt.resultado && <p>Resultado: {selectedAppt.resultado}</p>}
            </div>

            {selectedAppt.status === "PROGRAMADA" ? (
              <div className="mt-4 space-y-3">
                <div>
                  <label htmlFor="ag-resultado" className="text-xs font-medium text-muted">
                    Nivel sugerido / resultado (al marcar realizada)
                  </label>
                  <input
                    id="ag-resultado"
                    type="text"
                    value={resultado}
                    onChange={(e) => setResultado(e.target.value)}
                    maxLength={200}
                    className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                {error && <p className="text-xs text-accent-dark">{error}</p>}
                <div className="flex flex-wrap gap-2">
                  <Button type="button" disabled={busy} onClick={() => setStatus("REALIZADA")}>
                    Marcar realizada
                  </Button>
                  <Button type="button" variant="outline" disabled={busy} onClick={() => setStatus("NO_ASISTIO")}>
                    No asistió
                  </Button>
                  <Button type="button" variant="outline" disabled={busy} onClick={() => setStatus("CANCELADA")}>
                    Cancelar cita
                  </Button>
                </div>
              </div>
            ) : (
              <p className="mt-4 text-sm text-muted">
                Esta cita ya está cerrada. Para reprogramar, agenda una nueva desde un día del calendario.
              </p>
            )}
          </>
        )}
      </Modal>

      {/* Agenda entry detail / edit */}
      <Modal open={selectedEntry !== null} onClose={() => setSelectedEntry(null)} widthClassName="max-w-md">
        {selectedEntry && !editingEntry && (
          <>
            <h2 className="font-display text-lg font-semibold text-primary">{selectedEntry.title}</h2>
            <div className="mt-2 space-y-1 text-sm text-muted">
              <p>
                {new Date(selectedEntry.startsAt).toLocaleString("es-MX", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
                {selectedEntry.endsAt &&
                  ` – ${new Date(selectedEntry.endsAt).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}`}
              </p>
              {selectedEntry.campusName && <p>{selectedEntry.campusName}</p>}
              <p>Creado por {selectedEntry.createdByName}</p>
            </div>
            {selectedEntry.description && (
              <p className="mt-3 whitespace-pre-wrap rounded-lg bg-surface px-3 py-2 text-sm text-text">
                {selectedEntry.description}
              </p>
            )}
            {error && <p className="mt-2 text-xs text-accent-dark">{error}</p>}
            {canManageEntries && (
              <div className="mt-4 flex gap-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setEditingEntry(true)}>
                  Editar
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="flex items-center gap-1.5 text-accent-dark"
                  disabled={busy}
                  onClick={deleteEntry}
                >
                  <Trash2 size={14} /> Eliminar
                </Button>
              </div>
            )}
          </>
        )}
        {selectedEntry && editingEntry && (
          <>
            <h2 className="font-display text-lg font-semibold text-primary">Editar entrada</h2>
            <form onSubmit={submitEntryEdit} className="mt-4 space-y-3">
              <div>
                <label htmlFor="ag-etitle" className="text-xs font-medium text-muted">
                  Título
                </label>
                <input
                  id="ag-etitle"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  maxLength={160}
                  className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label htmlFor="ag-estart" className="text-xs font-medium text-muted">
                    Inicio
                  </label>
                  <input
                    id="ag-estart"
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    required
                    className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <div className="flex-1">
                  <label htmlFor="ag-eend" className="text-xs font-medium text-muted">
                    Fin (opcional)
                  </label>
                  <input
                    id="ag-eend"
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              </div>
              {campuses.length > 1 && (
                <div>
                  <label htmlFor="ag-ecampus" className="text-xs font-medium text-muted">
                    Plantel (opcional)
                  </label>
                  <select
                    id="ag-ecampus"
                    value={entryCampusId}
                    onChange={(e) => setEntryCampusId(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
                  >
                    <option value="">Sin plantel</option>
                    {campuses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label htmlFor="ag-edesc" className="text-xs font-medium text-muted">
                  Notas (opcional)
                </label>
                <textarea
                  id="ag-edesc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={2000}
                  className="mt-1 min-h-[70px] w-full rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
                />
              </div>
              {error && <p className="text-xs text-accent-dark">{error}</p>}
              <div className="flex gap-3 pt-1">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setEditingEntry(false)}>
                  Cancelar
                </Button>
                <Button type="submit" className="flex-1" disabled={busy}>
                  {busy ? "Guardando..." : "Guardar"}
                </Button>
              </div>
            </form>
          </>
        )}
      </Modal>
    </>
  );
}
