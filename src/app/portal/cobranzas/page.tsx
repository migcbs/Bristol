import { auth } from "@/lib/auth";
import { computeAgeBracket } from "@/lib/age-bracket";
import { getVisibleStudentIds } from "@/lib/invoice-scope";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { PortalInvoiceCard } from "@/components/portal/portal-invoice-card";

export default async function PortalCobranzasPage({
  searchParams,
}: {
  searchParams: Promise<{ paid?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const role = (session.user as { role: string }).role;
  // Cobranzas is only for whoever pays — the adult alumno and the tutor.
  // A teacher has no billing relationship, so keep them out even on a
  // direct URL hit (the nav already hides the tab for them).
  if (role !== "STUDENT" && role !== "PARENT") redirect("/portal");

  const { paid } = await searchParams;
  const studentIds = await getVisibleStudentIds(session.user as { id: string; role: any });

  let canPay = true;
  if (role === "STUDENT") {
    const student = await prisma.student.findUnique({
      where: { userId: session.user.id },
    });
    canPay = student?.fechaNacimiento
      ? computeAgeBracket(student.fechaNacimiento) === "ADULTO"
      : false;
  }

  const invoices = studentIds.length
    ? await prisma.invoice.findMany({
        where: { studentId: { in: studentIds } },
        orderBy: { dueDate: "asc" },
        include: {
          student: { include: { user: true, parentLinks: { include: { parent: true } } } },
          conceptoPago: { select: { nombre: true } },
        },
      })
    : [];

  return (
    <div>
      <h1 className="text-lg font-semibold">Cobranzas</h1>
      {paid === "1" && (
        <p className="mt-2 rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">
          ¡Gracias! Tu pago fue recibido.
        </p>
      )}
      <div className="mt-6 grid gap-4">
        {invoices.map((invoice) => (
          <PortalInvoiceCard
            key={invoice.id}
            canPay={canPay}
            invoice={{
              id: invoice.id,
              description: invoice.description,
              conceptoNombre: invoice.conceptoPago?.nombre ?? null,
              amountCents: invoice.amountCents,
              baseCents: invoice.baseCents,
              scholarshipPercent: invoice.scholarshipPercent ? Number(invoice.scholarshipPercent) : null,
              earlyPaymentDiscountCents: invoice.earlyPaymentDiscountCents,
              dueDate: invoice.dueDate,
              paidAt: invoice.paidAt,
              status: invoice.status,
              reciboFiscalEnviado: invoice.reciboFiscalEnviado,
              reciboFiscalEnviadoAt: invoice.reciboFiscalEnviadoAt,
              student: { id: invoice.studentId, user: { name: invoice.student.user.name, email: invoice.student.user.email } },
              parentLinks: invoice.student.parentLinks.map((l) => ({ parent: { name: l.parent.name, email: l.parent.email } })),
            }}
          />
        ))}
        {invoices.length === 0 && (
          <p className="text-sm text-muted">No tienes cargos pendientes.</p>
        )}
      </div>
    </div>
  );
}
