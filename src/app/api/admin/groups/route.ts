import { auth } from "@/lib/auth";
import { assertCampusInScope, getCampusScope } from "@/lib/campus-scope";
import { hasModuleAccess } from "@/lib/staff-permissions";
import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";

const MAX_NAME_LENGTH = 120;

// Group management — creation and teacher/student assignment, gated by the
// "grupos" module (confirmed with the user 2026-09-09: Dirección de Campus
// creates groups, Recepción only adds students to an existing one via
// /api/admin/groups/[id]/enroll). Distinct from the read-only cupo view at
// /api/admin/groups/availability, which several áreas already had before
// this module existed and which this route leaves untouched.
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }
  const actor = session.user as { id: string; role: Role };
  if (actor.role !== "ADMIN" && actor.role !== "STAFF") {
    return Response.json({ error: "No autorizado" }, { status: 403 });
  }
  const access = await hasModuleAccess(actor, "grupos");
  if (access === "none") {
    return Response.json({ error: "No autorizado" }, { status: 403 });
  }

  const scope = await getCampusScope(actor);
  const where =
    scope.type === "ALL" ? {} : scope.type === "CAMPUS_LIST" ? { campusId: { in: scope.campusIds } } : { id: { in: [] } };

  const groups = await prisma.group.findMany({
    where,
    include: {
      campus: true,
      level: true,
      curso: true,
      teacher: { select: { id: true, name: true } },
      scheduleSlots: true,
      _count: { select: { enrollments: { where: { completedAt: null } } } },
    },
    orderBy: { name: "asc" },
  });

  return Response.json({ groups, canManage: access === "full" });
}

export async function POST(request: Request) {
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

  let body: {
    name?: string;
    campusId?: string;
    levelId?: string;
    cursoId?: string | null;
    teacherId?: string;
    cupoMaximo?: number;
    fechaInicio?: string | null;
    fechaFin?: string | null;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Cuerpo de la solicitud inválido" }, { status: 400 });
  }

  const name = body.name?.trim();
  if (!name || name.length > MAX_NAME_LENGTH || !body.campusId || !body.levelId || !body.teacherId) {
    return Response.json({ error: "Datos inválidos" }, { status: 400 });
  }
  const cupoMaximo = body.cupoMaximo ?? 20;
  if (!Number.isInteger(cupoMaximo) || cupoMaximo < 1 || cupoMaximo > 200) {
    return Response.json({ error: "Cupo máximo inválido" }, { status: 400 });
  }

  if (actor.role === "STAFF") {
    const inScope = await assertCampusInScope(actor, body.campusId);
    if (!inScope) {
      return Response.json({ error: "No autorizado" }, { status: 403 });
    }
  }

  const [campus, level, teacher] = await Promise.all([
    prisma.campus.findUnique({ where: { id: body.campusId } }),
    prisma.level.findUnique({ where: { id: body.levelId } }),
    prisma.user.findUnique({ where: { id: body.teacherId }, select: { id: true, role: true } }),
  ]);
  if (!campus || !level) {
    return Response.json({ error: "Plantel o nivel inválido" }, { status: 400 });
  }
  if (!teacher || teacher.role !== "TEACHER") {
    return Response.json({ error: "El maestro asignado no es válido" }, { status: 400 });
  }
  if (body.cursoId) {
    const curso = await prisma.curso.findUnique({ where: { id: body.cursoId } });
    if (!curso) {
      return Response.json({ error: "Curso inválido" }, { status: 400 });
    }
  }

  try {
    const group = await prisma.group.create({
      data: {
        name,
        campusId: body.campusId,
        levelId: body.levelId,
        cursoId: body.cursoId || null,
        teacherId: body.teacherId,
        cupoMaximo,
        fechaInicio: body.fechaInicio ? new Date(body.fechaInicio) : null,
        fechaFin: body.fechaFin ? new Date(body.fechaFin) : null,
      },
      include: { campus: true, level: true, curso: true, teacher: { select: { id: true, name: true } } },
    });
    return Response.json(group, { status: 201 });
  } catch (error) {
    console.error("Error al crear el grupo:", error);
    return Response.json({ error: "Ocurrió un error al crear el grupo" }, { status: 500 });
  }
}
