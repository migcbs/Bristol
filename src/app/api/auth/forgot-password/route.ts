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
    try {
      await sendPasswordResetEmail(user.email, token);
    } catch (err) {
      // Never reveal a send failure to the caller — same reasoning as
      // returning `{ ok: true }` unconditionally below: this endpoint
      // must not leak whether an email exists or whether delivery worked.
      console.error("sendPasswordResetEmail failed", err);
    }
  }

  return Response.json({ ok: true });
}
