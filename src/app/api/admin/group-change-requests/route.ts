import { auth } from "@/lib/auth";
import { assertCampusInScope } from "@/lib/campus-scope";
import { prisma } from "@/lib/prisma";
import type { GroupChangeRequestType, Role } from "@prisma/client";

const MAX_REASON_LENGTH = 500;

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }
  const role = (session.user as { role: Role }).role;
  if (role !== "ADMIN" && role !== "STAFF") {
    return Response.json({ error: "No autorizado" }, { status: 403 });
  }

  let body: {
    type?: string;
    studentId?: string;
    currentGroupId?: string;
    requestedGroupId?: string;
    reason?: string;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Cuerpo de la solicitud inválido" }, { status: 400 });
  }

  const reason = body.reason?.trim();
  if (
    !body.type ||
    !["BAJA", "CAMBIO_GRUPO"].includes(body.type) ||
    !body.studentId ||
    !body.currentGroupId ||
    !reason ||
    reason.length > MAX_REASON_LENGTH
  ) {
    return Response.json({ error: "Datos inválidos" }, { status: 400 });
  }

  if (body.type === "CAMBIO_GRUPO" && !body.requestedGroupId) {
    return Response.json({ error: "Debes especificar el grupo destino" }, { status: 400 });
  }

  const enrollment = await prisma.enrollment.findFirst({
    where: { studentId: body.studentId, groupId: body.currentGroupId, completedAt: null },
    include: { student: true },
  });
  if (!enrollment) {
    return Response.json(
      { error: "El alumno no tiene una inscripción activa en ese grupo" },
      { status: 404 }
    );
  }

  if (role === "STAFF") {
    const inScope = await assertCampusInScope(
      session.user as { id: string; role: Role },
      enrollment.student.campusId
    );
    if (!inScope) {
      return Response.json({ error: "No autorizado" }, { status: 403 });
    }
  }

  const changeRequest = await prisma.groupChangeRequest.create({
    data: {
      type: body.type as GroupChangeRequestType,
      studentId: body.studentId,
      currentGroupId: body.currentGroupId,
      requestedGroupId: body.requestedGroupId ?? null,
      reason,
      requestedById: (session.user as { id: string }).id,
    },
  });

  return Response.json(changeRequest, { status: 201 });
}
