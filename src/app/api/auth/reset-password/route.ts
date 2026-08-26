import { prisma } from "@/lib/prisma";
import { consumeToken } from "@/lib/tokens";
import { hashPassword } from "@/lib/password";

export async function POST(request: Request) {
  const { token, password } = (await request.json()) as { token: string; password: string };

  const consumed = await consumeToken(token, "PASSWORD_RESET");
  if (!consumed) {
    return Response.json({ error: "Token inválido o expirado" }, { status: 400 });
  }

  const passwordHash = await hashPassword(password);
  await prisma.user.update({ where: { id: consumed.userId }, data: { passwordHash } });

  return Response.json({ ok: true });
}
