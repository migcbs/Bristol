import { auth } from "@/lib/auth";
import { getCampusScope, leadScopeWhere } from "@/lib/campus-scope";
import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }
  const role = (session.user as { role: Role }).role;
  if (role !== "ADMIN" && role !== "STAFF") {
    return Response.json({ error: "No autorizado" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) {
    return Response.json({ error: "La búsqueda requiere al menos 2 caracteres" }, { status: 400 });
  }

  const scope = await getCampusScope(session.user as { id: string; role: Role });
  const campusWhere: Record<string, unknown> =
    scope.type === "ALL" ? {} : scope.type === "CAMPUS_LIST" ? { campusId: { in: scope.campusIds } } : { id: { in: [] } };

  const [students, leads, groups] = await Promise.all([
    prisma.student.findMany({
      where: {
        ...campusWhere,
        OR: [
          { matricula: { contains: q, mode: "insensitive" } },
          { user: { name: { contains: q, mode: "insensitive" } } },
        ],
      },
      take: 5,
      select: { id: true, matricula: true, user: { select: { name: true } } },
    }),
    prisma.lead.findMany({
      where: {
        AND: [
          leadScopeWhere(scope),
          {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
              { phone: { contains: q, mode: "insensitive" } },
            ],
          },
        ],
      },
      take: 5,
      select: { id: true, name: true, email: true },
    }),
    prisma.group.findMany({
      where: { ...campusWhere, name: { contains: q, mode: "insensitive" } },
      take: 5,
      select: { id: true, name: true },
    }),
  ]);

  return Response.json({ students, leads, groups });
}
