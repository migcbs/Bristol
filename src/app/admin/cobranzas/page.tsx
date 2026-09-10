import { auth } from "@/lib/auth";
import { getCampusScope } from "@/lib/campus-scope";
import { hasModuleAccess } from "@/lib/staff-permissions";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { InvoiceForm } from "@/components/admin/invoice-form";
import { InvoiceCards } from "@/components/admin/invoice-cards";

export default async function CobranzasPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const role = (session.user as { role: string }).role;
  if (role !== "ADMIN" && role !== "STAFF") redirect("/portal");

  const access = await hasModuleAccess(session.user as { id: string; role: any }, "cobranzas");
  // "read" (Recepción, Calidad y Control, Dirección de Campus) can consult
  // the payment status here — only "full" (Caja) creates/collects charges,
  // enforced below by only rendering InvoiceForm and by the server-side
  // checks on the mutating endpoints.
  if (access === "none") redirect("/admin");

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

  const canCreate = access === "full";

  const [invoices, students] = await Promise.all([
    prisma.invoice.findMany({
      where: invoiceWhere,
      orderBy: { createdAt: "desc" },
      include: {
        student: { include: { user: true, parentLinks: { include: { parent: true } } } },
        conceptoPago: { select: { nombre: true } },
      },
    }),
    canCreate ? prisma.student.findMany({ where: studentWhere, include: { user: true } }) : Promise.resolve([]),
  ]);

  return (
    <div>
      <h1 className="text-lg font-semibold">Cobranzas</h1>
      <p className="mt-1 text-sm text-muted">
        {canCreate
          ? "Cargos generados a alumnos, más recientes primero."
          : "Consulta de estatus de pago — solo Caja puede crear o cobrar cargos."}
      </p>

      {canCreate && (
        <div className="mt-6">
          <InvoiceForm students={students.map((s) => ({ id: s.id, name: s.user.name }))} />
        </div>
      )}

      <div className="mt-6">
        <InvoiceCards
          invoices={invoices.map((inv) => ({
            id: inv.id,
            description: inv.description,
            conceptoNombre: inv.conceptoPago?.nombre ?? null,
            amountCents: inv.amountCents,
            baseCents: inv.baseCents,
            scholarshipPercent: inv.scholarshipPercent ? Number(inv.scholarshipPercent) : null,
            earlyPaymentDiscountCents: inv.earlyPaymentDiscountCents,
            dueDate: inv.dueDate,
            paidAt: inv.paidAt,
            status: inv.status,
            reciboFiscalEnviado: inv.reciboFiscalEnviado,
            reciboFiscalEnviadoAt: inv.reciboFiscalEnviadoAt,
            student: { id: inv.student.id, user: { name: inv.student.user.name, email: inv.student.user.email } },
            parentLinks: inv.student.parentLinks.map((l) => ({ parent: { name: l.parent.name, email: l.parent.email } })),
          }))}
          canCollect={access === "full"}
        />
      </div>
    </div>
  );
}
