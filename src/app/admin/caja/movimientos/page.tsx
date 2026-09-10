import { auth } from "@/lib/auth";
import { getCampusScope } from "@/lib/campus-scope";
import { hasModuleAccess } from "@/lib/staff-permissions";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Table, TableRow, TableCell, TableHead } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatMoneyMXN } from "@/lib/invoice-status";
import { CashMovementModal } from "@/components/admin/cash-movement-modal";
import { CashRegisterView } from "@/components/admin/cash-register-view";

export default async function MovimientosCajaPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const role = (session.user as { role: string }).role;
  if (role !== "ADMIN" && role !== "STAFF") redirect("/portal");

  const access = await hasModuleAccess(session.user as { id: string; role: any }, "recursos_caja");
  if (access === "none") redirect("/admin");

  const scope = await getCampusScope(session.user as { id: string; role: any });
  const campuses =
    scope.type === "ALL"
      ? await prisma.campus.findMany({ orderBy: { name: "asc" } })
      : scope.type === "CAMPUS_LIST"
        ? await prisma.campus.findMany({ where: { id: { in: scope.campusIds } }, orderBy: { name: "asc" } })
        : [];

  const movimientos = await prisma.cashMovement.findMany({
    where:
      scope.type === "ALL" ? {} : scope.type === "CAMPUS_LIST" ? { campusId: { in: scope.campusIds } } : { id: { in: [] } },
    orderBy: { createdAt: "desc" },
    include: { campus: true, createdBy: { select: { name: true } } },
  });

  const canEdit = access === "full" || access === "initiate";
  const canOpenCaja = access === "full";
  const totalEntradas = movimientos.filter((m) => m.tipo === "ENTRADA").reduce((sum, m) => sum + m.montoCents, 0);
  const totalSalidas = movimientos.filter((m) => m.tipo === "SALIDA").reduce((sum, m) => sum + m.montoCents, 0);

  return (
    <div>
      <h1 className="text-lg font-semibold">Caja</h1>
      <p className="mt-1 text-sm text-muted">Apertura, corte y cierre de caja, más el detalle de todos los movimientos.</p>

      {/* Corte de caja — antes era su propia sección de nav; el usuario
          pidió 2026-09-09 que viviera aquí, dentro de Caja, junto al
          ledger de movimientos. Sólo "full" (Caja) puede abrir/cerrar. */}
      {canOpenCaja && (
        <div className="mt-6 space-y-4">
          {campuses.map((campus) => (
            <CashRegisterView key={campus.id} campusId={campus.id} campusName={campus.name} />
          ))}
        </div>
      )}

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold">Movimientos</h2>
        {canEdit && <CashMovementModal campuses={campuses.map((c) => ({ id: c.id, name: c.name }))} />}
      </div>

      <div className="mt-4 flex gap-4 text-sm">
        <p>
          Entradas: <span className="font-semibold text-primary">{formatMoneyMXN(totalEntradas)}</span>
        </p>
        <p>
          Salidas: <span className="font-semibold text-accent-dark">{formatMoneyMXN(totalSalidas)}</span>
        </p>
        <p>
          Neto: <span className="font-semibold">{formatMoneyMXN(totalEntradas - totalSalidas)}</span>
        </p>
      </div>

      <div className="mt-6 overflow-x-auto">
        <Table>
          <thead>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Concepto</TableHead>
              <TableHead>Monto</TableHead>
              <TableHead>Plantel</TableHead>
              <TableHead>Registrado por</TableHead>
            </TableRow>
          </thead>
          <tbody>
            {movimientos.map((mov) => (
              <TableRow key={mov.id}>
                <TableCell>{mov.createdAt.toLocaleDateString("es-MX")}</TableCell>
                <TableCell>
                  <Badge tone={mov.tipo === "ENTRADA" ? "primary" : "accent"}>
                    {mov.tipo === "ENTRADA" ? "Entrada" : "Salida"}
                  </Badge>
                </TableCell>
                <TableCell>{mov.concepto}</TableCell>
                <TableCell>{formatMoneyMXN(mov.montoCents)}</TableCell>
                <TableCell>{mov.campus.name}</TableCell>
                <TableCell>{mov.createdBy.name}</TableCell>
              </TableRow>
            ))}
          </tbody>
        </Table>
        {movimientos.length === 0 && (
          <p className="mt-6 text-center text-sm text-muted">No hay movimientos registrados todavía.</p>
        )}
      </div>
    </div>
  );
}
