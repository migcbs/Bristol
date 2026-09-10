import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { getCampusScope, leadScopeWhere } from "@/lib/campus-scope";
import { getLeadMarketingSummary } from "@/lib/lead-marketing";
import { Card } from "@/components/ui/card";
import { LEAD_STATUS_LABELS } from "@/lib/lead-status";
import { LEAD_SOURCE_LABELS } from "@/lib/lead-source";
import type { Role } from "@prisma/client";

// Improvement per the user's 2026-09-09 request: before this, "por
// origen" only showed a raw count per canal — no way to tell which one
// actually converts, and no link from a number here to the leads behind
// it. Now each source shows its own conversion rate, and every row
// (status or source) links straight into Admisiones pre-filtered to
// exactly those leads — turning the dashboard into a way IN to the work,
// not just a number to look at.
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
  const bestSource = [...sourceGroups].sort((a, b) => b.conversionRate - a.conversionRate)[0];

  return (
    <div>
      <h1 className="text-lg font-semibold">Mercadotecnia</h1>
      <p className="mt-1 text-sm text-muted">
        Origen y conversión de leads capturados desde la landing. Haz click en cualquier renglón para ver esos leads.
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
          <p className="text-sm text-muted">Tasa de conversión general</p>
          <p className="mt-1 text-3xl font-bold text-primary">{conversionRate}%</p>
          {bestSource && bestSource.count > 0 && (
            <p className="mt-1 text-xs text-muted">
              Mejor canal: {LEAD_SOURCE_LABELS[bestSource.source]} ({bestSource.conversionRate}%)
            </p>
          )}
        </Card>
      </div>

      <div className="mt-8 grid gap-8 md:grid-cols-2">
        <div>
          <h2 className="text-sm font-semibold text-muted">Por estatus</h2>
          <div className="mt-3 space-y-2">
            {statusGroups.map((g) => (
              <Link
                key={g.status}
                href={`/admin/admisiones?filter=${g.status}`}
                className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm transition-colors hover:border-primary/40 hover:bg-primary/5"
              >
                <span>{LEAD_STATUS_LABELS[g.status]}</span>
                <span className="font-semibold">{g.count}</span>
              </Link>
            ))}
            {statusGroups.length === 0 && <p className="text-sm text-muted">Sin datos.</p>}
          </div>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-muted">Por origen — con conversión</h2>
          <div className="mt-3 space-y-2">
            {sourceGroups.map((g) => (
              <div key={g.source} className="rounded-md border border-border px-3 py-2 text-sm">
                <div className="flex items-center justify-between">
                  <span>{LEAD_SOURCE_LABELS[g.source]}</span>
                  <span className="font-semibold">{g.count}</span>
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${g.conversionRate}%` }} />
                  </div>
                  <span className="w-10 shrink-0 text-right text-xs text-muted">{g.conversionRate}%</span>
                </div>
                <p className="mt-1 text-xs text-muted">{g.enrolled} inscrito(s) de este canal</p>
              </div>
            ))}
            {sourceGroups.length === 0 && <p className="text-sm text-muted">Sin datos.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
