import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getCampusScope } from "@/lib/campus-scope";
import { prisma } from "@/lib/prisma";
import { BitacoraCalendarView, type BitacoraEntry } from "@/components/admin/bitacora-calendar-view";
import type { ReceptionLogType, Role } from "@prisma/client";

const TYPE_LABELS: Record<ReceptionLogType, string> = {
  LLAMADA: "Llamada",
  INCIDENCIA: "Incidencia",
  NOTA: "Nota",
};

// Bitácora de recepción. The user asked (2026-09-09) for a calendar here
// too — the month grid browses history, a day opens its notes, and
// entries are still recorded at "now" through /api/admin/reception-log.
export default async function BitacoraPage({
  searchParams,
}: {
  searchParams: Promise<{ altas?: string; bajas?: string }>;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  const role = (session.user as { role: Role }).role;
  if (role !== "ADMIN" && role !== "STAFF") redirect("/portal");

  const scope = await getCampusScope(session.user as { id: string; role: Role });
  const campusWhere =
    scope.type === "ALL" ? {} : scope.type === "CAMPUS_LIST" ? { campusId: { in: scope.campusIds } } : { id: { in: [] } };

  // Enough history for the calendar to be useful without loading everything.
  const rangeStart = new Date();
  rangeStart.setMonth(rangeStart.getMonth() - 3);
  rangeStart.setHours(0, 0, 0, 0);

  const [entries, campuses] = await Promise.all([
    prisma.receptionLogEntry.findMany({
      where: { ...campusWhere, createdAt: { gte: rangeStart } },
      orderBy: { createdAt: "desc" },
      include: { createdBy: { select: { id: true, name: true } }, campus: { select: { name: true } } },
    }),
    scope.type === "ALL"
      ? prisma.campus.findMany({ orderBy: { name: "asc" } })
      : prisma.campus.findMany({
          where: scope.type === "CAMPUS_LIST" ? { id: { in: scope.campusIds } } : { id: { in: [] } },
          orderBy: { name: "asc" },
        }),
  ]);

  const calendarEntries: BitacoraEntry[] = entries.map((e) => ({
    id: e.id,
    type: e.type,
    note: e.note,
    createdAt: e.createdAt.toISOString(),
    campusName: e.campus.name,
    authorName: e.createdBy.name,
  }));

  async function generateMonthlyReport() {
    "use server";

    const session = await auth();
    if (!session?.user) redirect("/login");
    const role = (session.user as { role: Role }).role;
    if (role !== "ADMIN" && role !== "STAFF") redirect("/portal");

    const scope = await getCampusScope(session.user as { id: string; role: Role });
    const reportCampusWhere =
      scope.type === "ALL" ? {} : scope.type === "CAMPUS_LIST" ? { campusId: { in: scope.campusIds } } : { id: { in: [] } };

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const [altas, bajas] = await Promise.all([
      prisma.lead.count({
        where: { ...reportCampusWhere, status: "ENROLLED", createdAt: { gte: monthStart, lt: monthEnd } },
      }),
      prisma.student.count({
        where: { ...reportCampusWhere, estatusAlumno: "BAJA", createdAt: { gte: monthStart, lt: monthEnd } },
      }),
    ]);

    redirect(`/admin/recepcion/bitacora?altas=${altas}&bajas=${bajas}`);
  }

  const params = await searchParams;
  const todayStr = new Date().toDateString();
  const todayEntries = entries.filter((e) => e.createdAt.toDateString() === todayStr);

  return (
    <div>
      <h1 className="text-lg font-semibold">Bitácora</h1>
      <p className="mt-1 text-sm text-muted">
        Registro de recepción. Haz clic en un día para ver o agregar notas.
      </p>

      {(params.altas !== undefined || params.bajas !== undefined) && (
        <div className="mt-4 rounded-md border border-primary bg-primary/10 px-4 py-3 text-sm">
          <p className="font-semibold">Reporte mensual</p>
          <p className="mt-1 text-muted">
            Altas: <span className="font-medium text-foreground">{params.altas ?? 0}</span> · Bajas:{" "}
            <span className="font-medium text-foreground">{params.bajas ?? 0}</span>
          </p>
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <form action={generateMonthlyReport}>
          <button
            type="submit"
            className="rounded-md border border-border px-4 py-1.5 text-sm font-medium hover:bg-surface"
          >
            Generar reporte mensual
          </button>
        </form>
      </div>

      <div className="mt-6">
        <BitacoraCalendarView entries={calendarEntries} campuses={campuses.map((c) => ({ id: c.id, name: c.name }))} />
      </div>

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-muted">Hoy</h2>
      <div className="mt-3 space-y-2">
        {todayEntries.map((entry) => (
          <div key={entry.id} className="rounded-md border border-border bg-white p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-medium">{TYPE_LABELS[entry.type]}</span>
              <span className="text-xs text-muted">{entry.createdAt.toLocaleString("es-MX")}</span>
            </div>
            <p className="mt-1 text-muted">{entry.note}</p>
            <p className="mt-1 text-xs text-muted">Por {entry.createdBy.name}</p>
          </div>
        ))}
        {todayEntries.length === 0 && <p className="text-sm text-muted">No hay registros de bitácora hoy.</p>}
      </div>
    </div>
  );
}
