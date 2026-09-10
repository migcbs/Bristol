import { auth } from "@/lib/auth";
import { getCampusScope, leadScopeWhere } from "@/lib/campus-scope";
import { hasModuleAccess } from "@/lib/staff-permissions";
import { prisma } from "@/lib/prisma";
import type { InterestType, LeadStatus, Role } from "@prisma/client";

const VALID_STATUSES: LeadStatus[] = ["NEW", "CONTACTED", "PLACEMENT_SCHEDULED", "ENROLLED", "LOST"];
const VALID_INTEREST_TYPES: InterestType[] = ["CURSO_REGULAR", "TALLER_CONVERSACION", "CERTIFICACION"];
const MAX_NOTE_LENGTH = 2000;
const MAX_PHONE_LENGTH = 30;

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }
  const role = (session.user as { role: Role }).role;
  if (role !== "ADMIN" && role !== "STAFF") {
    return Response.json({ error: "No autorizado" }, { status: 403 });
  }

  // This route previously had no module check at all — any STAFF account
  // could read the waitlist regardless of puesto. Lista de Espera is
  // Comercial's (confirmed with the user 2026-09-09); gating it here for
  // the first time.
  const access = await hasModuleAccess(session.user as { id: string; role: Role }, "lista_espera");
  if (access === "none") {
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

  const access = await hasModuleAccess(session.user as { id: string; role: Role }, "lista_espera");
  if (access !== "full") {
    return Response.json({ error: "No autorizado" }, { status: 403 });
  }

  let body: { id?: string; status?: string; phone?: string; interestType?: string; notasBitacora?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Cuerpo de la solicitud inválido" }, { status: 400 });
  }

  if (!body.id) {
    return Response.json({ error: "Datos inválidos" }, { status: 400 });
  }
  if (body.status !== undefined && !VALID_STATUSES.includes(body.status as LeadStatus)) {
    return Response.json({ error: "Estatus inválido" }, { status: 400 });
  }
  if (body.interestType !== undefined && body.interestType !== "" && !VALID_INTEREST_TYPES.includes(body.interestType as InterestType)) {
    return Response.json({ error: "Tipo de interés inválido" }, { status: 400 });
  }
  if (body.phone !== undefined && body.phone.length > MAX_PHONE_LENGTH) {
    return Response.json({ error: "El teléfono excede la longitud permitida" }, { status: 400 });
  }
  if (body.notasBitacora !== undefined && body.notasBitacora.length > MAX_NOTE_LENGTH) {
    return Response.json({ error: "Las notas exceden la longitud permitida" }, { status: 400 });
  }

  const scope = await getCampusScope(session.user as { id: string; role: Role });
  const where = leadScopeWhere(scope);

  const { count } = await prisma.lead.updateMany({
    where: { id: body.id, ...where },
    data: {
      ...(body.status !== undefined && { status: body.status as LeadStatus }),
      ...(body.phone !== undefined && { phone: body.phone || null }),
      ...(body.interestType !== undefined && { interestType: (body.interestType || null) as InterestType | null }),
      ...(body.notasBitacora !== undefined && { notasBitacora: body.notasBitacora || null }),
    },
  });

  if (count === 0) {
    return Response.json({ error: "No encontrado" }, { status: 404 });
  }

  const lead = await prisma.lead.findUnique({ where: { id: body.id } });
  return Response.json(lead);
}
