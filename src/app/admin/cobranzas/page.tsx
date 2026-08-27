import { auth } from "@/lib/auth";
import { getCampusScope } from "@/lib/campus-scope";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { Table, TableRow, TableCell, TableHead } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { InvoiceForm } from "@/components/admin/invoice-form";

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendiente",
  PAID: "Pagado",
  OVERDUE: "Vencido",
  CANCELED: "Cancelado",
};

function formatMoney(cents: number) {
  return (cents / 100).toLocaleString("es-MX", { style: "currency", currency: "MXN" });
}

export default async function CobranzasPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const scope = await getCampusScope(session.user as { id: string; role: any });

  const invoiceWhere: Prisma.InvoiceWhereInput =
    scope.type === "ALL"
      ? {}
      : scope.type === "CAMPUS_LIST"
        ? { student: { campusId: { in: scope.campusIds } } }
        : { id: { in: [] } };

  const studentWhere: Prisma.StudentWhereInput =
    scope.type === "ALL"
      ? {}
      : scope.type === "CAMPUS_LIST"
        ? { campusId: { in: scope.campusIds } }
        : { id: { in: [] } };

  const [invoices, students] = await Promise.all([
    prisma.invoice.findMany({
      where: invoiceWhere,
      orderBy: { createdAt: "desc" },
      include: { student: { include: { user: true } } },
    }),
    prisma.student.findMany({ where: studentWhere, include: { user: true } }),
  ]);

  return (
    <div>
      <h1 className="text-lg font-semibold">Cobranzas</h1>
      <p className="mt-1 text-sm text-muted">Cargos generados a alumnos, más recientes primero.</p>

      <div className="mt-6">
        <InvoiceForm students={students.map((s) => ({ id: s.id, name: s.user.name }))} />
      </div>

      <div className="mt-6 overflow-x-auto">
        <Table>
          <thead>
            <TableRow>
              <TableHead>Alumno</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead>Monto</TableHead>
              <TableHead>Vencimiento</TableHead>
              <TableHead>Estatus</TableHead>
            </TableRow>
          </thead>
          <tbody>
            {invoices.map((invoice) => (
              <TableRow key={invoice.id}>
                <TableCell>{invoice.student.user.name}</TableCell>
                <TableCell>{invoice.description}</TableCell>
                <TableCell>{formatMoney(invoice.amountCents)}</TableCell>
                <TableCell>{invoice.dueDate.toLocaleDateString("es-MX")}</TableCell>
                <TableCell>
                  <Badge tone="primary">{STATUS_LABELS[invoice.status]}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </tbody>
        </Table>
        {invoices.length === 0 && (
          <p className="mt-6 text-center text-sm text-muted">No hay cargos que mostrar todavía.</p>
        )}
      </div>
    </div>
  );
}
