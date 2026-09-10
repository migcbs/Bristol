import { auth } from "@/lib/auth";
import { getVisibleGroupIds } from "@/lib/academic-access";
import { readMaterialFile } from "@/lib/material-storage";
import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";

// Streams an uploaded class material file. Any portal user who can see
// the group (teacher, its students, their parents) can download it — same
// visibility rule as the materials list.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }
  const { id } = await params;
  const material = await prisma.material.findUnique({ where: { id } });
  if (!material || !material.storageKey) {
    return Response.json({ error: "No encontrado" }, { status: 404 });
  }

  const visibleGroupIds = await getVisibleGroupIds(session.user as { id: string; role: Role });
  if (!visibleGroupIds.includes(material.groupId)) {
    return Response.json({ error: "No encontrado" }, { status: 404 });
  }

  let bytes: Buffer;
  try {
    bytes = await readMaterialFile(material.storageKey);
  } catch {
    return Response.json({ error: "El archivo no está disponible" }, { status: 500 });
  }

  const disposition = new URL(request.url).searchParams.get("download") === "1" ? "attachment" : "inline";
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": material.mimeType ?? "application/octet-stream",
      "Content-Disposition": `${disposition}; filename="${encodeURIComponent(material.fileName ?? "material")}"`,
      "Content-Length": String(material.sizeBytes ?? bytes.length),
      "Cache-Control": "private, no-store",
    },
  });
}
