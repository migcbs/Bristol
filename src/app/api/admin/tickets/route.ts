import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";

const MAX_TITLE_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 2000;

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }
  const role = (session.user as { role: Role }).role;
  if (role !== "ADMIN" && role !== "STAFF") {
    return Response.json({ error: "No autorizado" }, { status: 403 });
  }

  const tickets = await prisma.interAreaTicket.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      createdBy: { select: { id: true, name: true } },
      assignedTo: { select: { id: true, name: true } },
    },
  });

  return Response.json(tickets);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }
  const role = (session.user as { role: Role }).role;
  if (role !== "ADMIN" && role !== "STAFF") {
    return Response.json({ error: "No autorizado" }, { status: 403 });
  }

  let body: { title?: string; description?: string; assignedToId?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Cuerpo de la solicitud inválido" }, { status: 400 });
  }

  const title = body.title?.trim();
  const description = body.description?.trim();
  if (!title || title.length > MAX_TITLE_LENGTH || !description || description.length > MAX_DESCRIPTION_LENGTH) {
    return Response.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const assignedToId = body.assignedToId === "" ? null : body.assignedToId;

  if (assignedToId !== undefined && assignedToId !== null) {
    const assignee = await prisma.user.findUnique({ where: { id: assignedToId } });
    if (!assignee) {
      return Response.json({ error: "Usuario asignado inválido" }, { status: 400 });
    }
  }

  const ticket = await prisma.interAreaTicket.create({
    data: {
      title,
      description,
      assignedToId: assignedToId ?? null,
      createdById: (session.user as { id: string }).id,
    },
  });

  return Response.json(ticket, { status: 201 });
}
