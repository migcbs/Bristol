import { auth } from "@/lib/auth";
import { getCampusScope } from "@/lib/campus-scope";
import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";

const OVERLAP_WINDOW_MS = 30 * 60 * 1000; // 30-minute exams; a new one within this window of an existing one at the same campus is a conflict

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }
  const role = (session.user as { role: Role }).role;
  if (role !== "ADMIN" && role !== "STAFF") {
    return Response.json({ error: "No autorizado" }, { status: 403 });
  }

  const scope = await getCampusScope(session.user as { id: string; role: Role });
  const where =
    scope.type === "ALL" ? {} : scope.type === "CAMPUS_LIST" ? { campusId: { in: scope.campusIds } } : { id: { in: [] } };

  const appointments = await prisma.placementAppointment.findMany({
    where,
    orderBy: { scheduledFor: "asc" },
    include: { lead: true },
  });

  return Response.json(appointments);
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

  let body: { leadId?: string; campusId?: string; scheduledFor?: string; notes?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Cuerpo de la solicitud inválido" }, { status: 400 });
  }

  if (!body.leadId || !body.campusId || !body.scheduledFor) {
    return Response.json({ error: "Datos inválidos" }, { status: 400 });
  }

  if (role === "STAFF") {
    const scope = await getCampusScope(session.user as { id: string; role: Role });
    const inScope = scope.type === "ALL" || (scope.type === "CAMPUS_LIST" && scope.campusIds.includes(body.campusId));
    if (!inScope) {
      return Response.json({ error: "No autorizado" }, { status: 403 });
    }
  }

  const scheduledFor = new Date(body.scheduledFor);
  if (Number.isNaN(scheduledFor.getTime())) {
    return Response.json({ error: "Fecha inválida" }, { status: 400 });
  }

  const lead = await prisma.lead.findUnique({ where: { id: body.leadId } });
  if (!lead) {
    return Response.json({ error: "Lead no encontrado" }, { status: 404 });
  }

  const windowStart = new Date(scheduledFor.getTime() - OVERLAP_WINDOW_MS);
  const windowEnd = new Date(scheduledFor.getTime() + OVERLAP_WINDOW_MS);
  const overlapping = await prisma.placementAppointment.findMany({
    where: { campusId: body.campusId, scheduledFor: { gte: windowStart, lte: windowEnd } },
  });
  if (overlapping.length > 0) {
    return Response.json({ error: "Ya existe una cita en ese horario para este plantel" }, { status: 400 });
  }

  const appointment = await prisma.placementAppointment.create({
    data: {
      leadId: body.leadId,
      campusId: body.campusId,
      scheduledFor,
      notes: body.notes?.trim() || null,
    },
  });

  return Response.json(appointment, { status: 201 });
}
