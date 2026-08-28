import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";

const SCORE_FIELDS = ["notaListening", "notaSpeaking", "notaReading", "notaWriting", "notaGrammar"] as const;

function isValidScore(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100;
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }
  const role = (session.user as { role: Role }).role;
  if (role !== "TEACHER") {
    return Response.json({ error: "No autorizado" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Cuerpo de la solicitud inválido" }, { status: 400 });
  }

  if (
    !body.enrollmentId ||
    typeof body.enrollmentId !== "string" ||
    !Number.isInteger(body.bloqueNumero) ||
    (body.bloqueNumero as number) < 1
  ) {
    return Response.json({ error: "Datos inválidos" }, { status: 400 });
  }

  for (const field of SCORE_FIELDS) {
    if (!isValidScore(body[field])) {
      return Response.json({ error: "Las calificaciones deben estar entre 0 y 100" }, { status: 400 });
    }
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

  const scores = SCORE_FIELDS.map((f) => body[f] as number);
  const promedioBloque = Math.round((scores.reduce((sum, s) => sum + s, 0) / 5) * 100) / 100;

  try {
    const evaluation = await prisma.blockEvaluation.create({
      data: {
        enrollmentId: body.enrollmentId,
        bloqueNumero: body.bloqueNumero as number,
        notaListening: body.notaListening as number,
        notaSpeaking: body.notaSpeaking as number,
        notaReading: body.notaReading as number,
        notaWriting: body.notaWriting as number,
        notaGrammar: body.notaGrammar as number,
        promedioBloque,
        createdById: (session.user as { id: string }).id,
      },
    });
    return Response.json(evaluation, { status: 201 });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      return Response.json(
        { error: "Ya existe una evaluación para este bloque en esta inscripción" },
        { status: 400 }
      );
    }
    console.error("Error al guardar la evaluación por bloque:", error);
    return Response.json({ error: "No se pudo guardar la evaluación" }, { status: 500 });
  }
}
