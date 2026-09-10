import { auth } from "@/lib/auth";
import { hasModuleAccess } from "@/lib/staff-permissions";
import { readMaterialFile } from "@/lib/material-storage";
import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";

// Streams an uploaded library file. Readable by ADMIN/STAFF with any
// biblioteca_material access, or a TEACHER who has an approved access
// request for the carpeta (same rule the portal library page uses to
// decide what a teacher can see).
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }
  const actor = session.user as { id: string; role: Role };
  const { id: carpetaId, itemId } = await params;

  const item = await prisma.materialLibraryItem.findUnique({ where: { id: itemId } });
  if (!item || item.carpetaId !== carpetaId || !item.storageKey) {
    return Response.json({ error: "No encontrado" }, { status: 404 });
  }

  let allowed = false;
  if (actor.role === "ADMIN" || actor.role === "STAFF") {
    allowed = (await hasModuleAccess(actor, "biblioteca_material")) !== "none";
  } else if (actor.role === "TEACHER") {
    const approved = await prisma.materialAccessRequest.findFirst({
      where: { carpetaId, teacherId: actor.id, status: "APROBADA" },
    });
    allowed = !!approved;
  }
  if (!allowed) {
    return Response.json({ error: "No autorizado" }, { status: 403 });
  }

  let bytes: Buffer;
  try {
    bytes = await readMaterialFile(item.storageKey);
  } catch {
    return Response.json({ error: "El archivo no está disponible" }, { status: 500 });
  }

  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": item.mimeType ?? "application/octet-stream",
      "Content-Disposition": `inline; filename="${encodeURIComponent(item.fileName ?? "material")}"`,
      "Content-Length": String(item.sizeBytes ?? bytes.length),
      "Cache-Control": "private, no-store",
    },
  });
}
