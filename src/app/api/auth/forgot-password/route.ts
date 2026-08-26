import { prisma } from "@/lib/prisma";
import { createToken } from "@/lib/tokens";
import { sendPasswordResetEmail } from "@/lib/email";

export async function POST(request: Request) {
  let body: { email: string };
  try {
    body = (await request.json()) as { email: string };
  } catch {
    return Response.json({ error: "Cuerpo de la solicitud inválido" }, { status: 400 });
  }
  const email = body.email.trim().toLowerCase();

  const user = await prisma.user.findUnique({ where: { email } });
  if (user) {
    const token = await createToken(user.id, "PASSWORD_RESET", 60);
    await sendPasswordResetEmail(user.email, token);
  }

  return Response.json({ ok: true });
}
