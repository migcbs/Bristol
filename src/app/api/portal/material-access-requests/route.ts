import { auth } from "@/lib/auth";
import { notify } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }
  const role = (session.user as { role: Role }).role;
  if (role !== "TEACHER") {
    return Response.json({ error: "No autorizado" }, { status: 403 });
  }
  const teacherId = (session.user as { id: string }).id;

  let body: { carpetaId?: string; motivo?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Cuerpo de la solicitud inválido" }, { status: 400 });
  }

  if (!body.carpetaId) {
    return Response.json({ error: "Datos inválidos" }, { status: 400 });
  }
  if (body.motivo !== undefined && body.motivo.length > 500) {
    return Response.json({ error: "Motivo demasiado largo" }, { status: 400 });
  }

  const carpeta = await prisma.materialCarpeta.findUnique({ where: { id: body.carpetaId } });
  if (!carpeta) {
    return Response.json({ error: "No encontrado" }, { status: 404 });
  }

  const existing = await prisma.materialAccessRequest.findFirst({
    where: { carpetaId: body.carpetaId, teacherId, status: { in: ["PENDIENTE", "APROBADA"] } },
  });
  if (existing) {
    return Response.json(
      { error: existing.status === "APROBADA" ? "Ya tienes acceso a esta carpeta" : "Ya tienes una solicitud pendiente para esta carpeta" },
      { status: 409 }
    );
  }

  const materialRequest = await prisma.materialAccessRequest.create({
    data: { carpetaId: body.carpetaId, teacherId, motivo: body.motivo?.trim() || null },
  });

  // Best-effort: let Control Escolar / Dirección de Campus know a request is
  // waiting. Notifying every reviewer (rather than a single owner) mirrors
  // how the review authority for this queue is shared across puestos.
  const reviewers = await prisma.user.findMany({
    where: { OR: [{ role: "ADMIN" }, { staffPosition: { in: ["CONTROL_ESCOLAR", "DIRECCION_CAMPUS"] } }] },
    select: { id: true },
  });
  await Promise.all(
    reviewers.map((r) =>
      notify(r.id, `Nueva solicitud de acceso a "${carpeta.nombre}"`, "/admin/control-escolar/biblioteca")
    )
  );

  return Response.json(materialRequest, { status: 201 });
}
