import { auth } from "@/lib/auth";
import { assertCampusInScope, getCampusScope } from "@/lib/campus-scope";
import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";

const OVERLAP_WINDOW_MS = 30 * 60 * 1000; // 30-minute exams; a new one within this window of an existing one at the same campus is a conflict
const MAX_NOTES_LENGTH = 2000;

function isLeadUniqueCollision(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const err = error as { code?: unknown; meta?: { target?: unknown } };
  if (err.code !== "P2002") return false;
  const target = err.meta?.target;
  return !target || JSON.stringify(target).includes("leadId");
}

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

  const notes = body.notes?.trim();
  if (notes && notes.length > MAX_NOTES_LENGTH) {
    return Response.json({ error: "Datos inválidos" }, { status: 400 });
  }

  if (role === "STAFF") {
    const inScope = await assertCampusInScope(session.user as { id: string; role: Role }, body.campusId);
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

  if (role === "STAFF" && lead.campusId) {
    const leadInScope = await assertCampusInScope(session.user as { id: string; role: Role }, lead.campusId);
    if (!leadInScope) {
      return Response.json({ error: "No autorizado" }, { status: 403 });
    }
  }

  const windowStart = new Date(scheduledFor.getTime() - OVERLAP_WINDOW_MS);
  const windowEnd = new Date(scheduledFor.getTime() + OVERLAP_WINDOW_MS);
  const overlapping = await prisma.placementAppointment.findMany({
    where: { campusId: body.campusId, scheduledFor: { gte: windowStart, lte: windowEnd } },
  });
  if (overlapping.length > 0) {
    return Response.json({ error: "Ya existe una cita en ese horario para este plantel" }, { status: 400 });
  }

  try {
    const appointment = await prisma.placementAppointment.create({
      data: {
        leadId: body.leadId,
        campusId: body.campusId,
        scheduledFor,
        notes: notes || null,
      },
    });

    return Response.json(appointment, { status: 201 });
  } catch (error) {
    if (isLeadUniqueCollision(error)) {
      return Response.json({ error: "Este lead ya tiene una cita de ubicación agendada" }, { status: 409 });
    }
    throw error;
  }
}
