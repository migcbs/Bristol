import { prisma } from "@/lib/prisma";
import { consumeToken } from "@/lib/tokens";

export async function POST(request: Request) {
  const { token } = (await request.json()) as { token: string };

  const consumed = await consumeToken(token, "EMAIL_VERIFY");
  if (!consumed) {
    return Response.json({ error: "Token inválido o expirado" }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: consumed.userId },
    data: { emailVerifiedAt: new Date() },
  });

  return Response.json({ ok: true });
}
