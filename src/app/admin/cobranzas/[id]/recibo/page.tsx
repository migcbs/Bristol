import { auth } from "@/lib/auth";
import { getCampusScope } from "@/lib/campus-scope";
import { hasModuleAccess } from "@/lib/staff-permissions";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import { formatMoneyMXN } from "@/lib/invoice-status";
import { PrintButton } from "@/components/admin/print-button";

export default async function ReciboPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const role = (session.user as { role: string }).role;
  if (role !== "ADMIN" && role !== "STAFF") redirect("/portal");

  const access = await hasModuleAccess(session.user as { id: string; role: any }, "cobranzas");
  if (access === "none") redirect("/admin");

  const { id } = await params;
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: { student: { include: { user: true, campus: true } } },
  });
  if (!invoice || invoice.status !== "PAID") notFound();

  const scope = await getCampusScope(session.user as { id: string; role: any });
  const inScope = scope.type === "ALL" || (scope.type === "CAMPUS_LIST" && scope.campusIds.includes(invoice.student.campusId));
  if (!inScope) notFound();

  return (
    <div className="mx-auto max-w-lg p-8 print:p-0">
      <div className="mb-6 flex justify-end print:hidden">
        <PrintButton />
      </div>
      <div className="rounded-2xl border border-border bg-white p-8 shadow-sm print:border-0 print:shadow-none">
        <p className="text-xs font-semibold uppercase tracking-wide text-accent">Bristol · Inglés Profesional</p>
        <h1 className="mt-1 font-display text-2xl font-semibold text-primary">Nota de pago</h1>
        <p className="mt-1 text-sm text-muted">Plantel {invoice.student.campus.name}</p>

        <dl className="mt-6 space-y-3 text-sm">
          <div className="flex justify-between border-b border-border pb-2">
            <dt className="text-muted">Alumno</dt>
            <dd className="font-medium">{invoice.student.user.name}</dd>
          </div>
          <div className="flex justify-between border-b border-border pb-2">
            <dt className="text-muted">Concepto</dt>
            <dd className="font-medium">{invoice.description}</dd>
          </div>
          <div className="flex justify-between border-b border-border pb-2">
            <dt className="text-muted">Monto pagado</dt>
            <dd className="font-semibold text-primary">{formatMoneyMXN(invoice.amountCents)}</dd>
          </div>
          <div className="flex justify-between border-b border-border pb-2">
            <dt className="text-muted">Fecha de pago</dt>
            <dd className="font-medium">{(invoice.paidAt ?? invoice.createdAt).toLocaleDateString("es-MX")}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">Folio</dt>
            <dd className="font-mono text-xs">{invoice.id}</dd>
          </div>
        </dl>

        <p className="mt-8 text-[11px] text-muted">
          Este comprobante no constituye una factura fiscal (CFDI) timbrada ante el SAT.
        </p>
      </div>
    </div>
  );
}
