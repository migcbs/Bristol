import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getCampusScope, leadScopeWhere } from "@/lib/campus-scope";
import { prisma } from "@/lib/prisma";
import { Table, TableRow, TableCell, TableHead } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { LeadRowActions } from "@/components/admin/lead-row-actions";
import { LEAD_STATUS_LABELS, LEAD_STATUS_TONE } from "@/lib/lead-status";

export default async function AdmisionesPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  const role = (session.user as { role: string }).role;
  if (role !== "ADMIN" && role !== "STAFF") redirect("/portal");

  const scope = await getCampusScope(session.user as { id: string; role: any });

  const where = leadScopeWhere(scope);

  const [leads, campuses, advisors] = await Promise.all([
    prisma.lead.findMany({ where, orderBy: { createdAt: "desc" }, include: { campus: true } }),
    prisma.campus.findMany({ orderBy: { name: "asc" } }),
    prisma.user.findMany({
      where: { role: { in: ["ADMIN", "STAFF"] } },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
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
                  <Badge tone={LEAD_STATUS_TONE[lead.status]}>
                    {LEAD_STATUS_LABELS[lead.status]}
                  </Badge>
                </TableCell>
                <TableCell>{lead.createdAt.toLocaleDateString("es-MX")}</TableCell>
                <TableCell>
                  <LeadRowActions
                    leadId={lead.id}
                    initialStatus={lead.status}
                    initialCampusId={lead.campusId}
                    campuses={campuses}
                    initialAsesorAsignadoId={lead.asesorAsignadoId}
                    advisors={advisors}
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
