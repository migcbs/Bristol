import { auth } from "@/lib/auth";
import { hasModuleAccess } from "@/lib/staff-permissions";
import {
  ALLOWED_MATERIAL_MIME,
  MAX_MATERIAL_BYTES,
  newStorageKey,
  saveMaterialFile,
} from "@/lib/material-storage";
import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";

function assertAdminOrStaff(role: string) {
  return role === "ADMIN" || role === "STAFF";
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }
  const role = (session.user as { role: Role }).role;
  if (!assertAdminOrStaff(role)) {
    return Response.json({ error: "No autorizado" }, { status: 403 });
  }

  const access = await hasModuleAccess(session.user as { id: string; role: Role }, "biblioteca_material");
  if (access !== "full") {
    return Response.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id: carpetaId } = await context.params;
  const carpeta = await prisma.materialCarpeta.findUnique({ where: { id: carpetaId } });
  if (!carpeta) {
    return Response.json({ error: "No encontrado" }, { status: 404 });
  }

  const isMultipart = (request.headers.get("content-type") ?? "").includes("multipart/form-data");

  let titulo: string;
  let descripcion: string | null;
  let itemData: { url: string; storageKey?: string; fileName?: string; mimeType?: string; sizeBytes?: number };

  if (isMultipart) {
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return Response.json({ error: "Cuerpo de la solicitud inválido" }, { status: 400 });
    }
    titulo = String(formData.get("titulo") ?? "").trim();
    descripcion = String(formData.get("descripcion") ?? "").trim() || null;
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return Response.json({ error: "Falta el archivo" }, { status: 400 });
    }
    if (file.size > MAX_MATERIAL_BYTES) {
      return Response.json({ error: "El archivo supera los 25MB" }, { status: 400 });
    }
    if (!ALLOWED_MATERIAL_MIME.includes(file.type)) {
      return Response.json({ error: "Tipo de archivo no permitido" }, { status: 400 });
    }
    const storageKey = newStorageKey(file.name);
    await saveMaterialFile(storageKey, Buffer.from(await file.arrayBuffer()));
    itemData = { url: "", storageKey, fileName: file.name, mimeType: file.type, sizeBytes: file.size };
  } else {
    let body: { titulo?: string; url?: string; descripcion?: string };
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Cuerpo de la solicitud inválido" }, { status: 400 });
    }
    const url = body.url?.trim();
    if (!url || url.length > 2000) {
      return Response.json({ error: "Datos inválidos" }, { status: 400 });
    }
    try {
      new URL(url);
    } catch {
      return Response.json({ error: "La URL no es válida" }, { status: 400 });
    }
    titulo = body.titulo?.trim() ?? "";
    descripcion = body.descripcion?.trim() || null;
    itemData = { url };
  }

  if (!titulo || titulo.length > 150) {
    return Response.json({ error: "Título inválido" }, { status: 400 });
  }
  if (descripcion && descripcion.length > 500) {
    return Response.json({ error: "Descripción demasiado larga" }, { status: 400 });
  }

  const item = await prisma.materialLibraryItem.create({
    data: { carpetaId, titulo, descripcion, uploadedById: (session.user as { id: string }).id, ...itemData },
  });
  if (item.storageKey) {
    await prisma.materialLibraryItem.update({
      where: { id: item.id },
      data: { url: `/api/admin/material-carpetas/${carpetaId}/items/${item.id}/file` },
    });
  }

  return Response.json(item, { status: 201 });
}
