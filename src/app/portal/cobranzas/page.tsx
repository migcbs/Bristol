import { auth } from "@/lib/auth";
import { computeAgeBracket } from "@/lib/age-bracket";
import { getVisibleStudentIds } from "@/lib/invoice-scope";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PayButton } from "@/components/portal/pay-button";
import { INVOICE_STATUS_LABELS, formatMoneyMXN } from "@/lib/invoice-status";

export default async function PortalCobranzasPage({
  searchParams,
}: {
  searchParams: Promise<{ paid?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { paid } = await searchParams;
  const studentIds = await getVisibleStudentIds(session.user as { id: string; role: any });

  const role = (session.user as { role: string }).role;
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
        include: { student: { include: { user: true } } },
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
          <Card key={invoice.id} className="flex items-center justify-between">
            <div>
              <p className="font-semibold">{invoice.description}</p>
              <p className="text-sm text-muted">
                {invoice.student.user.name} · Vence {invoice.dueDate.toLocaleDateString("es-MX")}
              </p>
              <p className="mt-1 text-lg font-bold text-primary">{formatMoneyMXN(invoice.amountCents)}</p>
            </div>
            <div className="flex items-center gap-3">
              <Badge tone="primary">{INVOICE_STATUS_LABELS[invoice.status]}</Badge>
              {(invoice.status === "PENDING" || invoice.status === "OVERDUE") &&
                (canPay ? (
                  <PayButton invoiceId={invoice.id} />
                ) : (
                  <p className="text-xs text-muted">El pago debe realizarlo tu padre o tutor.</p>
                ))}
            </div>
          </Card>
        ))}
        {invoices.length === 0 && (
          <p className="text-sm text-muted">No tienes cargos pendientes.</p>
        )}
      </div>
    </div>
  );
}
