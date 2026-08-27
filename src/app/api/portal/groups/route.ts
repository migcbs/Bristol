import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }
  const role = (session.user as { role: string }).role;
  if (role !== "TEACHER") {
    return Response.json({ error: "No autorizado" }, { status: 403 });
  }

  const groups = await prisma.group.findMany({
    where: { teacherId: (session.user as { id: string }).id },
    include: { level: true, campus: true },
    orderBy: { name: "asc" },
  });

  return Response.json(groups);
}
