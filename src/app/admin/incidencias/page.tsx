import { auth } from "@/lib/auth";
import { getCampusScope, incidentScopeWhere } from "@/lib/campus-scope";
import { hasModuleAccess } from "@/lib/staff-permissions";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import { IncidenciasView, type IncidenciaRow } from "@/components/admin/incidencias-view";

// Case-management for conduct/discipline reports. Per the user's
// 2026-09-09 requests this now has a calendar view and a resolution
// popup (see IncidenciasView). Changing status is gated to "full" access
// (Calidad y Control); everyone else with any access just reads.
export default async function IncidenciasAdminPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const actor = session.user as { id: string; role: Role };
  if (actor.role !== "ADMIN" && actor.role !== "STAFF") redirect("/portal");

  const access = await hasModuleAccess(actor, "incidencias");
  if (access === "none") redirect("/admin");
  const canManage = access === "full";

  const scope = await getCampusScope(actor);
  const where = incidentScopeWhere(scope);

  const incidents = await prisma.incident.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      student: { include: { user: { select: { id: true, name: true } } } },
      reportedBy: { select: { id: true, name: true } },
      resolvedBy: { select: { name: true } },
      group: true,
    },
  });

  const rows: IncidenciaRow[] = incidents.map((i) => ({
    id: i.id,
    studentUserId: i.student.user.id,
    studentName: i.student.user.name,
    groupName: i.group?.name ?? null,
    description: i.description,
    status: i.status,
    resolucion: i.resolucion,
    resolvedByName: i.resolvedBy?.name ?? null,
    reportedByName: i.reportedBy.name,
    createdAt: i.createdAt.toISOString(),
  }));

  return (
    <div>
      <h1 className="text-lg font-semibold">Incidencias</h1>
      <p className="mt-1 text-sm text-muted">
        {canManage
          ? "Da seguimiento y resuelve cada reporte. Haz clic en una incidencia para gestionarla."
          : "Consulta de reportes de conducta y disciplina."}
      </p>

      <div className="mt-6">
        <IncidenciasView incidents={rows} canManage={canManage} />
      </div>
    </div>
  );
}
