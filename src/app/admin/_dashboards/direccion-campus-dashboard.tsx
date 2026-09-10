import { prisma } from "@/lib/prisma";
import { getCampusScope } from "@/lib/campus-scope";
import { dailySeries, sinceDaysAgo } from "@/lib/analytics-buckets";
import { KpiCard } from "@/components/admin/dashboard/kpi-card";
import { QuickActionTile } from "@/components/admin/dashboard/quick-action-tile";
import { DashboardGreeting } from "@/components/admin/dashboard/dashboard-greeting";
import { PendingBanner } from "@/components/admin/dashboard/pending-banner";
import { RevealGrid } from "@/components/admin/dashboard/reveal-grid";
import { ChartCard } from "@/components/admin/dashboard/chart-card";
import { BarChart, ColumnChart, DonutChart } from "@/components/ui/charts";
import { GraduationCap, FileText, AlertTriangle, Megaphone, MessageSquare, Layers } from "lucide-react";
import type { Role, StudentStatus } from "@prisma/client";

const STUDENT_STATUS_LABELS: Record<StudentStatus, string> = {
  ACTIVO: "Activos",
  BAJA: "Bajas",
  GRADUADO: "Graduados",
};

export async function DireccionCampusDashboard({ user, name }: { user: { id: string; role: Role }; name: string }) {
  const scope = await getCampusScope(user);
  const studentCampusWhere =
    scope.type === "ALL" ? {} : scope.type === "CAMPUS_LIST" ? { campusId: { in: scope.campusIds } } : { id: { in: [] } };

  const sevenDaysAgo = sinceDaysAgo(7);
  const since30 = sinceDaysAgo(30);

  const [
    alumnosActivos,
    solicitudesPendientes,
    incidenciasRecientes,
    statusRows,
    groups,
    inc30,
  ] = await Promise.all([
    prisma.student.count({ where: { ...studentCampusWhere, estatusAlumno: "ACTIVO" } }),
    prisma.groupChangeRequest.count({ where: { status: "PENDIENTE", student: studentCampusWhere } }),
    prisma.incident.count({ where: { createdAt: { gte: sevenDaysAgo }, student: studentCampusWhere } }),
    prisma.student.groupBy({ by: ["estatusAlumno"], where: studentCampusWhere, _count: { _all: true } }),
    prisma.group.findMany({
      where: scope.type === "CAMPUS_LIST" ? { campusId: { in: scope.campusIds } } : {},
      select: {
        name: true,
        level: { select: { code: true } },
        cupoMaximo: true,
        _count: { select: { enrollments: { where: { completedAt: null } } } },
      },
      orderBy: { name: "asc" },
      take: 8,
    }),
    prisma.incident.findMany({
      where: { student: studentCampusWhere, createdAt: { gte: since30 } },
      select: { createdAt: true },
    }),
  ]);

  const statusCount = new Map(statusRows.map((r) => [r.estatusAlumno, r._count._all]));
  const statusData = (Object.keys(STUDENT_STATUS_LABELS) as StudentStatus[]).map((k) => ({
    label: STUDENT_STATUS_LABELS[k],
    value: statusCount.get(k) ?? 0,
    colorClass: k === "BAJA" ? "text-accent" : k === "GRADUADO" ? "text-emerald-500" : "text-primary",
  }));

  const ocupacionData = groups.map((g) => ({
    label: `${g.level.code} · ${g.name}`,
    value: g.cupoMaximo > 0 ? Math.round((g._count.enrollments / g.cupoMaximo) * 100) : 0,
  }));

  const inc30Series = dailySeries(inc30.map((i) => i.createdAt), 30);

  return (
    <div>
      <DashboardGreeting greeting={`Hola, ${name.split(" ")[0]}`} subtitle="Esto es lo que ha pasado hoy en tu plantel." />

      <PendingBanner userId={user.id} />

      <RevealGrid className="mt-6 grid gap-4 sm:grid-cols-3">
        <KpiCard icon={GraduationCap} label="Alumnos activos" value={alumnosActivos} />
        <KpiCard icon={FileText} label="Solicitudes pendientes" value={solicitudesPendientes} tone="accent" />
        <KpiCard icon={AlertTriangle} label="Incidencias (7 días)" value={incidenciasRecientes} />
      </RevealGrid>

      <h2 className="mt-8 text-sm font-semibold text-muted uppercase tracking-wide">Analíticos</h2>
      <div className="mt-3 grid gap-4 md:grid-cols-3">
        <ChartCard title="Alumnado por estatus">
          <DonutChart slices={statusData} centerLabel={String(alumnosActivos)} />
        </ChartCard>
        <ChartCard title="Ocupación por grupo" hint="% del cupo">
          <BarChart data={ocupacionData} format={(n) => `${n}%`} />
        </ChartCard>
        <ChartCard title="Incidencias reportadas" hint="Últimos 30 días">
          <ColumnChart data={inc30Series} />
        </ChartCard>
      </div>

      <h2 className="mt-8 text-sm font-semibold text-muted uppercase tracking-wide">Accesos rápidos</h2>
      <RevealGrid className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <QuickActionTile href="/admin/direccion/grupos" icon={Layers} label="Grupos" description="Crea grupos y asigna maestros y alumnos" />
        <QuickActionTile href="/admin/recepcion/alumnos" icon={GraduationCap} label="Alumnos" description="Ver y editar el alumnado del plantel" />
        <QuickActionTile href="/admin/control-escolar/solicitudes" icon={FileText} label="Solicitudes" description="Cambios de grupo y bajas" />
        <QuickActionTile href="/admin/incidencias" icon={AlertTriangle} label="Incidencias" description="Reportes de conducta y disciplina" />
        <QuickActionTile href="/admin/mercadotecnia" icon={Megaphone} label="Mercadotecnia" description="Origen y conversión de leads" />
        <QuickActionTile href="/admin/comunicaciones" icon={MessageSquare} label="Comunicaciones" description="Avisos y anuncios" />
      </RevealGrid>
    </div>
  );
}
