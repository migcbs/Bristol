import { auth } from "@/lib/auth";
import { getVisibleStudentIds } from "@/lib/invoice-scope";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PayButton } from "@/components/portal/pay-button";

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendiente",
  PAID: "Pagado",
  OVERDUE: "Vencido",
  CANCELED: "Cancelado",
};

function formatMoney(cents: number) {
  return (cents / 100).toLocaleString("es-MX", { style: "currency", currency: "MXN" });
}

export default async function PortalCobranzasPage({
  searchParams,
}: {
  searchParams: Promise<{ paid?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { paid } = await searchParams;
  const studentIds = await getVisibleStudentIds(session.user as { id: string; role: any });

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
              <p className="mt-1 text-lg font-bold text-primary">{formatMoney(invoice.amountCents)}</p>
            </div>
            <div className="flex items-center gap-3">
              <Badge tone="primary">{STATUS_LABELS[invoice.status]}</Badge>
              {invoice.status === "PENDING" && <PayButton invoiceId={invoice.id} />}
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
