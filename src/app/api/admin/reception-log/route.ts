import { auth } from "@/lib/auth";
import { assertCampusInScope, getCampusScope } from "@/lib/campus-scope";
import { prisma } from "@/lib/prisma";
import type { ReceptionLogType, Role } from "@prisma/client";

const VALID_TYPES: ReceptionLogType[] = ["LLAMADA", "INCIDENCIA", "NOTA"];
const MAX_NOTE_LENGTH = 2000;

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

  const entries = await prisma.receptionLogEntry.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { createdBy: { select: { id: true, name: true } } },
  });
  return Response.json(entries);
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

  let body: { campusId?: string; type?: string; note?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Cuerpo de la solicitud inválido" }, { status: 400 });
  }

  const note = body.note?.trim();
  if (!body.campusId || !body.type || !VALID_TYPES.includes(body.type as ReceptionLogType) || !note || note.length > MAX_NOTE_LENGTH) {
    return Response.json({ error: "Datos inválidos" }, { status: 400 });
  }

  if (role === "STAFF") {
    const inScope = await assertCampusInScope(session.user as { id: string; role: Role }, body.campusId);
    if (!inScope) {
      return Response.json({ error: "No autorizado" }, { status: 403 });
    }
  }

  const entry = await prisma.receptionLogEntry.create({
    data: {
      campusId: body.campusId,
      type: body.type as ReceptionLogType,
      note,
      createdById: (session.user as { id: string }).id,
    },
  });

  return Response.json(entry, { status: 201 });
}
