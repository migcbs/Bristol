import { auth } from "@/lib/auth";
import { getCampusScope } from "@/lib/campus-scope";
import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";

const MAX_DESCRIPTION_LENGTH = 2000;

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }
  const role = (session.user as { role: string }).role;
  if (role !== "TEACHER" && role !== "STAFF" && role !== "ADMIN") {
    return Response.json({ error: "No autorizado" }, { status: 403 });
  }

  let body: { studentId?: string; groupId?: string; description?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Cuerpo de la solicitud inválido" }, { status: 400 });
  }

  if (!body.studentId || !body.description) {
    return Response.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const description = body.description.trim();
  if (!description) {
    return Response.json({ error: "Datos inválidos" }, { status: 400 });
  }
  if (description.length > MAX_DESCRIPTION_LENGTH) {
    return Response.json(
      { error: `La descripción no puede exceder ${MAX_DESCRIPTION_LENGTH} caracteres` },
      { status: 400 }
    );
  }

  const userId = (session.user as { id: string }).id;

  if (body.groupId) {
    const group = await prisma.group.findUnique({ where: { id: body.groupId } });
    if (!group) {
      return Response.json({ error: "Grupo no encontrado" }, { status: 404 });
    }
    if (group.teacherId !== userId) {
      return Response.json({ error: "No autorizado" }, { status: 403 });
    }

    const enrollment = await prisma.enrollment.findFirst({
      where: { studentId: body.studentId, groupId: body.groupId, completedAt: null },
    });
    if (!enrollment) {
      return Response.json(
        { error: "El alumno no tiene una inscripción activa en ese grupo" },
        { status: 400 }
      );
    }
  } else {
    const student = await prisma.student.findUnique({ where: { id: body.studentId } });
    if (!student) {
      return Response.json({ error: "No encontrado" }, { status: 404 });
    }

    const scope = await getCampusScope(session.user as { id: string; role: Role });
    const inScope =
      scope.type === "ALL" ||
      (scope.type === "CAMPUS_LIST" && scope.campusIds.includes(student.campusId));
    if (!inScope) {
      return Response.json({ error: "No encontrado" }, { status: 404 });
    }
  }

  const incident = await prisma.incident.create({
    data: {
      studentId: body.studentId,
      groupId: body.groupId ?? null,
      reportedById: userId,
      description,
    },
  });

  return Response.json(incident, { status: 201 });
}
