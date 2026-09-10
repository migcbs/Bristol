import { auth } from "@/lib/auth";
import { getCampusScope } from "@/lib/campus-scope";
import { hasModuleAccess } from "@/lib/staff-permissions";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

function assertAdminOrStaff(role: string) {
  return role === "ADMIN" || role === "STAFF";
}

// Gated by the dedicated "recursos_caja" module (Caja-only) — this used to
// reuse "cobranzas", which incorrectly also gave Recepción (who has
// "initiate" on cobranzas) visibility into Caja's physical inventory.
function campusWhere(scope: Awaited<ReturnType<typeof getCampusScope>>): Prisma.RecursoMaterialWhereInput {
  if (scope.type === "ALL") return {};
  if (scope.type === "CAMPUS_LIST") return { campusId: { in: scope.campusIds } };
  return { id: { in: [] } };
}

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }
  const role = (session.user as { role: string }).role;
  if (!assertAdminOrStaff(role)) {
    return Response.json({ error: "No autorizado" }, { status: 403 });
  }

  const access = await hasModuleAccess(session.user as { id: string; role: any }, "recursos_caja");
  if (access === "none") {
    return Response.json({ error: "No autorizado" }, { status: 403 });
  }

  const scope = await getCampusScope(session.user as { id: string; role: any });
  const recursos = await prisma.recursoMaterial.findMany({
    where: campusWhere(scope),
    orderBy: { nombre: "asc" },
    include: { campus: true },
  });
  return Response.json(recursos);
}

export async function POST(request: Request) {
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

  let body: { nombre?: string; campusId?: string; cantidadDisponible?: number; precioUnitarioCents?: number | null };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Cuerpo de la solicitud inválido" }, { status: 400 });
  }

  const nombre = body.nombre?.trim();
  if (!nombre || nombre.length > 150 || !body.campusId) {
    return Response.json({ error: "Datos inválidos" }, { status: 400 });
  }
  const cantidad = body.cantidadDisponible ?? 0;
  if (!Number.isSafeInteger(cantidad) || cantidad < 0) {
    return Response.json({ error: "Cantidad inválida" }, { status: 400 });
  }
  if (
    body.precioUnitarioCents !== undefined &&
    body.precioUnitarioCents !== null &&
    (!Number.isSafeInteger(body.precioUnitarioCents) || body.precioUnitarioCents < 0)
  ) {
    return Response.json({ error: "Precio inválido" }, { status: 400 });
  }

  const scope = await getCampusScope(session.user as { id: string; role: any });
  const inScope = scope.type === "ALL" || (scope.type === "CAMPUS_LIST" && scope.campusIds.includes(body.campusId));
  if (!inScope) {
    return Response.json({ error: "Plantel fuera de tu alcance" }, { status: 403 });
  }

  const recurso = await prisma.recursoMaterial.create({
    data: {
      nombre,
      campusId: body.campusId,
      cantidadDisponible: cantidad,
      precioUnitarioCents: body.precioUnitarioCents ?? null,
    },
  });
  return Response.json(recurso, { status: 201 });
}
