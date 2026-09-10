import { auth } from "@/lib/auth";
import { getCampusScope } from "@/lib/campus-scope";
import { hasModuleAccess } from "@/lib/staff-permissions";
import { prisma } from "@/lib/prisma";

function assertAdminOrStaff(role: string) {
  return role === "ADMIN" || role === "STAFF";
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }
  const role = (session.user as { role: string }).role;
  if (!assertAdminOrStaff(role)) {
    return Response.json({ error: "No autorizado" }, { status: 403 });
  }

  const access = await hasModuleAccess(session.user as { id: string; role: any }, "recursos_caja");
  if (access !== "full" && access !== "initiate") {
    return Response.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id } = await context.params;
  const recurso = await prisma.recursoMaterial.findUnique({ where: { id } });
  if (!recurso) {
    return Response.json({ error: "No encontrado" }, { status: 404 });
  }

  const scope = await getCampusScope(session.user as { id: string; role: any });
  const inScope = scope.type === "ALL" || (scope.type === "CAMPUS_LIST" && scope.campusIds.includes(recurso.campusId));
  if (!inScope) {
    return Response.json({ error: "No encontrado" }, { status: 404 });
  }

  let body: {
    nombre?: string;
    cantidadDisponible?: number;
    // Positive number added to the current stock (restock) — an
    // alternative to setting an absolute cantidadDisponible.
    agregarStock?: number;
    precioUnitarioCents?: number | null;
    stockMinimo?: number;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Cuerpo de la solicitud inválido" }, { status: 400 });
  }

  if (body.nombre !== undefined && (!body.nombre.trim() || body.nombre.length > 150)) {
    return Response.json({ error: "Nombre inválido" }, { status: 400 });
  }
  if (
    body.cantidadDisponible !== undefined &&
    (!Number.isSafeInteger(body.cantidadDisponible) || body.cantidadDisponible < 0)
  ) {
    return Response.json({ error: "Cantidad inválida" }, { status: 400 });
  }
  if (body.agregarStock !== undefined && (!Number.isSafeInteger(body.agregarStock) || body.agregarStock < 1)) {
    return Response.json({ error: "La cantidad a agregar debe ser un entero positivo" }, { status: 400 });
  }
  if (body.stockMinimo !== undefined && (!Number.isSafeInteger(body.stockMinimo) || body.stockMinimo < 0)) {
    return Response.json({ error: "Stock mínimo inválido" }, { status: 400 });
  }
  if (
    body.precioUnitarioCents !== undefined &&
    body.precioUnitarioCents !== null &&
    (!Number.isSafeInteger(body.precioUnitarioCents) || body.precioUnitarioCents < 0)
  ) {
    return Response.json({ error: "Precio inválido" }, { status: 400 });
  }

  const updated = await prisma.recursoMaterial.update({
    where: { id },
    data: {
      ...(body.nombre !== undefined && { nombre: body.nombre.trim() }),
      ...(body.cantidadDisponible !== undefined && { cantidadDisponible: body.cantidadDisponible }),
      ...(body.agregarStock !== undefined && { cantidadDisponible: { increment: body.agregarStock } }),
      ...(body.stockMinimo !== undefined && { stockMinimo: body.stockMinimo }),
      ...(body.precioUnitarioCents !== undefined && { precioUnitarioCents: body.precioUnitarioCents }),
    },
  });
  return Response.json(updated);
}
