import { auth } from "@/lib/auth";
import { getCampusScope, incidentScopeWhere } from "@/lib/campus-scope";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import { Table, TableRow, TableCell, TableHead } from "@/components/ui/table";

export default async function IncidenciasAdminPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const role = (session.user as { role: string }).role;
  if (role !== "ADMIN" && role !== "STAFF") redirect("/portal");

  const scope = await getCampusScope(session.user as { id: string; role: Role });
  const where = incidentScopeWhere(scope);

  const incidents = await prisma.incident.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      student: { include: { user: { select: { id: true, name: true } } } },
      reportedBy: { select: { id: true, name: true } },
      group: true,
    },
  });

  return (
    <div>
      <h1 className="text-lg font-semibold">Incidencias</h1>
      <div className="mt-6 overflow-x-auto">
        <Table>
          <thead>
            <TableRow>
              <TableHead>Alumno</TableHead>
              <TableHead>Grupo</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead>Registrado por</TableHead>
              <TableHead>Fecha</TableHead>
            </TableRow>
          </thead>
          <tbody>
            {incidents.map((incident) => (
              <TableRow key={incident.id}>
                <TableCell>{incident.student.user.name}</TableCell>
                <TableCell>{incident.group?.name ?? "—"}</TableCell>
                <TableCell>{incident.description}</TableCell>
                <TableCell>{incident.reportedBy.name}</TableCell>
                <TableCell>{incident.createdAt.toLocaleDateString("es-MX")}</TableCell>
              </TableRow>
            ))}
          </tbody>
        </Table>
        {incidents.length === 0 && (
          <p className="mt-6 text-center text-sm text-muted">No hay incidencias que mostrar.</p>
        )}
      </div>
    </div>
  );
}
