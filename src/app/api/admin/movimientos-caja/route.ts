import { auth } from "@/lib/auth";
import { getCampusScope } from "@/lib/campus-scope";
import { hasModuleAccess } from "@/lib/staff-permissions";
import { prisma } from "@/lib/prisma";
import type { CashMovementType, Prisma } from "@prisma/client";

function assertAdminOrStaff(role: string) {
  return role === "ADMIN" || role === "STAFF";
}

const VALID_TIPOS: CashMovementType[] = ["ENTRADA", "SALIDA"];

// Gated by the dedicated "recursos_caja" module (Caja-only), same as
// Recursos Materiales — see that route's comment.
function campusWhere(scope: Awaited<ReturnType<typeof getCampusScope>>): Prisma.CashMovementWhereInput {
  if (scope.type === "ALL") return {};
  if (scope.type === "CAMPUS_LIST") return { campusId: { in: scope.campusIds } };
  return { id: { in: [] } };
}

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }
  const role = (session.user as { role: string }).role;
  if (!assertAdminOrStaff(role)) {
    return Response.json({ error: "No autorizado" }, { status: 403 });
  }

  const access = await hasModuleAccess(session.user as { id: string; role: any }, "recursos_caja");
  if (access === "none") {
    return Response.json({ error: "No autorizado" }, { status: 403 });
  }

  const scope = await getCampusScope(session.user as { id: string; role: any });
  const movimientos = await prisma.cashMovement.findMany({
    where: campusWhere(scope),
    orderBy: { createdAt: "desc" },
    include: { campus: true, createdBy: { select: { name: true } } },
  });
  return Response.json(movimientos);
}

// Manual entries only — a movement tied to an invoice payment is created
// automatically by PATCH /api/admin/invoices/[id] (mark-paid), never here.
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }
  const role = (session.user as { role: string }).role;
  if (!assertAdminOrStaff(role)) {
    return Response.json({ error: "No autorizado" }, { status: 403 });
  }

  const access = await hasModuleAccess(session.user as { id: string; role: any }, "recursos_caja");
  if (access !== "full" && access !== "initiate") {
    return Response.json({ error: "No autorizado" }, { status: 403 });
  }

  let body: { campusId?: string; tipo?: string; concepto?: string; montoCents?: number };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Cuerpo de la solicitud inválido" }, { status: 400 });
  }

  const concepto = body.concepto?.trim();
  if (
    !body.campusId ||
    !body.tipo ||
    !VALID_TIPOS.includes(body.tipo as CashMovementType) ||
    !concepto ||
    concepto.length > 200 ||
    typeof body.montoCents !== "number" ||
    !Number.isSafeInteger(body.montoCents) ||
    body.montoCents <= 0
  ) {
    return Response.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const scope = await getCampusScope(session.user as { id: string; role: any });
  const inScope = scope.type === "ALL" || (scope.type === "CAMPUS_LIST" && scope.campusIds.includes(body.campusId));
  if (!inScope) {
    return Response.json({ error: "Plantel fuera de tu alcance" }, { status: 403 });
  }

  // A manual movement is also a día-de-caja event — requires the same
  // open session the POS sale and invoice mark-paid routes do, so the
  // corte/cierre totals never miss one.
  const cashSession = await prisma.cashRegisterSession.findFirst({
    where: { campusId: body.campusId, status: "ABIERTA" },
  });
  if (!cashSession) {
    return Response.json({ error: "Abre la caja de este plantel antes de registrar un movimiento" }, { status: 400 });
  }

  const movimiento = await prisma.cashMovement.create({
    data: {
      campusId: body.campusId,
      tipo: body.tipo as CashMovementType,
      concepto,
      montoCents: body.montoCents,
      cashRegisterSessionId: cashSession.id,
      createdById: session.user.id as string,
    },
  });
  return Response.json(movimiento, { status: 201 });
}
