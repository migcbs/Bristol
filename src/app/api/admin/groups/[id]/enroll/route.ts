import { auth } from "@/lib/auth";
import { assertCampusInScope } from "@/lib/campus-scope";
import { notify } from "@/lib/notifications";
import { hasModuleAccess } from "@/lib/staff-permissions";
import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";

// Adds a student to this group. If the student already has a different
// active enrollment (e.g. a Saturday/"sabatino" group), it is closed
// (completedAt set) in the same transaction and the new one opened — this
// is a direct move, not the GroupChangeRequest request/approval workflow
// (that one is for a student/teacher-initiated request that needs review;
// this is Recepción/Dirección directly placing a student, per the user's
// 2026-09-09 instruction).
//
// Nothing is ever deleted: Grade/BlockEvaluation/AttendanceRecord all key
// off enrollmentId, and closing an enrollment only sets completedAt, so a
// student's full academic history survives a group move intact — confirmed
// via src/lib/academic-access.ts, whose getVisibleEnrollmentIds for
// STUDENT/PARENT returns every enrollment (past and present), not just the
// active one.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }
  const actor = session.user as { id: string; role: Role };
  if (actor.role !== "ADMIN" && actor.role !== "STAFF") {
    return Response.json({ error: "No autorizado" }, { status: 403 });
  }
  const access = await hasModuleAccess(actor, "grupos");
  if (access !== "full" && access !== "initiate") {
    return Response.json({ error: "No autorizado" }, { status: 403 });
  }

  let body: { studentId?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Cuerpo de la solicitud inválido" }, { status: 400 });
  }
  if (!body.studentId) {
    return Response.json({ error: "Falta el alumno" }, { status: 400 });
  }

  const { id: groupId } = await params;
  const [group, student] = await Promise.all([
    prisma.group.findUnique({
      where: { id: groupId },
      include: { _count: { select: { enrollments: { where: { completedAt: null } } } } },
    }),
    prisma.student.findUnique({
      where: { id: body.studentId },
      include: { enrollments: { where: { completedAt: null }, take: 1 } },
    }),
  ]);
  if (!group) {
    return Response.json({ error: "Grupo no encontrado" }, { status: 404 });
  }
  if (!student) {
    return Response.json({ error: "Alumno no encontrado" }, { status: 404 });
  }
  if (actor.role === "STAFF") {
    const [groupInScope, studentInScope] = await Promise.all([
      assertCampusInScope(actor, group.campusId),
      assertCampusInScope(actor, student.campusId),
    ]);
    if (!groupInScope || !studentInScope) {
      return Response.json({ error: "No autorizado" }, { status: 403 });
    }
  }

  const currentEnrollment = student.enrollments[0];
  if (currentEnrollment?.groupId === groupId) {
    return Response.json({ error: "El alumno ya está inscrito en este grupo" }, { status: 400 });
  }
  if (group._count.enrollments >= group.cupoMaximo) {
    return Response.json({ error: "El grupo ya no tiene cupo disponible" }, { status: 400 });
  }

  try {
    const enrollment = await prisma.$transaction(async (tx) => {
      if (currentEnrollment) {
        await tx.enrollment.update({
          where: { id: currentEnrollment.id },
          data: { completedAt: new Date() },
        });
      }
      return tx.enrollment.create({
        data: { studentId: student.id, groupId },
        include: { group: { include: { level: true } } },
      });
    });

    if (currentEnrollment) {
      await notify(
        student.userId,
        "Fuiste cambiado a un nuevo grupo. Tu historial académico se conserva.",
        "/portal/calificaciones"
      );
    }

    return Response.json(enrollment, { status: 201 });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      return Response.json({ error: "El alumno ya tiene una inscripción activa" }, { status: 400 });
    }
    console.error("Error al inscribir al alumno en el grupo:", error);
    return Response.json({ error: "Ocurrió un error al inscribir al alumno" }, { status: 500 });
  }
}
