import { auth } from "@/lib/auth";
import { getCampusScope } from "@/lib/campus-scope";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

// NOTE: This route is the reference implementation that later specs (Spec 2, Spec 3)
// are expected to copy for their own scoped endpoints. `getCampusScope` only filters by
// campus (a coarse, plantel-level boundary) — e.g. it lets a TEACHER see every student at
// their campus(es), not just students in their own groups. That is intentional here: this
// file exists purely to demonstrate the campus-scoping half of authorization.
//
// Do NOT copy this pattern unmodified into an endpoint that exposes data to STUDENT or
// PARENT roles, or into anything that needs to scope more specifically than "any record at
// my campus" (e.g. "my own enrollments", "my children's records", "my own groups"). Those
// endpoints must add additional filtering on top of the campus scope below — for example by
// `userId`, `parentLinks`, or group/enrollment membership — or they will leak other students'
// data to a caller who merely shares a campus with them.
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }

  const scope = await getCampusScope(session.user);

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
