import { auth } from "@/lib/auth";
import { getCampusScope } from "@/lib/campus-scope";
import { prisma } from "@/lib/prisma";
import type { LeadStatus } from "@prisma/client";

const VALID_STATUSES: LeadStatus[] = ["NEW", "CONTACTED", "ENROLLED", "LOST"];

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }

  const role = (session.user as { role: string }).role;
  if (role !== "ADMIN" && role !== "STAFF") {
    return Response.json({ error: "No autorizado" }, { status: 403 });
  }

  let body: { status?: string; campusId?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Cuerpo de la solicitud inválido" }, { status: 400 });
  }

  if (body.status !== undefined && !VALID_STATUSES.includes(body.status as LeadStatus)) {
    return Response.json({ error: "Estatus inválido" }, { status: 400 });
  }

  if (body.campusId !== undefined) {
    const campus = await prisma.campus.findUnique({ where: { id: body.campusId } });
    if (!campus) {
      return Response.json({ error: "Plantel inválido" }, { status: 400 });
    }
  }

  const { id } = await context.params;
  const lead = await prisma.lead.findUnique({ where: { id } });
  if (!lead) {
    return Response.json({ error: "No encontrado" }, { status: 404 });
  }

  const scope = await getCampusScope(session.user as { id: string; role: any });

  if (
    body.campusId !== undefined &&
    scope.type === "CAMPUS_LIST" &&
    !scope.campusIds.includes(body.campusId)
  ) {
    return Response.json({ error: "Plantel fuera de tu alcance" }, { status: 400 });
  }

  const inScope =
    scope.type === "ALL" ||
    (scope.type === "CAMPUS_LIST" &&
      (lead.campusId === null || scope.campusIds.includes(lead.campusId)));

  if (!inScope) {
    return Response.json({ error: "No encontrado" }, { status: 404 });
  }

  const data: { status?: LeadStatus; campusId?: string } = {};
  if (body.status !== undefined) data.status = body.status as LeadStatus;
  if (body.campusId !== undefined) data.campusId = body.campusId;

  const updated = await prisma.lead.update({ where: { id }, data });
  return Response.json(updated);
}
