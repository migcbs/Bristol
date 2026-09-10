import { auth } from "@/lib/auth";
import { getCampusScope } from "@/lib/campus-scope";
import { hasModuleAccess } from "@/lib/staff-permissions";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

function assertAdminOrStaff(role: string) {
  return role === "ADMIN" || role === "STAFF";
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }
  const role = (session.user as { role: string }).role;
  if (!assertAdminOrStaff(role)) {
    return Response.json({ error: "No autorizado" }, { status: 403 });
  }

  // Strictly "full" — only Caja creates charges now (Recepción's cobranzas
  // level was downgraded to "read" 2026-09-09; they consult status only).
  const access = await hasModuleAccess(session.user as { id: string; role: any }, "cobranzas");
  if (access !== "full") {
    return Response.json({ error: "No autorizado" }, { status: 403 });
  }

  let body: {
    studentId?: string;
    description?: string;
    amountCents?: number;
    dueDate?: string;
    conceptoPagoId?: string;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Cuerpo de la solicitud inválido" }, { status: 400 });
  }

  if (
    !body.studentId ||
    !body.description ||
    typeof body.amountCents !== "number" ||
    !Number.isSafeInteger(body.amountCents) ||
    body.amountCents <= 0 ||
    body.amountCents > 2147483647 ||
    !body.dueDate
  ) {
    return Response.json({ error: "Datos de cargo inválidos" }, { status: 400 });
  }

  if (body.conceptoPagoId) {
    const concepto = await prisma.conceptoPago.findUnique({ where: { id: body.conceptoPagoId } });
    if (!concepto || !concepto.activo) {
      return Response.json({ error: "Concepto de pago inválido" }, { status: 400 });
    }
  }

  const due = new Date(body.dueDate);
  if (Number.isNaN(due.getTime())) {
    return Response.json({ error: "Fecha de vencimiento inválida" }, { status: 400 });
  }

  const student = await prisma.student.findUnique({ where: { id: body.studentId } });
  if (!student) {
    return Response.json({ error: "No encontrado" }, { status: 404 });
  }

  const scope = await getCampusScope(session.user as { id: string; role: any });
  const inScope = scope.type === "ALL" || (scope.type === "CAMPUS_LIST" && scope.campusIds.includes(student.campusId));
  if (!inScope) {
    return Response.json({ error: "No encontrado" }, { status: 404 });
  }

  const invoice = await prisma.invoice.create({
    data: {
      studentId: body.studentId,
      description: body.description,
      amountCents: body.amountCents,
      dueDate: due,
      conceptoPagoId: body.conceptoPagoId ?? null,
    },
  });

  return Response.json(invoice, { status: 201 });
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }
  const role = (session.user as { role: string }).role;
  if (!assertAdminOrStaff(role)) {
    return Response.json({ error: "No autorizado" }, { status: 403 });
  }

  const access = await hasModuleAccess(session.user as { id: string; role: any }, "cobranzas");
  if (access === "none") {
    return Response.json({ error: "No autorizado" }, { status: 403 });
  }

  const scope = await getCampusScope(session.user as { id: string; role: any });
  const where: Prisma.InvoiceWhereInput =
    scope.type === "ALL"
      ? {}
      : scope.type === "CAMPUS_LIST"
        ? { student: { campusId: { in: scope.campusIds } } }
        : { id: { in: [] } };

  const invoices = await prisma.invoice.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { student: { include: { user: { select: { name: true } }, campus: true } } },
  });

  return Response.json(invoices);
}
