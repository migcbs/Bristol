import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { getCampusScope, leadScopeWhere } from "@/lib/campus-scope";
import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";

const OVERLAP_WINDOW_MS = 30 * 60 * 1000;

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
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

  const [appointments, leads, campuses] = await Promise.all([
    prisma.placementAppointment.findMany({
      where: campusWhere,
      orderBy: { scheduledFor: "asc" },
      include: { lead: true, campus: true },
    }),
    prisma.lead.findMany({ where: leadScopeWhere(scope), orderBy: { name: "asc" } }),
    scope.type === "ALL"
      ? prisma.campus.findMany({ orderBy: { name: "asc" } })
      : prisma.campus.findMany({
          where: scope.type === "CAMPUS_LIST" ? { id: { in: scope.campusIds } } : { id: { in: [] } },
          orderBy: { name: "asc" },
        }),
  ]);

  const grouped = new Map<string, typeof appointments>();
  for (const appt of appointments) {
    const key = appt.scheduledFor.toLocaleDateString("es-MX", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const bucket = grouped.get(key);
    if (bucket) {
      bucket.push(appt);
    } else {
      grouped.set(key, [appt]);
    }
  }

  async function createAppointment(formData: FormData) {
    "use server";

    const session = await auth();
    if (!session?.user) redirect("/login");
    const role = (session.user as { role: Role }).role;
    if (role !== "ADMIN" && role !== "STAFF") redirect("/portal");

    const leadId = formData.get("leadId")?.toString();
    const campusId = formData.get("campusId")?.toString();
    const scheduledForRaw = formData.get("scheduledFor")?.toString();

    if (!leadId || !campusId || !scheduledForRaw) {
      redirect("/admin/recepcion/agenda?error=Datos+inv%C3%A1lidos");
    }

    const scope = await getCampusScope(session.user as { id: string; role: Role });
    if (role === "STAFF") {
      const inScope = scope.type === "ALL" || (scope.type === "CAMPUS_LIST" && scope.campusIds.includes(campusId));
      if (!inScope) {
        redirect("/admin/recepcion/agenda?error=No+autorizado");
      }
    }

    const scheduledFor = new Date(scheduledForRaw);
    if (Number.isNaN(scheduledFor.getTime())) {
      redirect("/admin/recepcion/agenda?error=Fecha+inv%C3%A1lida");
    }

    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) {
      redirect("/admin/recepcion/agenda?error=Lead+no+encontrado");
    }

    const windowStart = new Date(scheduledFor.getTime() - OVERLAP_WINDOW_MS);
    const windowEnd = new Date(scheduledFor.getTime() + OVERLAP_WINDOW_MS);
    const overlapping = await prisma.placementAppointment.findMany({
      where: { campusId, scheduledFor: { gte: windowStart, lte: windowEnd } },
    });
    if (overlapping.length > 0) {
      redirect("/admin/recepcion/agenda?error=Ya+existe+una+cita+en+ese+horario");
    }

    await prisma.placementAppointment.create({
      data: { leadId, campusId, scheduledFor },
    });

    revalidatePath("/admin/recepcion/agenda");
    redirect("/admin/recepcion/agenda");
  }

  const params = await searchParams;

  return (
    <div>
      <h1 className="text-lg font-semibold">Agenda</h1>
      <p className="mt-1 text-sm text-muted">
        Exámenes de colocación programados, agrupados por día.
      </p>

      {params.error && (
        <p className="mt-4 rounded-md border border-accent bg-accent/10 px-3 py-2 text-sm text-accent-dark">
          {decodeURIComponent(params.error)}
        </p>
      )}

      <form action={createAppointment} className="mt-6 flex flex-wrap items-end gap-3 rounded-lg border border-border bg-surface p-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="leadId" className="text-xs font-medium text-muted">
            Lead
          </label>
          <select
            id="leadId"
            name="leadId"
            required
            className="rounded-md border border-border px-2 py-1.5 text-sm"
          >
            {leads.map((lead) => (
              <option key={lead.id} value={lead.id}>
                {lead.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="campusId" className="text-xs font-medium text-muted">
            Plantel
          </label>
          <select
            id="campusId"
            name="campusId"
            required
            className="rounded-md border border-border px-2 py-1.5 text-sm"
          >
            {campuses.map((campus) => (
              <option key={campus.id} value={campus.id}>
                {campus.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="scheduledFor" className="text-xs font-medium text-muted">
            Fecha y hora
          </label>
          <input
            id="scheduledFor"
            name="scheduledFor"
            type="datetime-local"
            required
            className="rounded-md border border-border px-2 py-1.5 text-sm"
          />
        </div>
        <button
          type="submit"
          className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground"
        >
          Agendar
        </button>
      </form>

      <div className="mt-8 space-y-6">
        {Array.from(grouped.entries()).map(([day, dayAppointments]) => (
          <div key={day}>
            <h2 className="text-sm font-semibold capitalize">{day}</h2>
            <div className="mt-2 space-y-2">
              {dayAppointments.map((appt) => (
                <div
                  key={appt.id}
                  className="flex items-center justify-between rounded-md border border-border bg-white p-3 text-sm"
                >
                  <div>
                    <p className="font-medium">{appt.lead.name}</p>
                    <p className="text-xs text-muted">{appt.campus.name}</p>
                  </div>
                  <p className="text-xs text-muted">{appt.scheduledFor.toLocaleString("es-MX")}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
        {appointments.length === 0 && (
          <p className="text-sm text-muted">No hay exámenes de colocación agendados.</p>
        )}
      </div>
    </div>
  );
}
