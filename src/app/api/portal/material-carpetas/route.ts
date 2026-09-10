import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";

// Every carpeta is listed so a teacher can see what exists and request
// access; only carpetas with an APROBADA request expose their items.
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }
  const role = (session.user as { role: Role }).role;
  if (role !== "TEACHER") {
    return Response.json({ error: "No autorizado" }, { status: 403 });
  }
  const teacherId = (session.user as { id: string }).id;

  const carpetas = await prisma.materialCarpeta.findMany({
    orderBy: { nombre: "asc" },
    include: {
      requests: {
        where: { teacherId },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  const approvedIds = carpetas.filter((c) => c.requests[0]?.status === "APROBADA").map((c) => c.id);
  const items = approvedIds.length
    ? await prisma.materialLibraryItem.findMany({
        where: { carpetaId: { in: approvedIds } },
        orderBy: { createdAt: "desc" },
      })
    : [];

  return Response.json(
    carpetas.map((c) => ({
      id: c.id,
      nombre: c.nombre,
      descripcion: c.descripcion,
      accessStatus: c.requests[0]?.status ?? null,
      items: c.requests[0]?.status === "APROBADA" ? items.filter((i) => i.carpetaId === c.id) : [],
    }))
  );
}
