import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";

// Deleting a library item is ADMIN-only — confirmed with the user
// 2026-09-09: Control Escolar curates the library (creates carpetas,
// adds items), but only an administrator can remove one.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }
  const role = (session.user as { role: Role }).role;
  if (role !== "ADMIN") {
    return Response.json({ error: "Solo un administrador puede eliminar material" }, { status: 403 });
  }

  const { id: carpetaId, itemId } = await params;
  const item = await prisma.materialLibraryItem.findUnique({ where: { id: itemId } });
  if (!item || item.carpetaId !== carpetaId) {
    return Response.json({ error: "No encontrado" }, { status: 404 });
  }

  await prisma.materialLibraryItem.delete({ where: { id: itemId } });
  return new Response(null, { status: 204 });
}
