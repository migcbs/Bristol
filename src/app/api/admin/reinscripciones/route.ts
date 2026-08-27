import { auth } from "@/lib/auth";
import { getCampusScope } from "@/lib/campus-scope";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }
  const role = (session.user as { role: string }).role;
  if (role !== "ADMIN" && role !== "STAFF") {
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

  const scope = await getCampusScope(session.user as { id: string; role: any });
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

  const newEnrollment = await prisma.$transaction(async (tx) => {
    await tx.enrollment.update({
      where: { id: enrollment.id },
      data: { completedAt: new Date() },
    });
    return tx.enrollment.create({
      data: { studentId: enrollment.studentId, groupId: newGroup.id },
    });
  });

  return Response.json(newEnrollment);
}
