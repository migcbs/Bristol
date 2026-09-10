import { auth } from "@/lib/auth";
import { assertCampusInScope } from "@/lib/campus-scope";
import { canWriteArea, getCalendarAccess } from "@/lib/staff-calendar";
import { prisma } from "@/lib/prisma";
import type { Role, StaffPosition } from "@prisma/client";

const MAX_TITLE = 160;
const MAX_DESC = 2000;

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }
  const user = session.user as { id: string; role: Role };
  const access = await getCalendarAccess(user);
  if (access.areas.length === 0) {
    return Response.json({ error: "No autorizado" }, { status: 403 });
  }

  const url = new URL(request.url);
  const areaParam = url.searchParams.get("area") as StaffPosition | null;
  const areas = areaParam && access.areas.includes(areaParam) ? [areaParam] : access.areas;

  const events = await prisma.staffCalendarEvent.findMany({
    where: { area: { in: areas } },
    orderBy: { startsAt: "asc" },
    include: { campus: { select: { name: true } }, createdBy: { select: { name: true } } },
  });

  return Response.json(events);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }
  const user = session.user as { id: string; role: Role };
  const access = await getCalendarAccess(user);
  if (access.areas.length === 0) {
    return Response.json({ error: "No autorizado" }, { status: 403 });
  }

  let body: {
    area?: string;
    campusId?: string | null;
    title?: string;
    description?: string;
    startsAt?: string;
    endsAt?: string | null;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Cuerpo de la solicitud inválido" }, { status: 400 });
  }

  const area = body.area as StaffPosition | undefined;
  if (!area || !access.areas.includes(area)) {
    return Response.json({ error: "Área inválida" }, { status: 400 });
  }
  if (!canWriteArea(access, area)) {
    return Response.json({ error: "Solo puedes agendar en tu propia área" }, { status: 403 });
  }

  const title = body.title?.trim();
  if (!title || title.length > MAX_TITLE) {
    return Response.json({ error: "Título inválido" }, { status: 400 });
  }
  const description = body.description?.trim() || null;
  if (description && description.length > MAX_DESC) {
    return Response.json({ error: "Descripción demasiado larga" }, { status: 400 });
  }

  const startsAt = body.startsAt ? new Date(body.startsAt) : null;
  if (!startsAt || Number.isNaN(startsAt.getTime())) {
    return Response.json({ error: "Fecha inválida" }, { status: 400 });
  }
  const endsAt = body.endsAt ? new Date(body.endsAt) : null;
  if (endsAt && (Number.isNaN(endsAt.getTime()) || endsAt < startsAt)) {
    return Response.json({ error: "La hora de fin no puede ser antes del inicio" }, { status: 400 });
  }

  if (body.campusId) {
    const inScope = await assertCampusInScope(user, body.campusId);
    if (!inScope) {
      return Response.json({ error: "Plantel fuera de tu alcance" }, { status: 403 });
    }
  }

  const event = await prisma.staffCalendarEvent.create({
    data: {
      area,
      campusId: body.campusId || null,
      title,
      description,
      startsAt,
      endsAt,
      createdById: user.id,
    },
  });

  return Response.json(event, { status: 201 });
}
