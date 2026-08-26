import { prisma } from "@/lib/prisma";
import { createToken } from "@/lib/tokens";
import { sendPasswordResetEmail } from "@/lib/email";

export async function POST(request: Request) {
  const { email } = (await request.json()) as { email: string };

  const user = await prisma.user.findUnique({ where: { email } });
  if (user) {
    const token = await createToken(user.id, "PASSWORD_RESET", 60);
    await sendPasswordResetEmail(user.email, token);
  }

  return Response.json({ ok: true });
}
