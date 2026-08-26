import { prisma } from "@/lib/prisma";
import { consumeToken } from "@/lib/tokens";

export async function POST(request: Request) {
  let body: { token: string };
  try {
    body = (await request.json()) as { token: string };
  } catch {
    return Response.json({ error: "Cuerpo de la solicitud inválido" }, { status: 400 });
  }
  const { token } = body;

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
