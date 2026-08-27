import { auth } from "@/lib/auth";
import { getCampusScope } from "@/lib/campus-scope";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }
  const role = (session.user as { role: string }).role;
  if (role !== "ADMIN" && role !== "STAFF") {
    return Response.json({ error: "No autorizado" }, { status: 403 });
  }

  const scope = await getCampusScope(session.user as { id: string; role: any });
  const where: Prisma.EnrollmentWhereInput =
    scope.type === "ALL"
      ? { completedAt: null }
      : scope.type === "CAMPUS_LIST"
        ? { completedAt: null, student: { campusId: { in: scope.campusIds } } }
        : { id: { in: [] } };

  const enrollments = await prisma.enrollment.findMany({
    where,
    orderBy: { enrolledAt: "asc" },
    include: {
      student: { include: { user: true, campus: true } },
      group: { include: { level: true } },
    },
  });

  return Response.json(enrollments);
}
