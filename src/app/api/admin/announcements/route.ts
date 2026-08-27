import { auth } from "@/lib/auth";
import { getCampusScope } from "@/lib/campus-scope";
import { resolveAnnouncementRecipients, announcementAdminListWhere } from "@/lib/announcement-scope";
import { sendAnnouncementEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";

const VALID_ROLES: Role[] = ["TEACHER", "STUDENT", "PARENT"];
const MAX_TITLE_LENGTH = 200;
const MAX_BODY_LENGTH = 5000;

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }
  const role = (session.user as { role: Role }).role;
  if (role !== "ADMIN" && role !== "STAFF") {
    return Response.json({ error: "No autorizado" }, { status: 403 });
  }

  let body: {
    title?: string;
    body?: string;
    audience?: string;
    campusId?: string;
    role?: string;
    sendEmail?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Cuerpo de la solicitud inválido" }, { status: 400 });
  }

  if (!body.title || !body.body || !body.audience) {
    return Response.json({ error: "Datos inválidos" }, { status: 400 });
  }
  if (typeof body.title !== "string" || typeof body.body !== "string") {
    return Response.json({ error: "Datos inválidos" }, { status: 400 });
  }
  if (body.campusId !== undefined && typeof body.campusId !== "string") {
    return Response.json({ error: "Datos inválidos" }, { status: 400 });
  }
  if (body.role !== undefined && typeof body.role !== "string") {
    return Response.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const title = body.title.trim();
  const announcementBody = body.body.trim();
  if (!title || !announcementBody) {
    return Response.json({ error: "Datos inválidos" }, { status: 400 });
  }
  if (title.length > MAX_TITLE_LENGTH) {
    return Response.json(
      { error: `El título no puede exceder ${MAX_TITLE_LENGTH} caracteres` },
      { status: 400 }
    );
  }
  if (announcementBody.length > MAX_BODY_LENGTH) {
    return Response.json(
      { error: `El contenido no puede exceder ${MAX_BODY_LENGTH} caracteres` },
      { status: 400 }
    );
  }

  if (body.audience === "ALL" && (body.campusId || body.role)) {
    return Response.json({ error: "Datos inválidos" }, { status: 400 });
  }
  if (body.audience === "CAMPUS" && (!body.campusId || body.role)) {
    return Response.json({ error: "Datos inválidos" }, { status: 400 });
  }
  if (body.audience === "ROLE" && (!body.role || body.campusId || !VALID_ROLES.includes(body.role as Role))) {
    return Response.json({ error: "Datos inválidos" }, { status: 400 });
  }
  if (!["ALL", "CAMPUS", "ROLE"].includes(body.audience)) {
    return Response.json({ error: "Datos inválidos" }, { status: 400 });
  }

  if (body.audience === "CAMPUS") {
    const campus = await prisma.campus.findUnique({ where: { id: body.campusId! } });
    if (!campus) {
      return Response.json({ error: "Plantel no encontrado" }, { status: 404 });
    }
  }

  if (role === "STAFF") {
    if (body.audience !== "CAMPUS") {
      return Response.json({ error: "No autorizado" }, { status: 403 });
    }
    const scope = await getCampusScope(session.user as { id: string; role: Role });
    const inScope =
      scope.type === "ALL" || (scope.type === "CAMPUS_LIST" && scope.campusIds.includes(body.campusId!));
    if (!inScope) {
      return Response.json({ error: "No autorizado" }, { status: 403 });
    }
  }

  const announcement = await prisma.announcement.create({
    data: {
      title,
      body: announcementBody,
      audience: body.audience as "ALL" | "CAMPUS" | "ROLE",
      campusId: body.campusId || null,
      role: (body.role as Role) || null,
      sendEmail: body.sendEmail ?? false,
      createdById: (session.user as { id: string }).id,
    },
  });

  if (body.sendEmail) {
    try {
      const recipients = await resolveAnnouncementRecipients({
        audience: announcement.audience,
        campusId: announcement.campusId,
        role: announcement.role,
      });
      const results = await Promise.allSettled(
        recipients.map((r) => sendAnnouncementEmail(r.email, { title: announcement.title, body: announcement.body }))
      );
      const failures = results.filter((r) => r.status === "rejected").length;
      if (failures > 0) {
        console.error(
          `sendAnnouncementEmail: ${failures}/${recipients.length} email(s) failed for announcement ${announcement.id}`
        );
      }
    } catch (err) {
      console.error(`Failed to send announcement emails for announcement ${announcement.id}:`, err);
    }
  }

  return Response.json(announcement, { status: 201 });
}

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }
  const role = (session.user as { role: Role }).role;
  if (role !== "ADMIN" && role !== "STAFF") {
    return Response.json({ error: "No autorizado" }, { status: 403 });
  }

  const where = announcementAdminListWhere({ id: (session.user as { id: string }).id, role });

  const announcements = await prisma.announcement.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { createdBy: { select: { id: true, name: true } }, campus: true },
  });

  return Response.json(announcements);
}
