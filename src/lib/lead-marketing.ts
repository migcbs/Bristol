import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export async function getLeadMarketingSummary(where: Prisma.LeadWhereInput) {
  const [statusGroups, sourceGroups] = await Promise.all([
    prisma.lead.groupBy({ by: ["status"], where, _count: { _all: true } }),
    prisma.lead.groupBy({ by: ["source"], where, _count: { _all: true } }),
  ]);

  return {
    byStatus: statusGroups.map((g) => ({ status: g.status, count: g._count._all })),
    bySource: sourceGroups.map((g) => ({ source: g.source, count: g._count._all })),
  };
}
