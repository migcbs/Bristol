import { prisma } from "@/lib/prisma";
import { consumeToken } from "@/lib/tokens";
import { hashPassword } from "@/lib/password";

export async function POST(request: Request) {
  let body: { token: string; password: string };
  try {
    body = (await request.json()) as { token: string; password: string };
  } catch {
    return Response.json({ error: "Cuerpo de la solicitud inválido" }, { status: 400 });
  }
  const { token, password } = body;

  const consumed = await consumeToken(token, "PASSWORD_RESET");
  if (!consumed) {
    return Response.json({ error: "Token inválido o expirado" }, { status: 400 });
  }

  if (typeof password !== "string" || password.length < 8) {
    return Response.json(
      { error: "La contraseña debe tener al menos 8 caracteres" },
      { status: 400 }
    );
  }

  const passwordHash = await hashPassword(password);
  await prisma.user.update({ where: { id: consumed.userId }, data: { passwordHash } });

  return Response.json({ ok: true });
}
