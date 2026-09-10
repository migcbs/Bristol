import { auth } from "@/lib/auth";
import { assertCampusInScope } from "@/lib/campus-scope";
import { hasModuleAccess } from "@/lib/staff-permissions";
import { notify } from "@/lib/notifications";
import { formatMoneyMXN } from "@/lib/invoice-status";
import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";

// The actual point-of-sale — confirmed with the user 2026-09-09: "en caja
// debe haber un pequeño punto de venta que sirva, que descuente el stock,
// haga notificaciones cuando haya falta comprar". Requires an open
// CashRegisterSession for the resource's campus (a sale is a cash-drawer
// event, so it can't happen with no drawer open) and does the stock
// decrement + CashMovement creation in one transaction so a sale is never
// half-recorded.
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }
  const actor = session.user as { id: string; role: Role };
  if (actor.role !== "ADMIN" && actor.role !== "STAFF") {
    return Response.json({ error: "No autorizado" }, { status: 403 });
  }
  const access = await hasModuleAccess(actor, "recursos_caja");
  if (access !== "full") {
    return Response.json({ error: "No autorizado" }, { status: 403 });
  }

  let body: { recursoMaterialId?: string; cantidad?: number };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Cuerpo de la solicitud inválido" }, { status: 400 });
  }
  if (!body.recursoMaterialId || !Number.isInteger(body.cantidad) || body.cantidad! < 1) {
    return Response.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const recurso = await prisma.recursoMaterial.findUnique({ where: { id: body.recursoMaterialId } });
  if (!recurso) {
    return Response.json({ error: "Recurso no encontrado" }, { status: 404 });
  }
  if (actor.role === "STAFF") {
    const inScope = await assertCampusInScope(actor, recurso.campusId);
    if (!inScope) {
      return Response.json({ error: "No autorizado" }, { status: 403 });
    }
  }
  if (recurso.precioUnitarioCents == null) {
    return Response.json({ error: "Este recurso no tiene precio unitario configurado" }, { status: 400 });
  }
  if (recurso.cantidadDisponible < body.cantidad!) {
    return Response.json({ error: `Solo quedan ${recurso.cantidadDisponible} disponibles` }, { status: 400 });
  }

  const cashSession = await prisma.cashRegisterSession.findFirst({
    where: { campusId: recurso.campusId, status: "ABIERTA" },
  });
  if (!cashSession) {
    return Response.json({ error: "Abre la caja de este plantel antes de vender" }, { status: 400 });
  }

  const cantidad = body.cantidad!;
  const totalCents = recurso.precioUnitarioCents * cantidad;

  const [updatedRecurso, movement] = await prisma.$transaction([
    prisma.recursoMaterial.update({
      where: { id: recurso.id },
      data: { cantidadDisponible: { decrement: cantidad } },
    }),
    prisma.cashMovement.create({
      data: {
        campusId: recurso.campusId,
        tipo: "ENTRADA",
        concepto: `Venta: ${recurso.nombre} x${cantidad}`,
        montoCents: totalCents,
        recursoMaterialId: recurso.id,
        cantidad,
        cashRegisterSessionId: cashSession.id,
        createdById: actor.id,
      },
    }),
  ]);

  if (updatedRecurso.cantidadDisponible <= updatedRecurso.stockMinimo) {
    const staffToNotify = await prisma.user.findMany({
      where: {
        OR: [{ role: "ADMIN" }, { role: "STAFF", staffPosition: "CAJA" }],
      },
      select: { id: true },
    });
    const message =
      updatedRecurso.cantidadDisponible === 0
        ? `${updatedRecurso.nombre} se agotó — hay que reabastecer.`
        : `Quedan ${updatedRecurso.cantidadDisponible} de ${updatedRecurso.nombre} — por debajo del mínimo (${updatedRecurso.stockMinimo}).`;
    await Promise.all(
      staffToNotify.map((u) => notify(u.id, message, "/admin/caja/recursos-materiales"))
    );
  }

  return Response.json(
    { movement, remaining: updatedRecurso.cantidadDisponible, totalFormatted: formatMoneyMXN(totalCents) },
    { status: 201 }
  );
}
