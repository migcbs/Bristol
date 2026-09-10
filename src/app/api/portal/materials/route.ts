import { auth } from "@/lib/auth";
import { getVisibleGroupIds } from "@/lib/academic-access";
import {
  ALLOWED_MATERIAL_MIME,
  MAX_MATERIAL_BYTES,
  newStorageKey,
  saveMaterialFile,
} from "@/lib/material-storage";
import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";

const MAX_TITLE_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 2000;
const MAX_URL_LENGTH = 2048;

// Teachers can now attach a class material either as an external link
// (JSON body, the original behaviour) or by uploading a file from their
// machine (multipart/form-data) — confirmed with the user 2026-09-09.
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }
  const actor = session.user as { id: string; role: string };
  if (actor.role !== "TEACHER") {
    return Response.json({ error: "No autorizado" }, { status: 403 });
  }

  const isMultipart = (request.headers.get("content-type") ?? "").includes("multipart/form-data");

  let groupId: string;
  let title: string;
  let description: string | null;
  let materialData: { url: string; storageKey?: string; fileName?: string; mimeType?: string; sizeBytes?: number };

  if (isMultipart) {
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return Response.json({ error: "Cuerpo de la solicitud inválido" }, { status: 400 });
    }
    groupId = String(formData.get("groupId") ?? "");
    title = String(formData.get("title") ?? "").trim();
    description = String(formData.get("description") ?? "").trim() || null;
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
    materialData = { url: "", storageKey, fileName: file.name, mimeType: file.type, sizeBytes: file.size };
  } else {
    let body: { groupId?: string; title?: string; url?: string; description?: string };
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Cuerpo de la solicitud inválido" }, { status: 400 });
    }
    if (!body.groupId || typeof body.title !== "string" || typeof body.url !== "string") {
      return Response.json({ error: "Datos inválidos" }, { status: 400 });
    }
    if (body.url.length > MAX_URL_LENGTH) {
      return Response.json({ error: "El enlace es demasiado largo" }, { status: 400 });
    }
    try {
      new URL(body.url);
    } catch {
      return Response.json({ error: "El enlace no es una URL válida" }, { status: 400 });
    }
    groupId = body.groupId;
    title = body.title.trim();
    description = body.description?.trim() || null;
    materialData = { url: body.url };
  }

  if (!groupId || !title || title.length > MAX_TITLE_LENGTH) {
    return Response.json({ error: "Datos inválidos" }, { status: 400 });
  }
  if (description && description.length > MAX_DESCRIPTION_LENGTH) {
    return Response.json({ error: "La descripción es demasiado larga" }, { status: 400 });
  }

  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group) {
    return Response.json({ error: "Grupo no encontrado" }, { status: 404 });
  }
  if (group.teacherId !== actor.id) {
    return Response.json({ error: "No autorizado" }, { status: 403 });
  }

  const material = await prisma.material.create({
    data: { groupId, title, description, uploadedById: actor.id, ...materialData },
  });
  // For an uploaded file, `url` points back at its own download route.
  if (material.storageKey) {
    await prisma.material.update({
      where: { id: material.id },
      data: { url: `/api/portal/materials/${material.id}/file` },
    });
  }

  return Response.json(material, { status: 201 });
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const groupId = searchParams.get("groupId");

  const visibleGroupIds = await getVisibleGroupIds(session.user as { id: string; role: Role });

  if (groupId) {
    if (!visibleGroupIds.includes(groupId)) {
      return Response.json({ error: "No encontrado" }, { status: 404 });
    }
    const materials = await prisma.material.findMany({
      where: { groupId },
      orderBy: { createdAt: "desc" },
      include: { uploadedBy: { select: { id: true, name: true } } },
    });
    return Response.json(materials);
  }

  const materials = await prisma.material.findMany({
    where: { groupId: { in: visibleGroupIds } },
    orderBy: { createdAt: "desc" },
    include: { uploadedBy: { select: { id: true, name: true } } },
  });
  return Response.json(materials);
}
