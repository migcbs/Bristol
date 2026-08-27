import { auth } from "@/lib/auth";
import { getCampusScope, leadScopeWhere } from "@/lib/campus-scope";
import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }
  const role = (session.user as { role: Role }).role;
  if (role !== "ADMIN" && role !== "STAFF") {
    return Response.json({ error: "No autorizado" }, { status: 403 });
  }

  const scope = await getCampusScope(session.user as { id: string; role: Role });
  const where = leadScopeWhere(scope);

  const [statusGroups, sourceGroups] = await Promise.all([
    prisma.lead.groupBy({ by: ["status"], where, _count: { _all: true } }),
    prisma.lead.groupBy({ by: ["source"], where, _count: { _all: true } }),
  ]);

  return Response.json({
    byStatus: statusGroups.map((g) => ({ status: g.status, count: g._count._all })),
    bySource: sourceGroups.map((g) => ({ source: g.source, count: g._count._all })),
  });
}
