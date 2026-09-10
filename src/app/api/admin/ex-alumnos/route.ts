import { auth } from "@/lib/auth";
import { getCampusScope } from "@/lib/campus-scope";
import { hasModuleAccess } from "@/lib/staff-permissions";
import { prisma } from "@/lib/prisma";
import type { Prisma, Role } from "@prisma/client";

function assertAdminOrStaff(role: string) {
  return role === "ADMIN" || role === "STAFF";
}

// Gated by the dedicated "comercial_directorio" module (Comercial +
// Dirección de Campus, read-only for Calidad y Control) — this used to
// reuse "admisiones", which incorrectly also gave Recepción (who has
// "read" there for lead handoff) visibility into Comercial's reengagement
// tooling.
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }
  const role = (session.user as { role: Role }).role;
  if (!assertAdminOrStaff(role)) {
    return Response.json({ error: "No autorizado" }, { status: 403 });
  }

  const access = await hasModuleAccess(session.user as { id: string; role: Role }, "comercial_directorio");
  if (access === "none") {
    return Response.json({ error: "No autorizado" }, { status: 403 });
  }

  const scope = await getCampusScope(session.user as { id: string; role: Role });
  const campusWhere: Prisma.StudentWhereInput =
    scope.type === "ALL" ? {} : scope.type === "CAMPUS_LIST" ? { campusId: { in: scope.campusIds } } : { id: { in: [] } };

  const students = await prisma.student.findMany({
    where: { ...campusWhere, estatusAlumno: { in: ["BAJA", "GRADUADO"] } },
    orderBy: { user: { name: "asc" } },
    include: {
      user: { select: { name: true, email: true } },
      campus: { select: { name: true } },
      alumniOutreachLogs: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { createdBy: { select: { name: true } } },
      },
    },
  });

  return Response.json(
    students.map((s) => ({
      id: s.id,
      name: s.user.name,
      email: s.user.email,
      telefonoMovil: s.telefonoMovil,
      campusName: s.campus.name,
      estatusAlumno: s.estatusAlumno,
      interesadoEnVolver: s.interesadoEnVolver,
      lastLog: s.alumniOutreachLogs[0]
        ? {
            note: s.alumniOutreachLogs[0].note,
            type: s.alumniOutreachLogs[0].type,
            createdAt: s.alumniOutreachLogs[0].createdAt,
            createdByName: s.alumniOutreachLogs[0].createdBy.name,
          }
        : null,
    }))
  );
}
