import { auth } from "@/lib/auth";
import { assertCampusInScope } from "@/lib/campus-scope";
import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";

const MAX_DESCRIPTION_LENGTH = 200;
const MAX_CENTS = 100_000_000;

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }
  const role = (session.user as { role: Role }).role;
  if (role !== "ADMIN" && role !== "STAFF") {
    return Response.json({ error: "No autorizado" }, { status: 403 });
  }

  let body: {
    studentId?: string;
    description?: string;
    baseCents?: number;
    scholarshipPercent?: number;
    earlyPaymentDiscountCents?: number;
    dueDate?: string;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Cuerpo de la solicitud inválido" }, { status: 400 });
  }

  const description = body.description?.trim();
  if (
    !body.studentId ||
    !description ||
    description.length > MAX_DESCRIPTION_LENGTH ||
    typeof body.baseCents !== "number" ||
    !Number.isInteger(body.baseCents) ||
    body.baseCents <= 0 ||
    body.baseCents > MAX_CENTS ||
    !body.dueDate
  ) {
    return Response.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const dueDate = new Date(body.dueDate);
  if (Number.isNaN(dueDate.getTime())) {
    return Response.json({ error: "Fecha de vencimiento inválida" }, { status: 400 });
  }

  const scholarshipPercent = body.scholarshipPercent ?? 0;
  if (!Number.isFinite(scholarshipPercent) || scholarshipPercent < 0 || scholarshipPercent > 100) {
    return Response.json({ error: "El porcentaje de beca debe estar entre 0 y 100" }, { status: 400 });
  }

  const earlyPaymentDiscountCents = body.earlyPaymentDiscountCents ?? 0;
  if (!Number.isInteger(earlyPaymentDiscountCents) || earlyPaymentDiscountCents < 0) {
    return Response.json({ error: "El descuento por pronto pago es inválido" }, { status: 400 });
  }

  const student = await prisma.student.findUnique({ where: { id: body.studentId } });
  if (!student) {
    return Response.json({ error: "Alumno no encontrado" }, { status: 404 });
  }

  if (role === "STAFF") {
    const inScope = await assertCampusInScope(session.user as { id: string; role: Role }, student.campusId);
    if (!inScope) {
      return Response.json({ error: "No autorizado" }, { status: 403 });
    }
  }

  const roundedScholarshipPercent = Math.round(scholarshipPercent * 100) / 100;
  const scholarshipCents = Math.round((body.baseCents * roundedScholarshipPercent) / 100);
  const amountCents = Math.max(0, body.baseCents - scholarshipCents - earlyPaymentDiscountCents);

  try {
    const invoice = await prisma.invoice.create({
      data: {
        studentId: body.studentId,
        description,
        baseCents: body.baseCents,
        scholarshipPercent: roundedScholarshipPercent,
        earlyPaymentDiscountCents,
        amountCents,
        dueDate,
        status: "PENDING",
      },
    });

    return Response.json(invoice, { status: 201 });
  } catch (error) {
    console.error("Error al crear la factura desde recepción:", error);
    return Response.json({ error: "Ocurrió un error al procesar la factura" }, { status: 500 });
  }
}
