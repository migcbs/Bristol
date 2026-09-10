import { auth } from "@/lib/auth";
import { notify } from "@/lib/notifications";
import { hasModuleAccess } from "@/lib/staff-permissions";
import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }
  const role = (session.user as { role: Role }).role;
  if (role !== "ADMIN" && role !== "STAFF") {
    return Response.json({ error: "No autorizado" }, { status: 403 });
  }

  let body: { decision?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Cuerpo de la solicitud inválido" }, { status: 400 });
  }

  if (body.decision !== "APROBADA" && body.decision !== "RECHAZADA") {
    return Response.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const { id } = await context.params;
  return reviewMaterialAccessRequest(session.user as { id: string; role: Role }, id, body.decision);
}

/**
 * Core approve/reject logic, shared between the PATCH route above and
 * (if a Server Action version is ever added) an admin-page form — mirrors
 * reviewGroupChangeRequest in
 * src/app/api/admin/group-change-requests/[id]/route.ts.
 */
export async function reviewMaterialAccessRequest(
  actor: { id: string; role: Role },
  id: string,
  decision: "APROBADA" | "RECHAZADA"
) {
  const access = await hasModuleAccess(actor, "biblioteca_material");
  if (access !== "full") {
    return Response.json({ error: "No autorizado" }, { status: 403 });
  }

  const materialRequest = await prisma.materialAccessRequest.findUnique({
    where: { id },
    include: { carpeta: true },
  });
  if (!materialRequest) {
    return Response.json({ error: "No encontrado" }, { status: 404 });
  }
  if (materialRequest.status !== "PENDIENTE") {
    return Response.json({ error: "Esta solicitud ya fue revisada" }, { status: 400 });
  }

  const updated = await prisma.materialAccessRequest.update({
    where: { id },
    data: { status: decision, reviewedById: actor.id, reviewedAt: new Date() },
  });

  await notify(
    materialRequest.teacherId,
    decision === "APROBADA"
      ? `Se te dio acceso a la carpeta "${materialRequest.carpeta.nombre}"`
      : `Tu solicitud de acceso a "${materialRequest.carpeta.nombre}" fue rechazada`,
    "/portal/biblioteca"
  );

  return Response.json(updated);
}
