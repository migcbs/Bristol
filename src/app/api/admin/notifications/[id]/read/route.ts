import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }

  const { id } = await params;
  const result = await prisma.notification.updateMany({
    where: { id, userId: (session.user as { id: string }).id },
    data: { readAt: new Date() },
  });

  if (result.count === 0) {
    return Response.json({ error: "No encontrado" }, { status: 404 });
  }

  return Response.json({ ok: true });
}
