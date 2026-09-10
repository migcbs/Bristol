import { auth } from "@/lib/auth";
import { assertCampusInScope } from "@/lib/campus-scope";
import { hasModuleAccess } from "@/lib/staff-permissions";
import { prisma } from "@/lib/prisma";
import type { GroupStatus, Role } from "@prisma/client";

const GROUP_STATUSES: GroupStatus[] = ["ABIERTO", "EN_CURSO", "CONCLUIDO", "CANCELADO"];

// Editing a group — including reassigning its teacher — is "full"-only on
// "grupos" (Dirección de Campus). Recepción's "initiate" level can add
// students (see ./enroll) but never edit the group itself.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }
  const actor = session.user as { id: string; role: Role };
  if (actor.role !== "ADMIN" && actor.role !== "STAFF") {
    return Response.json({ error: "No autorizado" }, { status: 403 });
  }
  const access = await hasModuleAccess(actor, "grupos");
  if (access !== "full") {
    return Response.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id } = await params;
  const group = await prisma.group.findUnique({ where: { id } });
  if (!group) {
    return Response.json({ error: "No encontrado" }, { status: 404 });
  }
  if (actor.role === "STAFF") {
    const inScope = await assertCampusInScope(actor, group.campusId);
    if (!inScope) {
      return Response.json({ error: "No encontrado" }, { status: 404 });
    }
  }

  let body: {
    teacherId?: string;
    cupoMaximo?: number;
    fechaInicio?: string | null;
    fechaFin?: string | null;
    estatusGrupo?: string;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Cuerpo de la solicitud inválido" }, { status: 400 });
  }

  const data: Record<string, unknown> = {};

  if (body.teacherId !== undefined) {
    const teacher = await prisma.user.findUnique({ where: { id: body.teacherId }, select: { role: true } });
    if (!teacher || teacher.role !== "TEACHER") {
      return Response.json({ error: "El maestro asignado no es válido" }, { status: 400 });
    }
    data.teacherId = body.teacherId;
  }
  if (body.cupoMaximo !== undefined) {
    if (!Number.isInteger(body.cupoMaximo) || body.cupoMaximo < 1 || body.cupoMaximo > 200) {
      return Response.json({ error: "Cupo máximo inválido" }, { status: 400 });
    }
    data.cupoMaximo = body.cupoMaximo;
  }
  if (body.fechaInicio !== undefined) {
    data.fechaInicio = body.fechaInicio ? new Date(body.fechaInicio) : null;
  }
  if (body.fechaFin !== undefined) {
    data.fechaFin = body.fechaFin ? new Date(body.fechaFin) : null;
  }
  if (body.estatusGrupo !== undefined) {
    if (!GROUP_STATUSES.includes(body.estatusGrupo as GroupStatus)) {
      return Response.json({ error: "Estatus inválido" }, { status: 400 });
    }
    data.estatusGrupo = body.estatusGrupo;
  }

  if (Object.keys(data).length === 0) {
    return Response.json({ error: "Nada que actualizar" }, { status: 400 });
  }

  try {
    const updated = await prisma.group.update({
      where: { id },
      data,
      include: { campus: true, level: true, curso: true, teacher: { select: { id: true, name: true } } },
    });
    return Response.json(updated);
  } catch (error) {
    console.error("Error al actualizar el grupo:", error);
    return Response.json({ error: "Ocurrió un error al actualizar el grupo" }, { status: 500 });
  }
}
