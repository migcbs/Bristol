import { auth } from "@/lib/auth";
import { getCampusScope } from "@/lib/campus-scope";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }

  const scope = await getCampusScope(session.user as { id: string; role: any });

  if (scope.type === "NONE") {
    return Response.json([]);
  }

  const where: Prisma.StudentWhereInput =
    scope.type === "ALL"
      ? {}
      : scope.type === "CAMPUS_LIST"
        ? { campusId: { in: scope.campusIds } }
        : { campusId: scope.campusId };

  const students = await prisma.student.findMany({ where });
  return Response.json(students);
}
