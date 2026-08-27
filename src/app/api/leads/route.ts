import { prisma } from "@/lib/prisma";
import { isValidEmail } from "@/lib/validation";

export async function POST(request: Request) {
  let body: {
    name?: string;
    email?: string;
    phone?: string;
    message?: string;
    campusId?: string;
  };

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Cuerpo de la solicitud inválido" }, { status: 400 });
  }

  const { name, email, phone, message, campusId } = body;

  if (!name || !email) {
    return Response.json({ error: "Nombre y correo son requeridos" }, { status: 400 });
  }

  if (!isValidEmail(email)) {
    return Response.json({ error: "Correo electrónico inválido" }, { status: 400 });
  }

  const lead = await prisma.lead.create({
    data: { name, email, phone, message, campusId },
  });

  return Response.json(lead, { status: 201 });
}
