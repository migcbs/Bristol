import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { AttendanceStatus } from "@prisma/client";

const VALID_STATUSES: AttendanceStatus[] = ["PRESENT", "ABSENT", "LATE", "EXCUSED"];

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }
  const role = (session.user as { role: string }).role;
  if (role !== "TEACHER") {
    return Response.json({ error: "No autorizado" }, { status: 403 });
  }

  let body: {
    groupId?: string;
    date?: string;
    records?: { enrollmentId: string; status: string }[];
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Cuerpo de la solicitud inválido" }, { status: 400 });
  }

  if (!body.groupId || !body.date || !Array.isArray(body.records) || body.records.length === 0) {
    return Response.json({ error: "Datos inválidos" }, { status: 400 });
  }

  if (body.records.some((r) => !VALID_STATUSES.includes(r.status as AttendanceStatus))) {
    return Response.json({ error: "Estatus de asistencia inválido" }, { status: 400 });
  }

  const group = await prisma.group.findUnique({ where: { id: body.groupId } });
  if (!group) {
    return Response.json({ error: "Grupo no encontrado" }, { status: 404 });
  }
  if (group.teacherId !== (session.user as { id: string }).id) {
    return Response.json({ error: "No autorizado" }, { status: 403 });
  }

  const activeEnrollments = await prisma.enrollment.findMany({
    where: {
      groupId: body.groupId,
      completedAt: null,
      id: { in: body.records.map((r) => r.enrollmentId) },
    },
  });
  if (activeEnrollments.length !== body.records.length) {
    return Response.json(
      { error: "Uno o más alumnos no tienen una inscripción activa en este grupo" },
      { status: 400 }
    );
  }

  const date = new Date(body.date);

  try {
    await prisma.attendanceRecord.createMany({
      data: body.records.map((r) => ({
        enrollmentId: r.enrollmentId,
        date,
        status: r.status as AttendanceStatus,
      })),
    });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      return Response.json(
        { error: "Ya existe asistencia registrada para esta fecha" },
        { status: 400 }
      );
    }
    console.error("Error al guardar asistencia:", error);
    return Response.json({ error: "No se pudo guardar la asistencia" }, { status: 500 });
  }

  return Response.json({ ok: true }, { status: 201 });
}
