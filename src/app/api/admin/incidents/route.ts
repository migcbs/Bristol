import { auth } from "@/lib/auth";
import { getCampusScope, incidentScopeWhere } from "@/lib/campus-scope";
import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }
  const role = (session.user as { role: string }).role;
  if (role !== "ADMIN" && role !== "STAFF") {
    return Response.json({ error: "No autorizado" }, { status: 403 });
  }

  const scope = await getCampusScope(session.user as { id: string; role: Role });
  const where = incidentScopeWhere(scope);

  const incidents = await prisma.incident.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { student: { include: { user: { select: { id: true, name: true } } } }, reportedBy: { select: { id: true, name: true } }, group: true },
  });

  return Response.json(incidents);
}
