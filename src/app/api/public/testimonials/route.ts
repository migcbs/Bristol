import { prisma } from "@/lib/prisma";

const MAX_NAME_LENGTH = 120;
const MAX_ROLE_LENGTH = 120;
const MAX_QUOTE_LENGTH = 600;
const MIN_QUOTE_LENGTH = 10;

export async function POST(request: Request) {
  let body: {
    name?: string;
    role?: string;
    quote?: string;
    // Honeypot: a real visitor never sees or fills this field (hidden via
    // CSS in the form). A bot filling every input on the page will. We
    // don't tell the caller which check failed — same 201 response either
    // way — so a bot can't learn to avoid it.
    website?: string;
  };

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Cuerpo de la solicitud inválido" }, { status: 400 });
  }

  if (body.website) {
    return Response.json({ ok: true }, { status: 201 });
  }

  const name = body.name?.trim();
  const role = body.role?.trim();
  const quote = body.quote?.trim();

  if (!name || !quote) {
    return Response.json({ error: "Nombre y reseña son requeridos" }, { status: 400 });
  }

  if (quote.length < MIN_QUOTE_LENGTH) {
    return Response.json(
      { error: `La reseña debe tener al menos ${MIN_QUOTE_LENGTH} caracteres` },
      { status: 400 }
    );
  }

  if (
    name.length > MAX_NAME_LENGTH ||
    quote.length > MAX_QUOTE_LENGTH ||
    (role && role.length > MAX_ROLE_LENGTH)
  ) {
    return Response.json({ error: "Uno o más campos exceden la longitud permitida" }, { status: 400 });
  }

  try {
    await prisma.testimonial.create({
      data: { name, role: role || null, quote },
    });

    return Response.json({ ok: true }, { status: 201 });
  } catch {
    return Response.json(
      { error: "No pudimos registrar tu reseña. Intenta de nuevo." },
      { status: 400 }
    );
  }
}
