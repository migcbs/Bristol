import { auth } from "@/lib/auth";
import { getVisibleGroupIds } from "@/lib/academic-access";
import { prisma } from "@/lib/prisma";

const MAX_TITLE_LENGTH = 200;

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }
  const role = (session.user as { role: string }).role;
  if (role !== "TEACHER") {
    return Response.json({ error: "No autorizado" }, { status: 403 });
  }

  let body: { groupId?: string; title?: string; url?: string; description?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Cuerpo de la solicitud inválido" }, { status: 400 });
  }

  if (!body.groupId || typeof body.title !== "string" || typeof body.url !== "string") {
    return Response.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const title = body.title.trim();
  if (!title || title.length > MAX_TITLE_LENGTH) {
    return Response.json({ error: "Título inválido" }, { status: 400 });
  }

  try {
    new URL(body.url);
  } catch {
    return Response.json({ error: "El enlace no es una URL válida" }, { status: 400 });
  }

  const group = await prisma.group.findUnique({ where: { id: body.groupId } });
  if (!group) {
    return Response.json({ error: "Grupo no encontrado" }, { status: 404 });
  }
  if (group.teacherId !== (session.user as { id: string }).id) {
    return Response.json({ error: "No autorizado" }, { status: 403 });
  }

  const material = await prisma.material.create({
    data: {
      groupId: body.groupId,
      title,
      url: body.url,
      description: body.description?.trim() || null,
      uploadedById: (session.user as { id: string }).id,
    },
  });

  return Response.json(material, { status: 201 });
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const groupId = searchParams.get("groupId");

  const visibleGroupIds = await getVisibleGroupIds(session.user as { id: string; role: any });

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
