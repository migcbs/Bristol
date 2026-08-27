import { auth } from "@/lib/auth";
import { getCampusScope } from "@/lib/campus-scope";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { Table, TableRow, TableCell, TableHead } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { LeadRowActions } from "@/components/admin/lead-row-actions";

const STATUS_LABELS: Record<string, string> = {
  NEW: "Nuevo",
  CONTACTED: "Contactado",
  ENROLLED: "Inscrito",
  LOST: "Perdido",
};

export default async function AdmisionesPage() {
  const session = await auth();
  const scope = await getCampusScope(session!.user as { id: string; role: any });

  const where: Prisma.LeadWhereInput =
    scope.type === "ALL"
      ? {}
      : scope.type === "CAMPUS_LIST"
        ? { OR: [{ campusId: { in: scope.campusIds } }, { campusId: null }] }
        : {};

  const [leads, campuses] = await Promise.all([
    prisma.lead.findMany({ where, orderBy: { createdAt: "desc" }, include: { campus: true } }),
    prisma.campus.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div>
      <h1 className="text-lg font-semibold">Admisiones</h1>
      <p className="mt-1 text-sm text-muted">
        Leads capturados desde la landing, más recientes primero.
      </p>
      <div className="mt-6 overflow-x-auto">
        <Table>
          <thead>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Contacto</TableHead>
              <TableHead>Plantel</TableHead>
              <TableHead>Estatus</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Acciones</TableHead>
            </TableRow>
          </thead>
          <tbody>
            {leads.map((lead) => (
              <TableRow key={lead.id}>
                <TableCell>{lead.name}</TableCell>
                <TableCell>
                  <div className="text-sm">{lead.email}</div>
                  {lead.phone && <div className="text-xs text-muted">{lead.phone}</div>}
                </TableCell>
                <TableCell>{lead.campus?.name ?? "Sin asignar"}</TableCell>
                <TableCell>
                  <Badge tone="primary">{STATUS_LABELS[lead.status]}</Badge>
                </TableCell>
                <TableCell>{lead.createdAt.toLocaleDateString("es-MX")}</TableCell>
                <TableCell>
                  <LeadRowActions
                    leadId={lead.id}
                    initialStatus={lead.status}
                    initialCampusId={lead.campusId}
                    campuses={campuses}
                  />
                </TableCell>
              </TableRow>
            ))}
          </tbody>
        </Table>
        {leads.length === 0 && (
          <p className="mt-6 text-center text-sm text-muted">
            No hay leads que mostrar todavía.
          </p>
        )}
      </div>
    </div>
  );
}
