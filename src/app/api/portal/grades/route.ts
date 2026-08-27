import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const MAX_TITLE_LENGTH = 200;

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }
  const role = (session.user as { role: string }).role;
  if (role !== "TEACHER") {
    return Response.json({ error: "No autorizado" }, { status: 403 });
  }

  let body: { enrollmentId?: string; title?: string; score?: number; maxScore?: number };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Cuerpo de la solicitud inválido" }, { status: 400 });
  }

  if (
    !body.enrollmentId ||
    typeof body.title !== "string" ||
    typeof body.score !== "number" ||
    !Number.isFinite(body.score)
  ) {
    return Response.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const title = body.title.trim();
  if (!title || title.length > MAX_TITLE_LENGTH) {
    return Response.json({ error: "Título inválido" }, { status: 400 });
  }

  const maxScore = body.maxScore ?? 100;
  if (!Number.isFinite(maxScore) || maxScore <= 0) {
    return Response.json({ error: "maxScore debe ser mayor que cero" }, { status: 400 });
  }
  if (body.score < 0 || body.score > maxScore) {
    return Response.json({ error: "La calificación está fuera de rango" }, { status: 400 });
  }

  const enrollment = await prisma.enrollment.findUnique({
    where: { id: body.enrollmentId },
    include: { group: true },
  });
  if (!enrollment) {
    return Response.json({ error: "Inscripción no encontrada" }, { status: 404 });
  }
  if (enrollment.group.teacherId !== (session.user as { id: string }).id) {
    return Response.json({ error: "No autorizado" }, { status: 403 });
  }
  if (enrollment.completedAt !== null) {
    return Response.json({ error: "La inscripción ya no está activa" }, { status: 400 });
  }

  const grade = await prisma.grade.create({
    data: {
      enrollmentId: body.enrollmentId,
      title,
      score: body.score,
      maxScore,
      createdById: (session.user as { id: string }).id,
    },
  });

  return Response.json(grade, { status: 201 });
}
