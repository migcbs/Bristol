import { auth } from "@/lib/auth";
import { assertCampusInScope } from "@/lib/campus-scope";
import { hasModuleAccess } from "@/lib/staff-permissions";
import { prisma } from "@/lib/prisma";
import type { IncidentStatus, Role } from "@prisma/client";

const MAX_RESOLUCION_LENGTH = 300;
const UPDATABLE_STATUSES: IncidentStatus[] = ["EN_SEGUIMIENTO", "RESUELTA"];

// Advances an incident through its lifecycle. Only Calidad y Control
// ("full" access) can change status; RESUELTA requires a resolución note
// and stamps who resolved it and when.
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }
  const actor = session.user as { id: string; role: Role };
  if (actor.role !== "ADMIN" && actor.role !== "STAFF") {
    return Response.json({ error: "No autorizado" }, { status: 403 });
  }

  const access = await hasModuleAccess(actor, "incidencias");
  if (access !== "full") {
    return Response.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id } = await context.params;

  let body: { status?: string; resolucion?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Cuerpo de la solicitud inválido" }, { status: 400 });
  }

  if (!body.status || !UPDATABLE_STATUSES.includes(body.status as IncidentStatus)) {
    return Response.json({ error: "Estado inválido" }, { status: 400 });
  }
  const status = body.status as IncidentStatus;
  const resolucion = body.resolucion?.trim() || null;
  if (resolucion && resolucion.length > MAX_RESOLUCION_LENGTH) {
    return Response.json({ error: "La resolución es demasiado larga" }, { status: 400 });
  }
  if (status === "RESUELTA" && !resolucion) {
    return Response.json({ error: "Describe la resolución para cerrar la incidencia" }, { status: 400 });
  }

  const incident = await prisma.incident.findUnique({
    where: { id },
    include: { student: { select: { campusId: true } } },
  });
  if (!incident) {
    return Response.json({ error: "No encontrada" }, { status: 404 });
  }
  if (actor.role === "STAFF") {
    const inScope = await assertCampusInScope(actor, incident.student.campusId);
    if (!inScope) {
      return Response.json({ error: "No autorizado" }, { status: 403 });
    }
  }

  const updated = await prisma.incident.update({
    where: { id },
    data: {
      status,
      ...(status === "RESUELTA" && { resolucion, resolvedById: actor.id, resolvedAt: new Date() }),
    },
  });

  return Response.json(updated);
}
