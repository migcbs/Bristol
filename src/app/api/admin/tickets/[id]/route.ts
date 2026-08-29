import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Role, TicketStatus } from "@prisma/client";

const VALID_STATUSES: TicketStatus[] = ["ABIERTO", "EN_PROCESO", "RESUELTO"];

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }
  const role = (session.user as { role: Role }).role;
  if (role !== "ADMIN" && role !== "STAFF") {
    return Response.json({ error: "No autorizado" }, { status: 403 });
  }

  let body: { status?: string; assignedToId?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Cuerpo de la solicitud inválido" }, { status: 400 });
  }

  if (body.status !== undefined && !VALID_STATUSES.includes(body.status as TicketStatus)) {
    return Response.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const { id } = await params;
  const ticket = await prisma.interAreaTicket.findUnique({ where: { id } });
  if (!ticket) {
    return Response.json({ error: "No encontrado" }, { status: 404 });
  }

  if (body.assignedToId) {
    const assignee = await prisma.user.findUnique({ where: { id: body.assignedToId } });
    if (!assignee) {
      return Response.json({ error: "Usuario asignado inválido" }, { status: 400 });
    }
  }

  const data: { status?: TicketStatus; resolvedAt?: Date | null; assignedToId?: string } = {};
  if (body.status !== undefined) {
    data.status = body.status as TicketStatus;
    data.resolvedAt = body.status === "RESUELTO" ? new Date() : null;
  }
  if (body.assignedToId !== undefined) {
    data.assignedToId = body.assignedToId;
  }

  const updated = await prisma.interAreaTicket.update({ where: { id }, data });
  return Response.json(updated);
}
