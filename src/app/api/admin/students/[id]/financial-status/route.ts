import { auth } from "@/lib/auth";
import { assertCampusInScope } from "@/lib/campus-scope";
import { computeFinancialStatus } from "@/lib/financial-status";
import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }
  const role = (session.user as { role: Role }).role;
  if (role !== "ADMIN" && role !== "STAFF") {
    return Response.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id } = await params;
  const student = await prisma.student.findUnique({ where: { id } });
  if (!student) {
    return Response.json({ error: "No encontrado" }, { status: 404 });
  }

  if (role === "STAFF") {
    const inScope = await assertCampusInScope(session.user as { id: string; role: Role }, student.campusId);
    if (!inScope) {
      return Response.json({ error: "No encontrado" }, { status: 404 });
    }
  }

  const invoices = await prisma.invoice.findMany({ where: { studentId: id } });
  const status = computeFinancialStatus(invoices);

  return Response.json({ status });
}
