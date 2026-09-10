import { auth } from "@/lib/auth";
import { assertCampusInScope } from "@/lib/campus-scope";
import { prisma } from "@/lib/prisma";
import type { PlacementAppointmentStatus, Role } from "@prisma/client";

const MAX_RESULTADO_LENGTH = 200;
const UPDATABLE_STATUSES: PlacementAppointmentStatus[] = ["REALIZADA", "CANCELADA", "NO_ASISTIO"];

// Records what happened to a scheduled placement exam. Only the outcome
// statuses can be set here — a PROGRAMADA appointment is created via POST
// and never "un-completed". `resultado` is only kept for REALIZADA.
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }
  const role = (session.user as { role: Role }).role;
  if (role !== "ADMIN" && role !== "STAFF") {
    return Response.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id } = await context.params;

  let body: { status?: string; resultado?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Cuerpo de la solicitud inválido" }, { status: 400 });
  }

  if (!body.status || !UPDATABLE_STATUSES.includes(body.status as PlacementAppointmentStatus)) {
    return Response.json({ error: "Estado inválido" }, { status: 400 });
  }
  const status = body.status as PlacementAppointmentStatus;
  const resultado = body.resultado?.trim() || null;
  if (resultado && resultado.length > MAX_RESULTADO_LENGTH) {
    return Response.json({ error: "El resultado es demasiado largo" }, { status: 400 });
  }

  const appt = await prisma.placementAppointment.findUnique({ where: { id } });
  if (!appt) {
    return Response.json({ error: "No encontrado" }, { status: 404 });
  }
  if (role === "STAFF") {
    const inScope = await assertCampusInScope(session.user as { id: string; role: Role }, appt.campusId);
    if (!inScope) {
      return Response.json({ error: "No autorizado" }, { status: 403 });
    }
  }

  const updated = await prisma.placementAppointment.update({
    where: { id },
    data: { status, resultado: status === "REALIZADA" ? resultado : appt.resultado },
  });

  return Response.json(updated);
}
