import { auth } from "@/lib/auth";
import { hasModuleAccess } from "@/lib/staff-permissions";
import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";

function assertAdminOrStaff(role: string) {
  return role === "ADMIN" || role === "STAFF";
}

// Gated by the dedicated "biblioteca_material" module (Control Escolar +
// Dirección de Campus) — this used to reuse "solicitudes", which
// incorrectly also gave Recepción (who has "initiate" there for group-
// change requests) visibility into the material library.
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }
  const role = (session.user as { role: Role }).role;
  if (!assertAdminOrStaff(role)) {
    return Response.json({ error: "No autorizado" }, { status: 403 });
  }

  const access = await hasModuleAccess(session.user as { id: string; role: Role }, "biblioteca_material");
  if (access !== "full") {
    return Response.json({ error: "No autorizado" }, { status: 403 });
  }

  const carpetas = await prisma.materialCarpeta.findMany({
    orderBy: { nombre: "asc" },
    include: {
      createdBy: { select: { name: true } },
      _count: { select: { items: true } },
      requests: {
        where: { status: "PENDIENTE" },
        select: { id: true },
      },
    },
  });

  return Response.json(
    carpetas.map((c) => ({
      id: c.id,
      nombre: c.nombre,
      descripcion: c.descripcion,
      createdByName: c.createdBy.name,
      createdAt: c.createdAt,
      itemCount: c._count.items,
      pendingRequestCount: c.requests.length,
    }))
  );
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }
  const role = (session.user as { role: Role }).role;
  if (!assertAdminOrStaff(role)) {
    return Response.json({ error: "No autorizado" }, { status: 403 });
  }

  const access = await hasModuleAccess(session.user as { id: string; role: Role }, "biblioteca_material");
  if (access !== "full") {
    return Response.json({ error: "No autorizado" }, { status: 403 });
  }

  let body: { nombre?: string; descripcion?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Cuerpo de la solicitud inválido" }, { status: 400 });
  }

  const nombre = body.nombre?.trim();
  if (!nombre || nombre.length > 100) {
    return Response.json({ error: "Nombre inválido" }, { status: 400 });
  }
  if (body.descripcion !== undefined && body.descripcion.length > 500) {
    return Response.json({ error: "Descripción demasiado larga" }, { status: 400 });
  }

  const carpeta = await prisma.materialCarpeta.create({
    data: {
      nombre,
      descripcion: body.descripcion?.trim() || null,
      createdById: (session.user as { id: string }).id,
    },
  });

  return Response.json(carpeta, { status: 201 });
}
