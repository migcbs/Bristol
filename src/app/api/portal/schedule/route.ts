import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getVisibleGroupIds } from "@/lib/academic-access";

interface SlotInput {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

function isValidSlot(slot: SlotInput): boolean {
  if (typeof slot.dayOfWeek !== "number" || slot.dayOfWeek < 0 || slot.dayOfWeek > 6) return false;
  if (typeof slot.startTime !== "string" || typeof slot.endTime !== "string") return false;
  return slot.startTime < slot.endTime;
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }
  const role = (session.user as { role: string }).role;
  if (role !== "TEACHER") {
    return Response.json({ error: "No autorizado" }, { status: 403 });
  }

  let body: { groupId?: string; slots?: SlotInput[] };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Cuerpo de la solicitud inválido" }, { status: 400 });
  }

  if (!body.groupId || !Array.isArray(body.slots)) {
    return Response.json({ error: "Datos inválidos" }, { status: 400 });
  }

  if (body.slots.some((s) => !isValidSlot(s))) {
    return Response.json({ error: "Uno o más bloques de horario son inválidos" }, { status: 400 });
  }

  const group = await prisma.group.findUnique({ where: { id: body.groupId } });
  if (!group) {
    return Response.json({ error: "Grupo no encontrado" }, { status: 404 });
  }
  if (group.teacherId !== (session.user as { id: string }).id) {
    return Response.json({ error: "No autorizado" }, { status: 403 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.scheduleSlot.deleteMany({ where: { groupId: body.groupId } });
    if (body.slots!.length > 0) {
      await tx.scheduleSlot.createMany({
        data: body.slots!.map((s) => ({
          groupId: body.groupId!,
          dayOfWeek: s.dayOfWeek,
          startTime: s.startTime,
          endTime: s.endTime,
        })),
      });
    }
  });

  return Response.json({ ok: true }, { status: 201 });
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const groupId = searchParams.get("groupId");

  const visibleGroupIds = await getVisibleGroupIds(session.user as { id: string; role: any });

  if (groupId) {
    if (!visibleGroupIds.includes(groupId)) {
      return Response.json({ error: "No encontrado" }, { status: 404 });
    }
    const slots = await prisma.scheduleSlot.findMany({
      where: { groupId },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    });
    return Response.json(slots);
  }

  const slots = await prisma.scheduleSlot.findMany({
    where: { groupId: { in: visibleGroupIds } },
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
  });
  return Response.json(slots);
}
