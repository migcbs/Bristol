import { auth } from "@/lib/auth";
import { getCampusScope, enrollmentScopeWhere } from "@/lib/campus-scope";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import { Table, TableRow, TableCell, TableHead } from "@/components/ui/table";
import { ReenrollRowActions } from "@/components/admin/reenroll-row-actions";

export default async function ReinscripcionesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const role = (session.user as { role: string }).role;
  if (role !== "ADMIN" && role !== "STAFF") redirect("/portal");

  const scope = await getCampusScope(session.user as { id: string; role: Role });
  const enrollmentWhere = enrollmentScopeWhere(scope);

  const enrollments = await prisma.enrollment.findMany({
    where: enrollmentWhere,
    orderBy: { enrolledAt: "asc" },
    include: {
      student: { include: { user: { select: { id: true, name: true } }, campus: true } },
      group: { include: { level: true } },
    },
  });

  const campusIds = [...new Set(enrollments.map((e) => e.student.campusId))];
  const groups = campusIds.length
    ? await prisma.group.findMany({
        where: { campusId: { in: campusIds } },
        include: { level: true },
      })
    : [];

  return (
    <div>
      <h1 className="text-lg font-semibold">Reinscripciones</h1>
      <p className="mt-1 text-sm text-muted">
        Alumnos con inscripción activa. Selecciona el grupo destino y reinscribe.
      </p>
      <div className="mt-6 overflow-x-auto">
        <Table>
          <thead>
            <TableRow>
              <TableHead>Alumno</TableHead>
              <TableHead>Plantel</TableHead>
              <TableHead>Grupo actual</TableHead>
              <TableHead>Reinscribir a</TableHead>
            </TableRow>
          </thead>
          <tbody>
            {enrollments.map((enrollment) => {
              const campusGroups = groups
                .filter((g) => g.campusId === enrollment.student.campusId && g.id !== enrollment.groupId)
                .map((g) => ({ id: g.id, label: `${g.level.code} · ${g.name}` }));

              return (
                <TableRow key={enrollment.id}>
                  <TableCell>{enrollment.student.user.name}</TableCell>
                  <TableCell>{enrollment.student.campus.name}</TableCell>
                  <TableCell>
                    {enrollment.group.level.code} · {enrollment.group.name}
                  </TableCell>
                  <TableCell>
                    {campusGroups.length > 0 ? (
                      <ReenrollRowActions enrollmentId={enrollment.id} groups={campusGroups} />
                    ) : (
                      <span className="text-xs text-muted">Sin otros grupos disponibles</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </tbody>
        </Table>
        {enrollments.length === 0 && (
          <p className="mt-6 text-center text-sm text-muted">
            No hay inscripciones activas que mostrar.
          </p>
        )}
      </div>
    </div>
  );
}
