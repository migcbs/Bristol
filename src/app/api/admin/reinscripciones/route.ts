import { auth } from "@/lib/auth";
import { getCampusScope } from "@/lib/campus-scope";
import { hasModuleAccess } from "@/lib/staff-permissions";
import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }
  const role = (session.user as { role: string }).role;
  if (role !== "ADMIN" && role !== "STAFF") {
    return Response.json({ error: "No autorizado" }, { status: 403 });
  }

  const access = await hasModuleAccess(session.user as { id: string; role: Role }, "reinscripciones");
  if (access !== "full") {
    return Response.json({ error: "No autorizado" }, { status: 403 });
  }

  let body: { enrollmentId?: string; newGroupId?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Cuerpo de la solicitud inválido" }, { status: 400 });
  }

  if (!body.enrollmentId || !body.newGroupId) {
    return Response.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const enrollment = await prisma.enrollment.findUnique({
    where: { id: body.enrollmentId },
    include: { student: true },
  });
  if (!enrollment) {
    return Response.json({ error: "No encontrado" }, { status: 404 });
  }

  const scope = await getCampusScope(session.user as { id: string; role: Role });
  const inScope =
    scope.type === "ALL" ||
    (scope.type === "CAMPUS_LIST" && scope.campusIds.includes(enrollment.student.campusId));
  if (!inScope) {
    return Response.json({ error: "No encontrado" }, { status: 404 });
  }

  if (enrollment.completedAt !== null) {
    return Response.json({ error: "Esta inscripción ya fue completada" }, { status: 400 });
  }

  const newGroup = await prisma.group.findUnique({ where: { id: body.newGroupId } });
  if (!newGroup) {
    return Response.json({ error: "Grupo destino inválido" }, { status: 400 });
  }
  if (newGroup.campusId !== enrollment.student.campusId) {
    return Response.json({ error: "El grupo destino debe ser del mismo plantel" }, { status: 400 });
  }

  let newEnrollment;
  try {
    newEnrollment = await prisma.$transaction(async (tx) => {
      const closed = await tx.enrollment.updateMany({
        where: { id: enrollment.id, completedAt: null },
        data: { completedAt: new Date() },
      });
      if (closed.count !== 1) {
        throw Object.assign(new Error("Enrollment already completed"), {
          code: "ALREADY_COMPLETED",
        });
      }
      return tx.enrollment.create({
        data: { studentId: enrollment.studentId, groupId: newGroup.id },
      });
    });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ALREADY_COMPLETED") {
      return Response.json({ error: "Esta inscripción ya fue completada" }, { status: 400 });
    }
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      return Response.json(
        { error: "El alumno ya tiene una inscripción activa" },
        { status: 400 },
      );
    }
    console.error("Reinscripción falló:", error);
    return Response.json({ error: "Ocurrió un error al procesar la reinscripción" }, { status: 500 });
  }

  return Response.json(newEnrollment);
}
