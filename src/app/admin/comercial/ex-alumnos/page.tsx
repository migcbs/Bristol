import { auth } from "@/lib/auth";
import { getCampusScope } from "@/lib/campus-scope";
import { hasModuleAccess } from "@/lib/staff-permissions";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { ExAlumnosCards } from "./ex-alumnos-cards";
import type { Prisma, Role } from "@prisma/client";

export default async function ExAlumnosPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const role = (session.user as { role: Role }).role;
  if (role !== "ADMIN" && role !== "STAFF") redirect("/portal");

  const access = await hasModuleAccess(session.user as { id: string; role: Role }, "comercial_directorio");
  if (access === "none") redirect("/admin");

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
        include: { createdBy: { select: { name: true } } },
      },
    },
  });

  return (
    <div>
      <h1 className="text-lg font-semibold">Ex Alumnos</h1>
      <p className="mt-1 text-sm text-muted">
        Alumnos dados de baja o graduados — da seguimiento para posible reenganche.
      </p>

      <div className="mt-6">
        <ExAlumnosCards students={students} canEdit={access === "full"} />
      </div>
    </div>
  );
}
