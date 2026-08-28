import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getCampusScope } from "@/lib/campus-scope";
import { prisma } from "@/lib/prisma";
import { Table, TableHead, TableRow, TableCell } from "@/components/ui/table";
import type { Role } from "@prisma/client";

export default async function GruposDisponibilidadPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  const role = (session.user as { role: Role }).role;
  if (role !== "ADMIN" && role !== "STAFF") redirect("/portal");

  const scope = await getCampusScope(session.user as { id: string; role: Role });
  const where =
    scope.type === "ALL" ? {} : scope.type === "CAMPUS_LIST" ? { campusId: { in: scope.campusIds } } : { id: { in: [] } };

  const groups = await prisma.group.findMany({
    where,
    include: {
      campus: true,
      level: true,
      _count: { select: { enrollments: { where: { completedAt: null } } } },
    },
    orderBy: { name: "asc" },
  });

  return (
    <div>
      <h1 className="text-lg font-semibold">Disponibilidad de grupos</h1>
      <p className="mt-1 text-sm text-muted">Cupo actual de cada grupo.</p>

      <div className="mt-6 overflow-x-auto rounded-lg border border-border bg-white">
        <Table>
          <thead>
            <TableRow>
              <TableHead>Plantel</TableHead>
              <TableHead>Grupo</TableHead>
              <TableHead>Nivel</TableHead>
              <TableHead>Cupo</TableHead>
              <TableHead>Estatus</TableHead>
            </TableRow>
          </thead>
          <tbody>
            {groups.map((group) => {
              const enrolled = group._count.enrollments;
              const isFull = enrolled >= group.cupoMaximo;
              return (
                <TableRow key={group.id}>
                  <TableCell>{group.campus.name}</TableCell>
                  <TableCell>{group.name}</TableCell>
                  <TableCell>{group.level.name}</TableCell>
                  <TableCell className={isFull ? "font-medium text-red-600" : undefined}>
                    {enrolled}/{group.cupoMaximo}
                  </TableCell>
                  <TableCell className={isFull ? "font-medium text-red-600" : undefined}>
                    {isFull ? "Sin cupo" : "Disponible"}
                  </TableCell>
                </TableRow>
              );
            })}
            {groups.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted">
                  No hay grupos.
                </TableCell>
              </TableRow>
            )}
          </tbody>
        </Table>
      </div>
    </div>
  );
}
