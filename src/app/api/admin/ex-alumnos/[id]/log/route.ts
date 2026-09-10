import { auth } from "@/lib/auth";
import { getCampusScope } from "@/lib/campus-scope";
import { hasModuleAccess } from "@/lib/staff-permissions";
import { prisma } from "@/lib/prisma";
import type { AlumniOutreachType, Role } from "@prisma/client";

const VALID_TYPES: AlumniOutreachType[] = ["LLAMADA", "MENSAJE", "VISITA", "OTRO"];

// Registers one outreach note and, in the same request, optionally updates
// the student's interesadoEnVolver flag — the two travel together in the
// popup form so Comercial doesn't need a second action for the common case
// of "I called them and here's whether they're interested".
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }
  const role = (session.user as { role: Role }).role;
  if (role !== "ADMIN" && role !== "STAFF") {
    return Response.json({ error: "No autorizado" }, { status: 403 });
  }

  const access = await hasModuleAccess(session.user as { id: string; role: Role }, "comercial_directorio");
  if (access !== "full") {
    return Response.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id: studentId } = await context.params;
  const student = await prisma.student.findUnique({ where: { id: studentId } });
  if (!student) {
    return Response.json({ error: "No encontrado" }, { status: 404 });
  }

  const scope = await getCampusScope(session.user as { id: string; role: Role });
  const inScope = scope.type === "ALL" || (scope.type === "CAMPUS_LIST" && scope.campusIds.includes(student.campusId));
  if (!inScope) {
    return Response.json({ error: "No encontrado" }, { status: 404 });
  }

  let body: { type?: string; note?: string; interesadoEnVolver?: boolean | null };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Cuerpo de la solicitud inválido" }, { status: 400 });
  }

  const note = body.note?.trim();
  if (!body.type || !VALID_TYPES.includes(body.type as AlumniOutreachType) || !note || note.length > 2000) {
    return Response.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const [log] = await prisma.$transaction([
    prisma.alumniOutreachLog.create({
      data: {
        studentId,
        createdById: (session.user as { id: string }).id,
        type: body.type as AlumniOutreachType,
        note,
      },
    }),
    ...(body.interesadoEnVolver !== undefined
      ? [prisma.student.update({ where: { id: studentId }, data: { interesadoEnVolver: body.interesadoEnVolver } })]
      : []),
  ]);

  return Response.json(log, { status: 201 });
}
