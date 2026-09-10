import { auth } from "@/lib/auth";
import { assertCampusInScope } from "@/lib/campus-scope";
import { hasModuleAccess } from "@/lib/staff-permissions";
import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";

// "Corte de caja" + "cerrar la caja hasta el día siguiente" — Caja counts
// the physical cash in the drawer and enters it here; the response shows
// the theoretical total (apertura + entradas − salidas) next to what was
// actually counted, so a sobrante/faltante is visible immediately. The
// counted number is what gets saved — this never silently "corrects" the
// count to match the theoretical total.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }
  const actor = session.user as { id: string; role: Role };
  if (actor.role !== "ADMIN" && actor.role !== "STAFF") {
    return Response.json({ error: "No autorizado" }, { status: 403 });
  }
  const access = await hasModuleAccess(actor, "recursos_caja");
  if (access !== "full") {
    return Response.json({ error: "No autorizado" }, { status: 403 });
  }

  let body: { closingCountedCents?: number };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Cuerpo de la solicitud inválido" }, { status: 400 });
  }
  if (!Number.isInteger(body.closingCountedCents) || body.closingCountedCents! < 0) {
    return Response.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const { id } = await params;
  const cashSession = await prisma.cashRegisterSession.findUnique({
    where: { id },
    include: { movements: true },
  });
  if (!cashSession) {
    return Response.json({ error: "No encontrado" }, { status: 404 });
  }
  if (actor.role === "STAFF") {
    const inScope = await assertCampusInScope(actor, cashSession.campusId);
    if (!inScope) {
      return Response.json({ error: "No encontrado" }, { status: 404 });
    }
  }
  if (cashSession.status === "CERRADA") {
    return Response.json({ error: "Esta caja ya fue cerrada" }, { status: 400 });
  }

  const entradas = cashSession.movements.filter((m) => m.tipo === "ENTRADA").reduce((sum, m) => sum + m.montoCents, 0);
  const salidas = cashSession.movements.filter((m) => m.tipo === "SALIDA").reduce((sum, m) => sum + m.montoCents, 0);
  const expectedCents = cashSession.openingCents + entradas - salidas;

  const updated = await prisma.cashRegisterSession.update({
    where: { id },
    data: {
      status: "CERRADA",
      closedById: actor.id,
      closedAt: new Date(),
      closingCountedCents: body.closingCountedCents,
    },
  });

  return Response.json({
    ...updated,
    expectedCents,
    diffCents: body.closingCountedCents! - expectedCents,
  });
}
