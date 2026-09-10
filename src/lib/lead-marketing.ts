import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export async function getLeadMarketingSummary(where: Prisma.LeadWhereInput) {
  const [statusGroups, sourceGroups, sourceStatusGroups] = await Promise.all([
    prisma.lead.groupBy({ by: ["status"], where, _count: { _all: true } }),
    prisma.lead.groupBy({ by: ["source"], where, _count: { _all: true } }),
    // Source × estatus — the piece that was missing for "de qué sirve ver
    // el total por origen si no sé cuál convierte mejor" (2026-09-09):
    // total-by-source alone can't answer "which channel actually
    // converts", only a per-source breakdown by outcome can.
    prisma.lead.groupBy({ by: ["source", "status"], where, _count: { _all: true } }),
  ]);

  const enrolledBySource = new Map<string, number>();
  for (const g of sourceStatusGroups) {
    if (g.status === "ENROLLED") enrolledBySource.set(g.source, g._count._all);
  }

  return {
    byStatus: statusGroups.map((g) => ({ status: g.status, count: g._count._all })),
    bySource: sourceGroups.map((g) => ({
      source: g.source,
      count: g._count._all,
      enrolled: enrolledBySource.get(g.source) ?? 0,
      conversionRate: g._count._all > 0 ? Math.round(((enrolledBySource.get(g.source) ?? 0) / g._count._all) * 100) : 0,
    })),
  };
}
