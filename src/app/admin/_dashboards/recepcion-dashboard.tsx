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
import { UserPlus, Wallet, Calendar, NotebookPen, GraduationCap, CalendarCheck } from "lucide-react";
import type { PlacementAppointmentStatus, ReceptionLogType, Role } from "@prisma/client";

const CITA_LABELS: Record<PlacementAppointmentStatus, string> = {
  PROGRAMADA: "Programada",
  REALIZADA: "Realizada",
  NO_ASISTIO: "No asistió",
  CANCELADA: "Cancelada",
};
const BITACORA_LABELS: Record<ReceptionLogType, string> = {
  LLAMADA: "Llamadas",
  INCIDENCIA: "Incidencias",
  NOTA: "Notas",
};

export async function RecepcionDashboard({ user, name }: { user: { id: string; role: Role }; name: string }) {
  const scope = await getCampusScope(user);
  const campusWhere = scope.type === "ALL" ? {} : scope.type === "CAMPUS_LIST" ? { campusId: { in: scope.campusIds } } : { id: { in: [] } };

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);
  const since14 = sinceDaysAgo(14);
  const since30 = sinceDaysAgo(30);

  const [altasHoy, citasHoy, bitacoraHoy, altas14, citas30, bitacora30] = await Promise.all([
    prisma.student.count({ where: { ...campusWhere, createdAt: { gte: todayStart, lt: todayEnd } } }),
    prisma.placementAppointment.count({ where: { ...campusWhere, scheduledFor: { gte: todayStart, lt: todayEnd } } }),
    prisma.receptionLogEntry.count({ where: { ...campusWhere, createdAt: { gte: todayStart, lt: todayEnd } } }),
    prisma.student.findMany({ where: { ...campusWhere, createdAt: { gte: since14 } }, select: { createdAt: true } }),
    prisma.placementAppointment.groupBy({
      by: ["status"],
      where: { ...campusWhere, scheduledFor: { gte: since30 } },
      _count: { _all: true },
    }),
    prisma.receptionLogEntry.groupBy({
      by: ["type"],
      where: { ...campusWhere, createdAt: { gte: since30 } },
      _count: { _all: true },
    }),
  ]);

  const altasSeries = dailySeries(altas14.map((s) => s.createdAt), 14);
  const citasCount = new Map(citas30.map((r) => [r.status, r._count._all]));
  const citasData = (Object.keys(CITA_LABELS) as PlacementAppointmentStatus[]).map((k) => ({
    label: CITA_LABELS[k],
    value: citasCount.get(k) ?? 0,
  }));
  const bitCount = new Map(bitacora30.map((r) => [r.type, r._count._all]));
  const bitData = (Object.keys(BITACORA_LABELS) as ReceptionLogType[]).map((k) => ({
    label: BITACORA_LABELS[k],
    value: bitCount.get(k) ?? 0,
  }));

  return (
    <div>
      <DashboardGreeting greeting={`Hola, ${name.split(" ")[0]}`} subtitle="Esto es lo que ha pasado hoy en Recepción." />

      <PendingBanner userId={user.id} />

      <RevealGrid className="mt-6 grid gap-4 sm:grid-cols-3">
        <KpiCard icon={UserPlus} label="Altas hoy" value={altasHoy} />
        <KpiCard icon={CalendarCheck} label="Citas de hoy" value={citasHoy} />
        <KpiCard icon={NotebookPen} label="Notas de bitácora hoy" value={bitacoraHoy} />
      </RevealGrid>

      <h2 className="mt-8 text-sm font-semibold text-muted uppercase tracking-wide">Analíticos</h2>
      <div className="mt-3 grid gap-4 md:grid-cols-3">
        <ChartCard title="Altas de alumnos" hint="Últimos 14 días">
          <ColumnChart data={altasSeries} />
        </ChartCard>
        <ChartCard title="Citas por estatus" hint="Últimos 30 días">
          <BarChart data={citasData} />
        </ChartCard>
        <ChartCard title="Bitácora por tipo" hint="Últimos 30 días">
          <BarChart data={bitData} />
        </ChartCard>
      </div>

      <h2 className="mt-8 text-sm font-semibold text-muted uppercase tracking-wide">Accesos rápidos</h2>
      <RevealGrid className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <QuickActionTile href="/admin/recepcion/alumnos" icon={GraduationCap} label="Alumnos" description="Consultar, editar y dar de alta" />
        <QuickActionTile href="/admin/recepcion/agenda" icon={Calendar} label="Agenda" description="Citas de examen de posicionamiento" />
        <QuickActionTile href="/admin/recepcion/bitacora" icon={NotebookPen} label="Bitácora" description="Llamadas, incidencias y notas" />
        <QuickActionTile href="/admin/direccion/grupos" icon={CalendarCheck} label="Grupos" description="Cupo y alumnos por grupo" />
        <QuickActionTile href="/admin/cobranzas" icon={Wallet} label="Cobranzas" description="Consultar estatus de pago" />
      </RevealGrid>
    </div>
  );
}
