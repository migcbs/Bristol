import { auth } from "@/lib/auth";
import { getCampusScope } from "@/lib/campus-scope";
import { hasModuleAccess } from "@/lib/staff-permissions";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { RecursoMaterialModal } from "@/components/admin/recurso-material-modal";
import { RecursosMaterialesGrid } from "@/components/admin/recursos-materiales-grid";

export default async function RecursosMaterialesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const role = (session.user as { role: string }).role;
  if (role !== "ADMIN" && role !== "STAFF") redirect("/portal");

  const access = await hasModuleAccess(session.user as { id: string; role: any }, "recursos_caja");
  if (access === "none") redirect("/admin");

  const scope = await getCampusScope(session.user as { id: string; role: any });
  const campusFilter =
    scope.type === "ALL" ? {} : scope.type === "CAMPUS_LIST" ? { campusId: { in: scope.campusIds } } : { id: { in: [] } };
  const campuses =
    scope.type === "ALL"
      ? await prisma.campus.findMany({ orderBy: { name: "asc" } })
      : scope.type === "CAMPUS_LIST"
        ? await prisma.campus.findMany({ where: { id: { in: scope.campusIds } }, orderBy: { name: "asc" } })
        : [];

  const [recursos, unitsByRecurso] = await Promise.all([
    prisma.recursoMaterial.findMany({
      where: campusFilter,
      orderBy: { nombre: "asc" },
      include: {
        campus: { select: { name: true } },
        ventas: {
          orderBy: { createdAt: "desc" },
          take: 5,
          include: { createdBy: { select: { name: true } } },
        },
      },
    }),
    prisma.cashMovement.groupBy({
      by: ["recursoMaterialId"],
      where: { recursoMaterialId: { not: null } },
      _sum: { cantidad: true },
    }),
  ]);
  const unitsMap = new Map(unitsByRecurso.map((g) => [g.recursoMaterialId, g._sum.cantidad ?? 0]));

  const canEdit = access === "full" || access === "initiate";

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Recursos Materiales</h1>
          <p className="mt-1 text-sm text-muted">
            Inventario físico de la escuela — haz click en un recurso para ver ventas y reabastecer.
          </p>
        </div>
        {canEdit && <RecursoMaterialModal campuses={campuses.map((c) => ({ id: c.id, name: c.name }))} />}
      </div>

      <RecursosMaterialesGrid
        canEdit={canEdit}
        recursos={recursos.map((r) => ({
          id: r.id,
          nombre: r.nombre,
          campusId: r.campusId,
          campusName: r.campus.name,
          cantidadDisponible: r.cantidadDisponible,
          precioUnitarioCents: r.precioUnitarioCents,
          stockMinimo: r.stockMinimo,
          totalVendido: unitsMap.get(r.id) ?? 0,
          recentSales: r.ventas.map((v) => ({
            id: v.id,
            cantidad: v.cantidad,
            montoCents: v.montoCents,
            createdAt: v.createdAt,
            createdByName: v.createdBy.name,
          })),
        }))}
      />
    </div>
  );
}
