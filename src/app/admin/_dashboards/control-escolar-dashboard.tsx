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
import { FileText, BookOpen, RefreshCw, Layers, Users } from "lucide-react";
import type { GroupChangeRequestStatus, Role } from "@prisma/client";

const REQ_STATUS_LABELS: Record<GroupChangeRequestStatus, string> = {
  PENDIENTE: "Pendiente",
  APROBADA: "Aprobada",
  RECHAZADA: "Rechazada",
};

export async function ControlEscolarDashboard({ user, name }: { user: { id: string; role: Role }; name: string }) {
  const scope = await getCampusScope(user);
  const studentCampusWhere =
    scope.type === "ALL" ? {} : scope.type === "CAMPUS_LIST" ? { campusId: { in: scope.campusIds } } : { id: { in: [] } };
  const since30 = sinceDaysAgo(30);

  const [
    solicitudesPendientes,
    solicitudesMaterialPendientes,
    carpetas,
    statusRows,
    typeRows,
    recientes30,
  ] = await Promise.all([
    prisma.groupChangeRequest.count({ where: { status: "PENDIENTE", student: studentCampusWhere } }),
    prisma.materialAccessRequest.count({ where: { status: "PENDIENTE" } }),
    prisma.materialCarpeta.count(),
    prisma.groupChangeRequest.groupBy({ by: ["status"], where: { student: studentCampusWhere }, _count: { _all: true } }),
    prisma.groupChangeRequest.groupBy({ by: ["type"], where: { student: studentCampusWhere }, _count: { _all: true } }),
    prisma.groupChangeRequest.findMany({
      where: { student: studentCampusWhere, createdAt: { gte: since30 } },
      select: { createdAt: true },
    }),
  ]);

  const statusCount = new Map(statusRows.map((r) => [r.status, r._count._all]));
  const statusData = (Object.keys(REQ_STATUS_LABELS) as GroupChangeRequestStatus[]).map((k) => ({
    label: REQ_STATUS_LABELS[k],
    value: statusCount.get(k) ?? 0,
  }));
  const typeCount = new Map(typeRows.map((r) => [r.type, r._count._all]));
  const typeData = [
    { label: "Cambio de grupo", value: typeCount.get("CAMBIO_GRUPO") ?? 0 },
    { label: "Baja", value: typeCount.get("BAJA") ?? 0, colorClass: "bg-accent" },
  ];
  const series30 = dailySeries(recientes30.map((r) => r.createdAt), 30);

  return (
    <div>
      <DashboardGreeting greeting={`Hola, ${name.split(" ")[0]}`} subtitle="Esto es lo que ha pasado hoy en Control Escolar." />

      <PendingBanner userId={user.id} />

      <RevealGrid className="mt-6 grid gap-4 sm:grid-cols-3">
        <KpiCard icon={FileText} label="Solicitudes pendientes" value={solicitudesPendientes} tone="accent" />
        <KpiCard icon={Users} label="Accesos a material pendientes" value={solicitudesMaterialPendientes} />
        <KpiCard icon={BookOpen} label="Carpetas de material" value={carpetas} />
      </RevealGrid>

      <h2 className="mt-8 text-sm font-semibold text-muted uppercase tracking-wide">Analíticos</h2>
      <div className="mt-3 grid gap-4 md:grid-cols-3">
        <ChartCard title="Solicitudes por estatus" hint="Total">
          <BarChart data={statusData} />
        </ChartCard>
        <ChartCard title="Solicitudes por tipo" hint="Total">
          <BarChart data={typeData} />
        </ChartCard>
        <ChartCard title="Solicitudes recibidas" hint="Últimos 30 días">
          <ColumnChart data={series30} />
        </ChartCard>
      </div>

      <h2 className="mt-8 text-sm font-semibold text-muted uppercase tracking-wide">Accesos rápidos</h2>
      <RevealGrid className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <QuickActionTile href="/admin/control-escolar/solicitudes" icon={FileText} label="Solicitudes" description="Cambios de grupo y bajas" />
        <QuickActionTile href="/admin/control-escolar/biblioteca" icon={BookOpen} label="Biblioteca de Material" description="Material para maestros" />
        <QuickActionTile href="/admin/reinscripciones" icon={RefreshCw} label="Reinscripciones" description="Ciclo de reinscripción" />
        <QuickActionTile href="/admin/direccion/grupos" icon={Layers} label="Grupos" description="Consulta de grupos y maestros" />
      </RevealGrid>
    </div>
  );
}
