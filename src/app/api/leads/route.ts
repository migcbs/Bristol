import { prisma } from "@/lib/prisma";
import { isValidEmail } from "@/lib/validation";
import type { LeadSource } from "@prisma/client";

const VALID_SOURCES: LeadSource[] = ["WEB", "REDES_SOCIALES", "REFERIDO", "VISITA_PRESENCIAL", "OTRO"];

export async function POST(request: Request) {
  let body: {
    name?: string;
    email?: string;
    phone?: string;
    message?: string;
    campusId?: string;
    source?: string;
  };

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Cuerpo de la solicitud inválido" }, { status: 400 });
  }

  const { phone, message, campusId } = body;
  const trimmedName = body.name?.trim();
  const trimmedEmail = body.email?.trim();

  if (!trimmedName || !trimmedEmail) {
    return Response.json({ error: "Nombre y correo son requeridos" }, { status: 400 });
  }

  if (!isValidEmail(trimmedEmail)) {
    return Response.json({ error: "Correo electrónico inválido" }, { status: 400 });
  }

  if (
    trimmedName.length > 120 ||
    trimmedEmail.length > 254 ||
    (phone && phone.length > 30) ||
    (message && message.length > 2000)
  ) {
    return Response.json({ error: "Uno o más campos exceden la longitud permitida" }, { status: 400 });
  }

  if (campusId !== undefined && (typeof campusId !== "string" || campusId.length === 0)) {
    return Response.json({ error: "Plantel inválido" }, { status: 400 });
  }

  if (body.source !== undefined && !VALID_SOURCES.includes(body.source as LeadSource)) {
    return Response.json({ error: "Origen de lead inválido" }, { status: 400 });
  }

  try {
    const lead = await prisma.lead.create({
      data: { name: trimmedName, email: trimmedEmail, phone, message, campusId, source: body.source as LeadSource },
    });

    return Response.json(lead, { status: 201 });
  } catch {
    return Response.json(
      { error: "No pudimos registrar tu solicitud. Verifica los datos e intenta de nuevo." },
      { status: 400 }
    );
  }
}
