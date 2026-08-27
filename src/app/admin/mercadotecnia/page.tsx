import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getCampusScope, leadScopeWhere } from "@/lib/campus-scope";
import { getLeadMarketingSummary } from "@/lib/lead-marketing";
import { Card } from "@/components/ui/card";
import { LEAD_STATUS_LABELS } from "@/lib/lead-status";
import { LEAD_SOURCE_LABELS } from "@/lib/lead-source";
import type { Role } from "@prisma/client";

export default async function MercadotecniaPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const role = (session.user as { role: Role }).role;
  if (role !== "ADMIN" && role !== "STAFF") redirect("/portal");

  const scope = await getCampusScope(session.user as { id: string; role: Role });
  const where = leadScopeWhere(scope);

  const { byStatus: statusGroups, bySource: sourceGroups } = await getLeadMarketingSummary(where);

  const total = statusGroups.reduce((sum, g) => sum + g.count, 0);
  const enrolled = statusGroups.find((g) => g.status === "ENROLLED")?.count ?? 0;
  const conversionRate = total > 0 ? Math.round((enrolled / total) * 100) : 0;

  return (
    <div>
      <h1 className="text-lg font-semibold">Mercadotecnia</h1>
      <p className="mt-1 text-sm text-muted">
        Origen y conversión de leads capturados desde la landing.
      </p>

      <div className="mt-6 grid gap-6 md:grid-cols-3">
        <Card>
          <p className="text-sm text-muted">Total de leads</p>
          <p className="mt-1 text-3xl font-bold text-primary">{total}</p>
        </Card>
        <Card>
          <p className="text-sm text-muted">Inscritos</p>
          <p className="mt-1 text-3xl font-bold text-primary">{enrolled}</p>
        </Card>
        <Card>
          <p className="text-sm text-muted">Tasa de conversión</p>
          <p className="mt-1 text-3xl font-bold text-primary">{conversionRate}%</p>
        </Card>
      </div>

      <div className="mt-8 grid gap-8 md:grid-cols-2">
        <div>
          <h2 className="text-sm font-semibold text-muted">Por estatus</h2>
          <div className="mt-3 space-y-2">
            {statusGroups.map((g) => (
              <div key={g.status} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                <span>{LEAD_STATUS_LABELS[g.status]}</span>
                <span className="font-semibold">{g.count}</span>
              </div>
            ))}
            {statusGroups.length === 0 && <p className="text-sm text-muted">Sin datos.</p>}
          </div>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-muted">Por origen</h2>
          <div className="mt-3 space-y-2">
            {sourceGroups.map((g) => (
              <div key={g.source} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                <span>{LEAD_SOURCE_LABELS[g.source]}</span>
                <span className="font-semibold">{g.count}</span>
              </div>
            ))}
            {sourceGroups.length === 0 && <p className="text-sm text-muted">Sin datos.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
