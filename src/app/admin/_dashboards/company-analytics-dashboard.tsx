import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { KpiCard } from "@/components/admin/dashboard/kpi-card";
import { DashboardGreeting } from "@/components/admin/dashboard/dashboard-greeting";
import { RevealGrid } from "@/components/admin/dashboard/reveal-grid";
import { QuickActionTile } from "@/components/admin/dashboard/quick-action-tile";
import { GraduationCap, Users, Layers, AlertTriangle, DollarSign, TrendingUp } from "lucide-react";

const peso = (cents: number) =>
  (cents / 100).toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });

interface CampusMetrics {
  id: string;
  name: string;
  alumnosActivos: number;
  bajas: number;
  graduados: number;
  gruposAbiertos: number;
  docentes: number;
  leadsMes: number;
  inscritosMes: number;
  ingresosMesCents: number;
  porCobrarCents: number;
  incidenciasAbiertas: number;
}

async function metricsForCampus(id: string, name: string, monthStart: Date): Promise<CampusMetrics> {
  const studentWhere = { campusId: id };
  const [
    alumnosActivos,
    bajas,
    graduados,
    gruposAbiertos,
    docentes,
    leadsMes,
    inscritosMes,
    ingresosMes,
    porCobrar,
    incidenciasAbiertas,
  ] = await Promise.all([
    prisma.student.count({ where: { ...studentWhere, estatusAlumno: "ACTIVO" } }),
    prisma.student.count({ where: { ...studentWhere, estatusAlumno: "BAJA" } }),
    prisma.student.count({ where: { ...studentWhere, estatusAlumno: "GRADUADO" } }),
    prisma.group.count({ where: { campusId: id, estatusGrupo: "ABIERTO" } }),
    prisma.teacherCampus.count({ where: { campusId: id } }),
    prisma.lead.count({ where: { campusId: id, createdAt: { gte: monthStart } } }),
    prisma.lead.count({ where: { campusId: id, status: "ENROLLED", createdAt: { gte: monthStart } } }),
    prisma.invoice.aggregate({
      _sum: { amountCents: true },
      where: { status: "PAID", paidAt: { gte: monthStart }, student: studentWhere },
    }),
    prisma.invoice.aggregate({
      _sum: { amountCents: true },
      where: { status: { in: ["PENDING", "OVERDUE"] }, student: studentWhere },
    }),
    prisma.incident.count({ where: { status: { not: "RESUELTA" }, student: studentWhere } }),
  ]);

  return {
    id,
    name,
    alumnosActivos,
    bajas,
    graduados,
    gruposAbiertos,
    docentes,
    leadsMes,
    inscritosMes,
    ingresosMesCents: ingresosMes._sum.amountCents ?? 0,
    porCobrarCents: porCobrar._sum.amountCents ?? 0,
    incidenciasAbiertas,
  };
}

function CompareBar({
  label,
  a,
  b,
  format = (n: number) => String(n),
}: {
  label: string;
  a: { name: string; value: number };
  b: { name: string; value: number };
  format?: (n: number) => string;
}) {
  const max = Math.max(a.value, b.value, 1);
  return (
    <div>
      <p className="text-xs font-medium text-muted">{label}</p>
      <div className="mt-1.5 space-y-1.5">
        {[a, b].map((row, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-20 shrink-0 truncate text-[11px] text-muted">{row.name}</span>
            <div className="h-4 flex-1 overflow-hidden rounded bg-surface">
              <div
                className={i === 0 ? "h-full rounded bg-primary" : "h-full rounded bg-accent"}
                style={{ width: `${(row.value / max) * 100}%` }}
              />
            </div>
            <span className="w-24 shrink-0 text-right text-[11px] font-semibold tabular-nums text-foreground">
              {format(row.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CampusCard({ m }: { m: CampusMetrics }) {
  const conversion = m.leadsMes > 0 ? Math.round((m.inscritosMes / m.leadsMes) * 100) : 0;
  const rows: [string, string | number][] = [
    ["Alumnos activos", m.alumnosActivos],
    ["Grupos abiertos", m.gruposAbiertos],
    ["Docentes", m.docentes],
    ["Bajas", m.bajas],
    ["Graduados", m.graduados],
    ["Leads del mes", m.leadsMes],
    ["Inscritos del mes", m.inscritosMes],
    ["Conversión", `${conversion}%`],
    ["Ingresos del mes", peso(m.ingresosMesCents)],
    ["Por cobrar", peso(m.porCobrarCents)],
    ["Incidencias abiertas", m.incidenciasAbiertas],
  ];
  return (
    <Card className="p-5">
      <h3 className="font-display text-base font-semibold text-primary">{m.name}</h3>
      <dl className="mt-3 divide-y divide-border">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between py-1.5 text-sm">
            <dt className="text-muted">{k}</dt>
            <dd className="font-semibold tabular-nums text-foreground">{v}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

// Company-wide analytics for ADMIN, split by campus — the user asked
// (2026-09-09) for "un dashboard de analíticos de toda la empresa y
// dividido en los dos campus". Monthly figures are month-to-date.
export async function CompanyAnalyticsDashboard({ name }: { name: string }) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const campuses = await prisma.campus.findMany({ orderBy: { name: "asc" } });
  const metrics = await Promise.all(campuses.map((c) => metricsForCampus(c.id, c.name, monthStart)));

  const totals = metrics.reduce(
    (acc, m) => ({
      alumnosActivos: acc.alumnosActivos + m.alumnosActivos,
      gruposAbiertos: acc.gruposAbiertos + m.gruposAbiertos,
      docentes: acc.docentes + m.docentes,
      leadsMes: acc.leadsMes + m.leadsMes,
      inscritosMes: acc.inscritosMes + m.inscritosMes,
      ingresosMesCents: acc.ingresosMesCents + m.ingresosMesCents,
      porCobrarCents: acc.porCobrarCents + m.porCobrarCents,
      incidenciasAbiertas: acc.incidenciasAbiertas + m.incidenciasAbiertas,
    }),
    {
      alumnosActivos: 0,
      gruposAbiertos: 0,
      docentes: 0,
      leadsMes: 0,
      inscritosMes: 0,
      ingresosMesCents: 0,
      porCobrarCents: 0,
      incidenciasAbiertas: 0,
    }
  );
  const conversionGlobal = totals.leadsMes > 0 ? Math.round((totals.inscritosMes / totals.leadsMes) * 100) : 0;

  const monthLabel = now.toLocaleDateString("es-MX", { month: "long", year: "numeric" });

  return (
    <div>
      <DashboardGreeting
        greeting={`Panorama de ${name.split(" ")[0]}`}
        subtitle={`Analíticos de toda la empresa · cifras del mes a la fecha (${monthLabel})`}
      />

      <RevealGrid className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard icon={GraduationCap} label="Alumnos activos" value={totals.alumnosActivos} />
        <KpiCard icon={Layers} label="Grupos abiertos" value={totals.gruposAbiertos} />
        <KpiCard icon={Users} label="Docentes" value={totals.docentes} />
        <KpiCard icon={TrendingUp} label="Conversión de leads" value={`${conversionGlobal}%`} />
        <KpiCard icon={DollarSign} label="Ingresos del mes" value={peso(totals.ingresosMesCents)} />
        <KpiCard icon={DollarSign} label="Por cobrar" value={peso(totals.porCobrarCents)} tone="accent" />
        <KpiCard icon={GraduationCap} label="Inscritos del mes" value={totals.inscritosMes} />
        <KpiCard icon={AlertTriangle} label="Incidencias abiertas" value={totals.incidenciasAbiertas} tone="accent" />
      </RevealGrid>

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-muted">Comparativo por plantel</h2>

      {metrics.length === 2 && (
        <Card className="mt-3 space-y-4 p-5">
          <CompareBar
            label="Alumnos activos"
            a={{ name: metrics[0].name, value: metrics[0].alumnosActivos }}
            b={{ name: metrics[1].name, value: metrics[1].alumnosActivos }}
          />
          <CompareBar
            label="Ingresos del mes"
            a={{ name: metrics[0].name, value: metrics[0].ingresosMesCents }}
            b={{ name: metrics[1].name, value: metrics[1].ingresosMesCents }}
            format={peso}
          />
          <CompareBar
            label="Leads del mes"
            a={{ name: metrics[0].name, value: metrics[0].leadsMes }}
            b={{ name: metrics[1].name, value: metrics[1].leadsMes }}
          />
          <CompareBar
            label="Incidencias abiertas"
            a={{ name: metrics[0].name, value: metrics[0].incidenciasAbiertas }}
            b={{ name: metrics[1].name, value: metrics[1].incidenciasAbiertas }}
          />
        </Card>
      )}

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {metrics.map((m) => (
          <CampusCard key={m.id} m={m} />
        ))}
      </div>

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-muted">Ir a</h2>
      <RevealGrid className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <QuickActionTile href="/admin/mercadotecnia" icon={TrendingUp} label="Mercadotecnia" description="Origen y conversión de leads" />
        <QuickActionTile href="/admin/cobranzas" icon={DollarSign} label="Cobranzas" description="Facturas y pagos" />
        <QuickActionTile href="/admin/incidencias" icon={AlertTriangle} label="Incidencias" description="Reportes de conducta y disciplina" />
      </RevealGrid>
    </div>
  );
}
