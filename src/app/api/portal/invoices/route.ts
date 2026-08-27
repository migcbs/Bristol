import { auth } from "@/lib/auth";
import { getVisibleStudentIds } from "@/lib/invoice-scope";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }

  const studentIds = await getVisibleStudentIds(session.user as { id: string; role: any });
  if (studentIds.length === 0) {
    return Response.json([]);
  }

  const invoices = await prisma.invoice.findMany({
    where: { studentId: { in: studentIds } },
    orderBy: { dueDate: "asc" },
    include: { student: { include: { user: { select: { name: true } } } } },
  });

  return Response.json(invoices);
}
