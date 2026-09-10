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
import { formatMoneyMXN } from "@/lib/invoice-status";
import { Wallet, ArrowLeftRight, Package, AlertTriangle } from "lucide-react";
import type { InvoiceStatus, Role } from "@prisma/client";

const INVOICE_LABELS: Record<InvoiceStatus, string> = {
  PENDING: "Pendiente",
  PAID: "Pagada",
  OVERDUE: "Vencida",
  CANCELED: "Cancelada",
};

export async function CajaDashboard({ user, name }: { user: { id: string; role: Role }; name: string }) {
  const scope = await getCampusScope(user);
  const studentCampusWhere =
    scope.type === "ALL" ? {} : scope.type === "CAMPUS_LIST" ? { campusId: { in: scope.campusIds } } : { id: { in: [] } };
  const campusWhere =
    scope.type === "ALL" ? {} : scope.type === "CAMPUS_LIST" ? { campusId: { in: scope.campusIds } } : { id: { in: [] } };

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);
  const since14 = sinceDaysAgo(14);

  const [cargosPendientes, cobradoHoy, movimientosHoy, entradas14, movimientos30, invoiceStatus] = await Promise.all([
    prisma.invoice.count({ where: { status: { in: ["PENDING", "OVERDUE"] }, student: studentCampusWhere } }),
    prisma.cashMovement.aggregate({
      where: { ...campusWhere, tipo: "ENTRADA", createdAt: { gte: todayStart, lt: todayEnd } },
      _sum: { montoCents: true },
    }),
    prisma.cashMovement.count({ where: { ...campusWhere, createdAt: { gte: todayStart, lt: todayEnd } } }),
    prisma.cashMovement.findMany({
      where: { ...campusWhere, tipo: "ENTRADA", createdAt: { gte: since14 } },
      select: { createdAt: true, montoCents: true },
    }),
    prisma.cashMovement.groupBy({
      by: ["tipo"],
      where: { ...campusWhere, createdAt: { gte: sinceDaysAgo(30) } },
      _sum: { montoCents: true },
    }),
    prisma.invoice.groupBy({
      by: ["status"],
      where: { student: studentCampusWhere },
      _count: { _all: true },
    }),
  ]);

  const cobradoSeries = dailySeries(
    entradas14.map((m) => m.createdAt),
    14,
    entradas14.map((m) => m.montoCents / 100)
  );
  const flujoData = [
    {
      label: "Entradas",
      value: Math.round((movimientos30.find((m) => m.tipo === "ENTRADA")?._sum.montoCents ?? 0) / 100),
      colorClass: "bg-emerald-500",
    },
    {
      label: "Salidas",
      value: Math.round((movimientos30.find((m) => m.tipo === "SALIDA")?._sum.montoCents ?? 0) / 100),
      colorClass: "bg-accent",
    },
  ];
  const invCount = new Map(invoiceStatus.map((r) => [r.status, r._count._all]));
  const invData = (Object.keys(INVOICE_LABELS) as InvoiceStatus[]).map((k) => ({
    label: INVOICE_LABELS[k],
    value: invCount.get(k) ?? 0,
  }));

  return (
    <div>
      <DashboardGreeting greeting={`Hola, ${name.split(" ")[0]}`} subtitle="Esto es lo que ha pasado hoy en Caja." />

      <PendingBanner userId={user.id} />

      <RevealGrid className="mt-6 grid gap-4 sm:grid-cols-3">
        <KpiCard icon={AlertTriangle} label="Cargos pendientes" value={cargosPendientes} tone="accent" />
        <KpiCard icon={Wallet} label="Cobrado hoy" value={formatMoneyMXN(cobradoHoy._sum.montoCents ?? 0)} />
        <KpiCard icon={ArrowLeftRight} label="Movimientos hoy" value={movimientosHoy} />
      </RevealGrid>

      <h2 className="mt-8 text-sm font-semibold text-muted uppercase tracking-wide">Analíticos</h2>
      <div className="mt-3 grid gap-4 md:grid-cols-3">
        <ChartCard title="Cobrado por día" hint="Últimos 14 días · MXN">
          <ColumnChart data={cobradoSeries} format={(n) => `$${Math.round(n).toLocaleString("es-MX")}`} />
        </ChartCard>
        <ChartCard title="Entradas vs. salidas" hint="Últimos 30 días · MXN">
          <BarChart data={flujoData} format={(n) => `$${n.toLocaleString("es-MX")}`} />
        </ChartCard>
        <ChartCard title="Facturas por estatus">
          <BarChart data={invData} />
        </ChartCard>
      </div>

      <h2 className="mt-8 text-sm font-semibold text-muted uppercase tracking-wide">Accesos rápidos</h2>
      <RevealGrid className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <QuickActionTile href="/admin/cobranzas" icon={Wallet} label="Cobranzas" description="Crear y cobrar cargos" />
        <QuickActionTile href="/admin/caja/recursos-materiales" icon={Package} label="Recursos Materiales" description="Inventario de libros y exámenes" />
        <QuickActionTile href="/admin/caja/movimientos" icon={ArrowLeftRight} label="Caja" description="Corte, cierre y movimientos" />
      </RevealGrid>
    </div>
  );
}
