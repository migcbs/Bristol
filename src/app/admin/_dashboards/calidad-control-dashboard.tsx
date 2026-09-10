import { prisma } from "@/lib/prisma";
import { getCampusScope } from "@/lib/campus-scope";
import { dailySeries, sinceDaysAgo } from "@/lib/analytics-buckets";
import { KpiCard } from "@/components/admin/dashboard/kpi-card";
import { QuickActionTile } from "@/components/admin/dashboard/quick-action-tile";
import { DashboardGreeting } from "@/components/admin/dashboard/dashboard-greeting";
import { PendingBanner } from "@/components/admin/dashboard/pending-banner";
import { RevealGrid } from "@/components/admin/dashboard/reveal-grid";
import { ChartCard } from "@/components/admin/dashboard/chart-card";
import { BarChart, ColumnChart } from "@/components/ui/charts";
import { Ticket, AlertTriangle, FileText, MessageSquare } from "lucide-react";
import type { IncidentStatus, Role, TicketStatus } from "@prisma/client";

const INCIDENT_LABELS: Record<IncidentStatus, string> = {
  ABIERTA: "Abierta",
  EN_SEGUIMIENTO: "En seguimiento",
  RESUELTA: "Resuelta",
};
const TICKET_LABELS: Record<TicketStatus, string> = {
  ABIERTO: "Abierto",
  EN_PROCESO: "En proceso",
  RESUELTO: "Resuelto",
};

export async function CalidadControlDashboard({ user, name }: { user: { id: string; role: Role }; name: string }) {
  const scope = await getCampusScope(user);
  const studentCampusWhere =
    scope.type === "ALL" ? {} : scope.type === "CAMPUS_LIST" ? { campusId: { in: scope.campusIds } } : { id: { in: [] } };

  const sevenDaysAgo = sinceDaysAgo(7);
  const since30 = sinceDaysAgo(30);

  const [ticketsAbiertos, solicitudesPendientes, incidenciasRecientes, incStatusRows, ticketStatusRows, inc30] =
    await Promise.all([
      prisma.interAreaTicket.count({ where: { status: { in: ["ABIERTO", "EN_PROCESO"] } } }),
      prisma.groupChangeRequest.count({ where: { status: "PENDIENTE", student: studentCampusWhere } }),
      prisma.incident.count({ where: { createdAt: { gte: sevenDaysAgo }, student: studentCampusWhere } }),
      prisma.incident.groupBy({ by: ["status"], where: { student: studentCampusWhere }, _count: { _all: true } }),
      prisma.interAreaTicket.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.incident.findMany({
        where: { student: studentCampusWhere, createdAt: { gte: since30 } },
        select: { createdAt: true },
      }),
    ]);

  const incCount = new Map(incStatusRows.map((r) => [r.status, r._count._all]));
  const incData = (Object.keys(INCIDENT_LABELS) as IncidentStatus[]).map((k) => ({
    label: INCIDENT_LABELS[k],
    value: incCount.get(k) ?? 0,
  }));
  const tkCount = new Map(ticketStatusRows.map((r) => [r.status, r._count._all]));
  const tkData = (Object.keys(TICKET_LABELS) as TicketStatus[]).map((k) => ({
    label: TICKET_LABELS[k],
    value: tkCount.get(k) ?? 0,
  }));
  const inc30Series = dailySeries(inc30.map((i) => i.createdAt), 30);

  return (
    <div>
      <DashboardGreeting greeting={`Hola, ${name.split(" ")[0]}`} subtitle="Esto es lo que ha pasado hoy en Calidad y Control." />

      <PendingBanner userId={user.id} />

      <RevealGrid className="mt-6 grid gap-4 sm:grid-cols-3">
        <KpiCard icon={Ticket} label="Tickets abiertos" value={ticketsAbiertos} tone="accent" />
        <KpiCard icon={FileText} label="Solicitudes pendientes" value={solicitudesPendientes} />
        <KpiCard icon={AlertTriangle} label="Incidencias (7 días)" value={incidenciasRecientes} />
      </RevealGrid>

      <h2 className="mt-8 text-sm font-semibold text-muted uppercase tracking-wide">Analíticos</h2>
      <div className="mt-3 grid gap-4 md:grid-cols-3">
        <ChartCard title="Incidencias por estatus" hint="Total">
          <BarChart data={incData} />
        </ChartCard>
        <ChartCard title="Incidencias reportadas" hint="Últimos 30 días">
          <ColumnChart data={inc30Series} />
        </ChartCard>
        <ChartCard title="Tickets por estatus" hint="Total">
          <BarChart data={tkData} />
        </ChartCard>
      </div>

      <h2 className="mt-8 text-sm font-semibold text-muted uppercase tracking-wide">Accesos rápidos</h2>
      <RevealGrid className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <QuickActionTile href="/admin/tickets" icon={Ticket} label="Tickets" description="Solicitudes entre áreas" />
        <QuickActionTile href="/admin/incidencias" icon={AlertTriangle} label="Incidencias" description="Reportes de conducta y disciplina" />
        <QuickActionTile href="/admin/control-escolar/solicitudes" icon={FileText} label="Solicitudes" description="Cambios de grupo y bajas" />
        <QuickActionTile href="/admin/comunicaciones" icon={MessageSquare} label="Comunicaciones" description="Avisos y anuncios" />
      </RevealGrid>
    </div>
  );
}
