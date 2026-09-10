import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/password";

// Authenticated password change — distinct from /api/auth/reset-password
// (which is for a forgotten password via an emailed token). This one is
// for a logged-in user who knows their current password and either wants
// to change it, or is being forced to because Recepción set them up with
// a temporary one (mustChangePassword).
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }

  let body: { currentPassword?: string; newPassword?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Cuerpo de la solicitud inválido" }, { status: 400 });
  }

  const { currentPassword, newPassword } = body;
  if (!currentPassword || !newPassword) {
    return Response.json({ error: "Datos inválidos" }, { status: 400 });
  }

  if (newPassword.length < 8) {
    return Response.json({ error: "La nueva contraseña debe tener al menos 8 caracteres" }, { status: 400 });
  }

  const userId = (session.user as { id: string }).id;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }

  const valid = await verifyPassword(currentPassword, user.passwordHash);
  if (!valid) {
    return Response.json({ error: "La contraseña actual es incorrecta" }, { status: 400 });
  }

  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash, mustChangePassword: false },
  });

  return Response.json({ ok: true });
}
