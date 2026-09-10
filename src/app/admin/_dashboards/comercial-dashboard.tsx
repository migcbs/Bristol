import { prisma } from "@/lib/prisma";
import { getCampusScope, leadScopeWhere } from "@/lib/campus-scope";
import { dailySeries, sinceDaysAgo } from "@/lib/analytics-buckets";
import { KpiCard } from "@/components/admin/dashboard/kpi-card";
import { QuickActionTile } from "@/components/admin/dashboard/quick-action-tile";
import { DashboardGreeting } from "@/components/admin/dashboard/dashboard-greeting";
import { PendingBanner } from "@/components/admin/dashboard/pending-banner";
import { RevealGrid } from "@/components/admin/dashboard/reveal-grid";
import { ChartCard } from "@/components/admin/dashboard/chart-card";
import { BarChart, ColumnChart, DonutChart } from "@/components/ui/charts";
import { UserPlus, Clock, Heart, Megaphone, MessageSquare, Users } from "lucide-react";
import type { LeadStatus, Role } from "@prisma/client";

const LEAD_LABELS: Record<LeadStatus, string> = {
  NEW: "Nuevo",
  CONTACTED: "Contactado",
  PLACEMENT_SCHEDULED: "Cita agendada",
  ENROLLED: "Inscrito",
  LOST: "Perdido",
};

export async function ComercialDashboard({ user, name }: { user: { id: string; role: Role }; name: string }) {
  const scope = await getCampusScope(user);
  const leadWhere = leadScopeWhere(scope);
  const studentCampusWhere =
    scope.type === "ALL" ? {} : scope.type === "CAMPUS_LIST" ? { campusId: { in: scope.campusIds } } : { id: { in: [] } };

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);
  const since14 = sinceDaysAgo(14);
  const since30 = sinceDaysAgo(30);

  const [leadsHoy, enProceso, exAlumnosInteresados, leads14, statusRows, monthRows] = await Promise.all([
    prisma.lead.count({ where: { ...leadWhere, createdAt: { gte: todayStart, lt: todayEnd } } }),
    prisma.lead.count({ where: { ...leadWhere, status: { notIn: ["ENROLLED", "LOST"] } } }),
    prisma.student.count({
      where: { ...studentCampusWhere, estatusAlumno: { in: ["BAJA", "GRADUADO"] }, interesadoEnVolver: true },
    }),
    prisma.lead.findMany({ where: { ...leadWhere, createdAt: { gte: since14 } }, select: { createdAt: true } }),
    prisma.lead.groupBy({ by: ["status"], where: leadWhere, _count: { _all: true } }),
    prisma.lead.groupBy({
      by: ["status"],
      where: { ...leadWhere, createdAt: { gte: since30 } },
      _count: { _all: true },
    }),
  ]);

  const leadsSeries = dailySeries(leads14.map((l) => l.createdAt), 14);
  const statusCount = new Map(statusRows.map((r) => [r.status, r._count._all]));
  const statusData = (Object.keys(LEAD_LABELS) as LeadStatus[]).map((k) => ({
    label: LEAD_LABELS[k],
    value: statusCount.get(k) ?? 0,
  }));

  const month = new Map(monthRows.map((r) => [r.status, r._count._all]));
  const monthTotal = [...month.values()].reduce((a, b) => a + b, 0);
  const monthEnrolled = month.get("ENROLLED") ?? 0;
  const monthLost = month.get("LOST") ?? 0;
  const conversionPct = monthTotal > 0 ? Math.round((monthEnrolled / monthTotal) * 100) : null;

  return (
    <div>
      <DashboardGreeting greeting={`Hola, ${name.split(" ")[0]}`} subtitle="Esto es lo que ha pasado hoy en Comercial." />

      <PendingBanner userId={user.id} />

      <RevealGrid className="mt-6 grid gap-4 sm:grid-cols-3">
        <KpiCard icon={UserPlus} label="Leads nuevos hoy" value={leadsHoy} />
        <KpiCard icon={Clock} label="En proceso" value={enProceso} />
        <KpiCard icon={Heart} label="Ex alumnos interesados en volver" value={exAlumnosInteresados} tone="accent" />
      </RevealGrid>

      <h2 className="mt-8 text-sm font-semibold text-muted uppercase tracking-wide">Analíticos</h2>
      <div className="mt-3 grid gap-4 md:grid-cols-3">
        <ChartCard title="Leads nuevos por día" hint="Últimos 14 días">
          <ColumnChart data={leadsSeries} />
        </ChartCard>
        <ChartCard title="Leads por estatus" hint="Total">
          <BarChart data={statusData} />
        </ChartCard>
        <ChartCard title="Conversión del mes" hint={`${monthTotal} leads`}>
          {monthTotal > 0 ? (
            <DonutChart
              centerLabel={conversionPct !== null ? `${conversionPct}%` : "—"}
              slices={[
                { label: "Inscritos", value: monthEnrolled, colorClass: "text-emerald-500" },
                { label: "Perdidos", value: monthLost, colorClass: "text-accent" },
                { label: "En proceso", value: Math.max(0, monthTotal - monthEnrolled - monthLost), colorClass: "text-border" },
              ]}
            />
          ) : (
            <p className="text-sm text-muted">Sin leads este mes.</p>
          )}
        </ChartCard>
      </div>

      <h2 className="mt-8 text-sm font-semibold text-muted uppercase tracking-wide">Accesos rápidos</h2>
      <RevealGrid className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <QuickActionTile href="/admin/admisiones" icon={UserPlus} label="Admisiones" description="Leads capturados desde la landing" />
        <QuickActionTile href="/admin/recepcion/lista-espera" icon={Clock} label="Lista de Espera" description="Da seguimiento al proceso de venta" />
        <QuickActionTile href="/admin/comercial/ex-alumnos" icon={Users} label="Ex Alumnos" description="Reenganche y directorio" />
        <QuickActionTile href="/admin/mercadotecnia" icon={Megaphone} label="Mercadotecnia" description="Origen y conversión de leads" />
        <QuickActionTile href="/admin/comunicaciones" icon={MessageSquare} label="Comunicaciones" description="Avisos y anuncios" />
      </RevealGrid>
    </div>
  );
}
