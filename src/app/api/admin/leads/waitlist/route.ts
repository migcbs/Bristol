import { auth } from "@/lib/auth";
import { getCampusScope, leadScopeWhere } from "@/lib/campus-scope";
import { prisma } from "@/lib/prisma";
import type { LeadStatus, Role } from "@prisma/client";

const VALID_STATUSES: LeadStatus[] = ["NEW", "CONTACTED", "PLACEMENT_SCHEDULED", "ENROLLED", "LOST"];

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }
  const role = (session.user as { role: Role }).role;
  if (role !== "ADMIN" && role !== "STAFF") {
    return Response.json({ error: "No autorizado" }, { status: 403 });
  }

  const scope = await getCampusScope(session.user as { id: string; role: Role });
  const where = leadScopeWhere(scope);

  const leads = await prisma.lead.findMany({ where, orderBy: { createdAt: "asc" } });
  return Response.json(leads);
}

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }
  const role = (session.user as { role: Role }).role;
  if (role !== "ADMIN" && role !== "STAFF") {
    return Response.json({ error: "No autorizado" }, { status: 403 });
  }

  let body: { id?: string; status?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Cuerpo de la solicitud inválido" }, { status: 400 });
  }

  if (!body.id || !body.status || !VALID_STATUSES.includes(body.status as LeadStatus)) {
    return Response.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const scope = await getCampusScope(session.user as { id: string; role: Role });
  const where = leadScopeWhere(scope);

  const { count } = await prisma.lead.updateMany({
    where: { id: body.id, ...where },
    data: { status: body.status as LeadStatus },
  });

  if (count === 0) {
    return Response.json({ error: "No encontrado" }, { status: 404 });
  }

  return Response.json({ id: body.id, status: body.status as LeadStatus });
}
