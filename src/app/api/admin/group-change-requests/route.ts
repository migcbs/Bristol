import { auth } from "@/lib/auth";
import { assertCampusInScope, getCampusScope } from "@/lib/campus-scope";
import { hasModuleAccess } from "@/lib/staff-permissions";
import { prisma } from "@/lib/prisma";
import type { GroupChangeRequestType, Role } from "@prisma/client";

const MAX_REASON_LENGTH = 500;

// Who can REQUEST a group change (BAJA or CAMBIO_GRUPO) — confirmed with
// the user 2026-09-09: a TEACHER or Recepción can ask for one, Control
// Escolar/Calidad y Control/Dirección de Campus approve it (see
// reviewGroupChangeRequest in ./[id]/route.ts, unchanged). Previously
// nothing in the UI ever called this endpoint at all, and it had no
// module check for STAFF beyond the bare role — any puesto (even Caja or
// Comercial, who have no business here) could create one. Both gaps
// fixed here alongside actually wiring up the create flow.
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }
  const actor = session.user as { id: string; role: Role };
  const role = actor.role;
  if (role !== "ADMIN" && role !== "STAFF" && role !== "TEACHER") {
    return Response.json({ error: "No autorizado" }, { status: 403 });
  }
  if (role === "STAFF") {
    const access = await hasModuleAccess(actor, "solicitudes");
    if (access === "none") {
      return Response.json({ error: "No autorizado" }, { status: 403 });
    }
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
    include: { student: true, group: true },
  });
  if (!enrollment) {
    return Response.json(
      { error: "El alumno no tiene una inscripción activa en ese grupo" },
      { status: 404 }
    );
  }

  if (role === "STAFF") {
    const inScope = await assertCampusInScope(actor, enrollment.student.campusId);
    if (!inScope) {
      return Response.json({ error: "No autorizado" }, { status: 403 });
    }
  }
  // A teacher can only request a change for a student in a group THEY
  // teach — not just "same campus" (that would let a teacher meddle with
  // another teacher's group).
  if (role === "TEACHER" && enrollment.group.teacherId !== actor.id) {
    return Response.json({ error: "No autorizado" }, { status: 403 });
  }

  if (body.type === "CAMBIO_GRUPO") {
    const requestedGroup = await prisma.group.findUnique({ where: { id: body.requestedGroupId! } });
    if (!requestedGroup) {
      return Response.json({ error: "Grupo destino inválido" }, { status: 400 });
    }
    if (requestedGroup.campusId !== enrollment.student.campusId) {
      return Response.json({ error: "El grupo destino debe ser del mismo plantel" }, { status: 400 });
    }
    if (requestedGroup.id === body.currentGroupId) {
      return Response.json(
        { error: "El grupo destino debe ser diferente al grupo actual" },
        { status: 400 }
      );
    }
  }

  try {
    const changeRequest = await prisma.groupChangeRequest.create({
      data: {
        type: body.type as GroupChangeRequestType,
        studentId: body.studentId,
        currentGroupId: body.currentGroupId,
        requestedGroupId: body.type === "CAMBIO_GRUPO" ? body.requestedGroupId! : null,
        reason,
        requestedById: actor.id,
      },
    });

    return Response.json(changeRequest, { status: 201 });
  } catch (error) {
    console.error("Error al crear la solicitud de cambio de grupo:", error);
    return Response.json({ error: "Ocurrió un error al procesar la solicitud" }, { status: 500 });
  }
}

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
    scope.type === "ALL"
      ? {}
      : scope.type === "CAMPUS_LIST"
        ? { student: { campusId: { in: scope.campusIds } } }
        : { id: { in: [] } };

  const requests = await prisma.groupChangeRequest.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { student: { include: { user: { select: { id: true, name: true } } } }, currentGroup: true, requestedGroup: true },
  });

  return Response.json(requests);
}
