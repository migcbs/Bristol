import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getCampusScope, leadScopeWhere } from "@/lib/campus-scope";
import { canWriteArea, getCalendarAccess } from "@/lib/staff-calendar";
import { prisma } from "@/lib/prisma";
import {
  AgendaCalendarView,
  type AgendaAppointment,
  type AgendaEntry,
} from "@/components/admin/agenda-calendar-view";
import { RecordCard } from "@/components/ui/record-card";
import { Tag } from "@/components/ui/tag";
import type { PlacementAppointmentStatus, Role } from "@prisma/client";

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

// Agenda de exámenes de ubicación. The user asked (2026-09-09) for this
// to look "literally like Google Calendar" — a month grid where you click
// a day to schedule and click an exam to record its outcome. Scheduling
// and status changes go through /api/admin/placement-appointments; a lead
// can only hold one PROGRAMADA appointment at a time.
export default async function AgendaPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  const role = (session.user as { role: Role }).role;
  if (role !== "ADMIN" && role !== "STAFF") redirect("/portal");

  const scope = await getCampusScope(session.user as { id: string; role: Role });

  const campusWhere =
    scope.type === "ALL" ? {} : scope.type === "CAMPUS_LIST" ? { campusId: { in: scope.campusIds } } : { id: { in: [] } };

  const calendarAccess = await getCalendarAccess(session.user as { id: string; role: Role });
  const canManageEntries = canWriteArea(calendarAccess, "RECEPCION");

  const [appointments, entries, leads, campuses] = await Promise.all([
    prisma.placementAppointment.findMany({
      where: campusWhere,
      orderBy: { scheduledFor: "asc" },
      include: { lead: true, campus: true },
    }),
    // Free-form agenda entries — Recepción's slice of the área calendar,
    // shown here too so Recepción has one place to plan its day.
    prisma.staffCalendarEvent.findMany({
      where: {
        area: "RECEPCION",
        ...(scope.type === "CAMPUS_LIST" ? { OR: [{ campusId: null }, { campusId: { in: scope.campusIds } }] } : {}),
      },
      orderBy: { startsAt: "asc" },
      include: { campus: { select: { name: true } }, createdBy: { select: { name: true } } },
    }),
    prisma.lead.findMany({
      where: { ...leadScopeWhere(scope), placementAppointments: { none: { status: "PROGRAMADA" } } },
      orderBy: { name: "asc" },
    }),
    scope.type === "ALL"
      ? prisma.campus.findMany({ orderBy: { name: "asc" } })
      : prisma.campus.findMany({
          where: scope.type === "CAMPUS_LIST" ? { id: { in: scope.campusIds } } : { id: { in: [] } },
          orderBy: { name: "asc" },
        }),
  ]);

  const calendarEntries: AgendaEntry[] = entries.map((e) => ({
    id: e.id,
    title: e.title,
    description: e.description,
    startsAt: e.startsAt.toISOString(),
    endsAt: e.endsAt ? e.endsAt.toISOString() : null,
    campusId: e.campusId,
    campusName: e.campus?.name ?? null,
    createdByName: e.createdBy.name,
  }));

  const calendarAppointments: AgendaAppointment[] = appointments.map((a) => ({
    id: a.id,
    leadId: a.leadId,
    leadName: a.lead.name,
    campusId: a.campusId,
    campusName: a.campus.name,
    scheduledFor: a.scheduledFor.toISOString(),
    status: a.status,
    resultado: a.resultado,
    notes: a.notes,
  }));

  const now = new Date();
  const pasadasRecientes = appointments
    .filter((a) => a.status !== "PROGRAMADA" || a.scheduledFor < now)
    .sort((a, b) => b.scheduledFor.getTime() - a.scheduledFor.getTime())
    .slice(0, 6);

  return (
    <div>
      <h1 className="text-lg font-semibold">Agenda</h1>
      <p className="mt-1 text-sm text-muted">
        Exámenes de colocación y entradas de agenda de Recepción. Haz clic en un día para agregar y en un evento
        para abrirlo.
      </p>

      <div className="mt-6">
        <AgendaCalendarView
          appointments={calendarAppointments}
          entries={calendarEntries}
          leads={leads.map((l) => ({ id: l.id, name: l.name }))}
          campuses={campuses.map((c) => ({ id: c.id, name: c.name }))}
          canManageEntries={canManageEntries}
        />
      </div>

      {pasadasRecientes.length > 0 && (
        <>
          <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-muted">Pasadas recientes</h2>
          <div className="mt-3 grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
            {pasadasRecientes.map((appt) => (
              <RecordCard
                key={appt.id}
                avatarId={appt.id}
                avatarLabel={appt.lead.name.trim().charAt(0).toUpperCase() || "?"}
                name={appt.lead.name}
                dimmed
                meta={
                  <>
                    <span>{appt.campus.name}</span>
                    <span>{appt.scheduledFor.toLocaleString("es-MX")}</span>
                    {appt.resultado && <span className="w-full truncate">Resultado: {appt.resultado}</span>}
                  </>
                }
                tags={<Tag tone={STATUS_TONE[appt.status]}>{STATUS_LABELS[appt.status]}</Tag>}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
