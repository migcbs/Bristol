import { auth } from "@/lib/auth";
import { assertCampusInScope } from "@/lib/campus-scope";
import { notify } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }
  const role = (session.user as { role: Role }).role;
  if (role !== "ADMIN" && role !== "STAFF") {
    return Response.json({ error: "No autorizado" }, { status: 403 });
  }

  let body: { decision?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Cuerpo de la solicitud inválido" }, { status: 400 });
  }

  if (body.decision !== "APROBADA" && body.decision !== "RECHAZADA") {
    return Response.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const { id } = await params;
  return reviewGroupChangeRequest(session.user as { id: string; role: Role }, id, body.decision);
}

/**
 * Core approve/reject logic for a group change request, shared between the
 * PATCH route handler above and the Server Action on the solicitudes admin
 * page. Assumes the caller has already authenticated the session and
 * validated `decision` is "APROBADA" or "RECHAZADA".
 */
export async function reviewGroupChangeRequest(
  actor: { id: string; role: Role },
  id: string,
  decision: "APROBADA" | "RECHAZADA"
) {
  if (decision !== "APROBADA" && decision !== "RECHAZADA") {
    return Response.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const role = actor.role;
  const changeRequest = await prisma.groupChangeRequest.findUnique({
    where: { id },
    include: { student: true },
  });
  if (!changeRequest) {
    return Response.json({ error: "No encontrado" }, { status: 404 });
  }

  if (role === "STAFF") {
    const inScope = await assertCampusInScope(actor, changeRequest.student.campusId);
    if (!inScope) {
      return Response.json({ error: "No encontrado" }, { status: 404 });
    }
  }

  if (changeRequest.status !== "PENDIENTE") {
    return Response.json({ error: "Esta solicitud ya fue revisada" }, { status: 400 });
  }

  if (changeRequest.type === "CAMBIO_GRUPO" && !changeRequest.requestedGroupId) {
    return Response.json({ error: "Solicitud inválida: falta el grupo destino" }, { status: 400 });
  }

  const reviewerId = actor.id;

  if (decision === "RECHAZADA") {
    const updated = await prisma.groupChangeRequest.update({
      where: { id },
      data: { status: "RECHAZADA", reviewedById: reviewerId, reviewedAt: new Date() },
    });
    await notify(
      changeRequest.requestedById,
      "Tu solicitud de cambio de grupo fue rechazada",
      "/admin/control-escolar/solicitudes"
    );
    return Response.json(updated);
  }

  // APROBADA: close the current enrollment; for CAMBIO_GRUPO, also open the new one.
  // Reuses the exact race-safe transaction shape from src/app/api/admin/reinscripciones/route.ts.
  try {
    const result = await prisma.$transaction(async (tx) => {
      const closed = await tx.enrollment.updateMany({
        where: { studentId: changeRequest.studentId, groupId: changeRequest.currentGroupId, completedAt: null },
        data: { completedAt: new Date() },
      });
      if (closed.count !== 1) {
        throw Object.assign(new Error("Enrollment already completed"), { code: "ALREADY_COMPLETED" });
      }

      if (changeRequest.type === "CAMBIO_GRUPO") {
        await tx.enrollment.create({
          data: { studentId: changeRequest.studentId, groupId: changeRequest.requestedGroupId! },
        });
      }

      return tx.groupChangeRequest.update({
        where: { id },
        data: { status: "APROBADA", reviewedById: reviewerId, reviewedAt: new Date() },
      });
    });
    await notify(
      changeRequest.requestedById,
      "Tu solicitud de cambio de grupo fue aprobada",
      "/admin/control-escolar/solicitudes"
    );
    return Response.json(result);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ALREADY_COMPLETED") {
      return Response.json(
        { error: "La inscripción del alumno ya no está activa; no se puede aprobar" },
        { status: 400 }
      );
    }
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      return Response.json({ error: "El alumno ya tiene una inscripción activa" }, { status: 400 });
    }
    console.error("Error al aprobar la solicitud de cambio de grupo:", error);
    return Response.json({ error: "Ocurrió un error al procesar la solicitud" }, { status: 500 });
  }
}
