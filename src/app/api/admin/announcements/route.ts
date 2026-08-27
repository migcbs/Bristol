import { auth } from "@/lib/auth";
import { getCampusScope } from "@/lib/campus-scope";
import { resolveAnnouncementRecipients } from "@/lib/announcement-scope";
import { sendAnnouncementEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";

const VALID_ROLES: Role[] = ["ADMIN", "STAFF", "TEACHER", "STUDENT", "PARENT"];

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
      title: body.title,
      body: body.body,
      audience: body.audience as "ALL" | "CAMPUS" | "ROLE",
      campusId: body.campusId ?? null,
      role: (body.role as Role) ?? null,
      sendEmail: body.sendEmail ?? false,
      createdById: (session.user as { id: string }).id,
    },
  });

  if (body.sendEmail) {
    const recipients = await resolveAnnouncementRecipients({
      audience: announcement.audience,
      campusId: announcement.campusId,
      role: announcement.role,
    });
    await Promise.allSettled(
      recipients.map((r) => sendAnnouncementEmail(r.email, { title: announcement.title, body: announcement.body }))
    );
  }

  return Response.json(announcement, { status: 201 });
}
