import { auth } from "@/lib/auth";
import { getCampusScope } from "@/lib/campus-scope";
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
  const campusFilter =
    scope.type === "ALL" ? {} : scope.type === "CAMPUS_LIST" ? { campusId: { in: scope.campusIds } } : { id: { in: [] } };

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const [altas, bajas] = await Promise.all([
    prisma.lead.count({
      where: { ...campusFilter, status: "ENROLLED", createdAt: { gte: monthStart, lt: monthEnd } },
    }),
    prisma.student.count({
      where: { ...campusFilter, estatusAlumno: "BAJA", createdAt: { gte: monthStart, lt: monthEnd } },
    }),
  ]);

  return Response.json({ altas, bajas });
}
