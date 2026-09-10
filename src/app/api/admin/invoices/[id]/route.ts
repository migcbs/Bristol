import { auth } from "@/lib/auth";
import { getCampusScope } from "@/lib/campus-scope";
import { hasModuleAccess } from "@/lib/staff-permissions";
import { prisma } from "@/lib/prisma";

function assertAdminOrStaff(role: string) {
  return role === "ADMIN" || role === "STAFF";
}

// Marks an invoice paid in person at Caja (cash, card terminal, etc — a
// payment that didn't go through the Stripe portal checkout, which already
// marks its own invoices paid via the webhook at
// src/app/api/webhooks/stripe/route.ts). Records a matching CashMovement so
// the ledger and the invoice stay consistent.
//
// Requires strictly "full" on cobranzas, not "initiate" — Recepción
// initiates a charge at enrollment (POST /api/admin/invoices), but actually
// collecting money and touching the cash ledger is Caja's job alone
// (confirmed with the user 2026-09-09, tightened from an earlier version
// that let "initiate" through here too).
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }
  const role = (session.user as { role: string }).role;
  if (!assertAdminOrStaff(role)) {
    return Response.json({ error: "No autorizado" }, { status: 403 });
  }

  const access = await hasModuleAccess(session.user as { id: string; role: any }, "cobranzas");
  if (access !== "full") {
    return Response.json({ error: "No autorizado" }, { status: 403 });
  }

  let body: { action?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Cuerpo de la solicitud inválido" }, { status: 400 });
  }

  if (body.action !== "mark-paid") {
    return Response.json({ error: "Acción inválida" }, { status: 400 });
  }

  const { id } = await context.params;
  const invoice = await prisma.invoice.findUnique({ where: { id }, include: { student: true } });
  if (!invoice) {
    return Response.json({ error: "No encontrado" }, { status: 404 });
  }

  const scope = await getCampusScope(session.user as { id: string; role: any });
  const inScope = scope.type === "ALL" || (scope.type === "CAMPUS_LIST" && scope.campusIds.includes(invoice.student.campusId));
  if (!inScope) {
    return Response.json({ error: "No encontrado" }, { status: 404 });
  }

  if (invoice.status !== "PENDING" && invoice.status !== "OVERDUE") {
    return Response.json({ error: "Este cargo no se puede marcar como pagado" }, { status: 400 });
  }

  // A cash-in-hand collection has to land inside a día de caja — otherwise
  // it never shows up in that day's corte/cierre totals (see
  // /api/admin/caja/sessions). A Stripe payment doesn't go through this
  // route at all (its own webhook marks the invoice paid directly), so
  // this only applies to in-person collection.
  const cashSession = await prisma.cashRegisterSession.findFirst({
    where: { campusId: invoice.student.campusId, status: "ABIERTA" },
  });
  if (!cashSession) {
    return Response.json({ error: "Abre la caja de este plantel antes de cobrar" }, { status: 400 });
  }

  const [updated] = await prisma.$transaction([
    prisma.invoice.update({
      where: { id },
      data: { status: "PAID", paidAt: new Date() },
    }),
    prisma.cashMovement.create({
      data: {
        campusId: invoice.student.campusId,
        tipo: "ENTRADA",
        concepto: invoice.description,
        montoCents: invoice.amountCents,
        invoiceId: invoice.id,
        cashRegisterSessionId: cashSession.id,
        createdById: session.user.id as string,
      },
    }),
  ]);

  return Response.json(updated);
}
