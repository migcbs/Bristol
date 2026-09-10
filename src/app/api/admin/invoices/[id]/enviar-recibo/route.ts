import { auth } from "@/lib/auth";
import { getCampusScope } from "@/lib/campus-scope";
import { hasModuleAccess } from "@/lib/staff-permissions";
import { prisma } from "@/lib/prisma";
import { sendReciboFiscalEmail } from "@/lib/email";
import { formatMoneyMXN } from "@/lib/invoice-status";

function assertAdminOrStaff(role: string) {
  return role === "ADMIN" || role === "STAFF";
}

// Emails the payer a receipt containing their captured fiscal data. This is
// NOT a real stamped CFDI (no PAC/SAT integration) — see the field comment
// on Invoice.reciboFiscalEnviado in prisma/schema.prisma.
//
// Requires strictly "full" on cobranzas — same reasoning as mark-paid in
// ../route.ts: Recepción initiates charges but doesn't collect or receipt
// them, that's Caja's job.
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
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

  const { id } = await context.params;
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: { student: { include: { user: true, parentLinks: { include: { parent: true } } } } },
  });
  if (!invoice) {
    return Response.json({ error: "No encontrado" }, { status: 404 });
  }

  const scope = await getCampusScope(session.user as { id: string; role: any });
  const inScope = scope.type === "ALL" || (scope.type === "CAMPUS_LIST" && scope.campusIds.includes(invoice.student.campusId));
  if (!inScope) {
    return Response.json({ error: "No encontrado" }, { status: 404 });
  }

  if (invoice.status !== "PAID") {
    return Response.json({ error: "Solo se puede enviar el recibo de un cargo pagado" }, { status: 400 });
  }

  // Prefer the first linked tutor as the payer (the common case for a minor
  // student); fall back to the student themself when self-paying (adult).
  const payerUser = invoice.student.parentLinks[0]?.parent ?? invoice.student.user;
  const fiscal = {
    rfc: invoice.student.parentLinks[0]?.parent.rfc ?? invoice.student.rfc,
    razonSocial: invoice.student.parentLinks[0]?.parent.razonSocial ?? invoice.student.razonSocial,
    regimenFiscal: invoice.student.parentLinks[0]?.parent.regimenFiscal ?? invoice.student.regimenFiscal,
    codigoPostalFiscal: invoice.student.parentLinks[0]?.parent.codigoPostalFiscal ?? invoice.student.codigoPostalFiscal,
    usoCfdi: invoice.student.parentLinks[0]?.parent.usoCfdi ?? invoice.student.usoCfdi,
  };
  const hasFiscalData = Object.values(fiscal).some((v) => !!v);

  try {
    await sendReciboFiscalEmail(payerUser.email, {
      concepto: invoice.description,
      montoFormatted: formatMoneyMXN(invoice.amountCents),
      fechaPago: (invoice.paidAt ?? new Date()).toLocaleDateString("es-MX"),
      fiscal: hasFiscalData ? fiscal : null,
    });
  } catch (err) {
    console.error("Error sending recibo fiscal email", err);
    return Response.json({ error: "No se pudo enviar el recibo por correo" }, { status: 502 });
  }

  const updated = await prisma.invoice.update({
    where: { id },
    data: { reciboFiscalEnviado: true, reciboFiscalEnviadoAt: new Date() },
  });

  return Response.json(updated);
}
