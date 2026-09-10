import { auth } from "@/lib/auth";
import { assertCampusInScope } from "@/lib/campus-scope";
import { canWriteArea, getCalendarAccess } from "@/lib/staff-calendar";
import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";

const MAX_TITLE = 160;
const MAX_DESC = 2000;

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }
  const user = session.user as { id: string; role: Role };
  const access = await getCalendarAccess(user);

  const { id } = await context.params;
  const event = await prisma.staffCalendarEvent.findUnique({ where: { id } });
  if (!event || !access.areas.includes(event.area)) {
    return Response.json({ error: "No encontrado" }, { status: 404 });
  }
  if (!canWriteArea(access, event.area)) {
    return Response.json({ error: "Solo puedes editar eventos de tu propia área" }, { status: 403 });
  }

  let body: { title?: string; description?: string | null; startsAt?: string; endsAt?: string | null; campusId?: string | null };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Cuerpo de la solicitud inválido" }, { status: 400 });
  }

  const data: Record<string, unknown> = {};

  if (body.title !== undefined) {
    const title = body.title.trim();
    if (!title || title.length > MAX_TITLE) {
      return Response.json({ error: "Título inválido" }, { status: 400 });
    }
    data.title = title;
  }
  if (body.description !== undefined) {
    const description = body.description?.trim() || null;
    if (description && description.length > MAX_DESC) {
      return Response.json({ error: "Descripción demasiado larga" }, { status: 400 });
    }
    data.description = description;
  }

  const nextStart = body.startsAt !== undefined ? new Date(body.startsAt) : event.startsAt;
  if (body.startsAt !== undefined) {
    if (Number.isNaN(nextStart.getTime())) {
      return Response.json({ error: "Fecha inválida" }, { status: 400 });
    }
    data.startsAt = nextStart;
  }
  if (body.endsAt !== undefined) {
    const endsAt = body.endsAt ? new Date(body.endsAt) : null;
    if (endsAt && (Number.isNaN(endsAt.getTime()) || endsAt < nextStart)) {
      return Response.json({ error: "La hora de fin no puede ser antes del inicio" }, { status: 400 });
    }
    data.endsAt = endsAt;
  }
  if (body.campusId !== undefined) {
    if (body.campusId) {
      const inScope = await assertCampusInScope(user, body.campusId);
      if (!inScope) {
        return Response.json({ error: "Plantel fuera de tu alcance" }, { status: 403 });
      }
    }
    data.campusId = body.campusId || null;
  }

  const updated = await prisma.staffCalendarEvent.update({ where: { id }, data });
  return Response.json(updated);
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }
  const user = session.user as { id: string; role: Role };
  const access = await getCalendarAccess(user);

  const { id } = await context.params;
  const event = await prisma.staffCalendarEvent.findUnique({ where: { id } });
  if (!event || !access.areas.includes(event.area)) {
    return Response.json({ error: "No encontrado" }, { status: 404 });
  }
  if (!canWriteArea(access, event.area)) {
    return Response.json({ error: "Solo puedes eliminar eventos de tu propia área" }, { status: 403 });
  }

  await prisma.staffCalendarEvent.delete({ where: { id } });
  return Response.json({ ok: true });
}
