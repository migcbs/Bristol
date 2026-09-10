import { auth } from "@/lib/auth";
import { assertCampusInScope } from "@/lib/campus-scope";
import { hasModuleAccess } from "@/lib/staff-permissions";
import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";

// The "abrir caja" half of the cash-register flow the user asked for
// 2026-09-09: "la caja se debe poder abrir con cierta cantidad de
// efectivo teórico... y poder hacer corte de caja y cerrar la caja hasta
// el día siguiente". Gated by the same "recursos_caja" module Caja's
// inventory/ledger already use — Dirección de Campus keeps read-only
// oversight there, so this route requires strictly "full".
export async function POST(request: Request) {
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

  let body: { campusId?: string; openingCents?: number };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Cuerpo de la solicitud inválido" }, { status: 400 });
  }

  if (!body.campusId || !Number.isInteger(body.openingCents) || body.openingCents! < 0) {
    return Response.json({ error: "Datos inválidos" }, { status: 400 });
  }

  if (actor.role === "STAFF") {
    const inScope = await assertCampusInScope(actor, body.campusId);
    if (!inScope) {
      return Response.json({ error: "No autorizado" }, { status: 403 });
    }
  }

  const existing = await prisma.cashRegisterSession.findFirst({
    where: { campusId: body.campusId, status: "ABIERTA" },
  });
  if (existing) {
    return Response.json({ error: "Ya hay una caja abierta en este plantel" }, { status: 400 });
  }

  const cashSession = await prisma.cashRegisterSession.create({
    data: { campusId: body.campusId, openedById: actor.id, openingCents: body.openingCents! },
  });

  return Response.json(cashSession, { status: 201 });
}

// Looks up the currently open session for a campus, plus its live totals —
// used by the POS and the corte-de-caja screen to know whether the caja
// is open at all before letting Caja sell anything or log a movement.
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }
  const actor = session.user as { id: string; role: Role };
  if (actor.role !== "ADMIN" && actor.role !== "STAFF") {
    return Response.json({ error: "No autorizado" }, { status: 403 });
  }
  const access = await hasModuleAccess(actor, "recursos_caja");
  if (access === "none") {
    return Response.json({ error: "No autorizado" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const campusId = searchParams.get("campusId");
  if (!campusId) {
    return Response.json({ error: "Falta el plantel" }, { status: 400 });
  }
  if (actor.role === "STAFF") {
    const inScope = await assertCampusInScope(actor, campusId);
    if (!inScope) {
      return Response.json({ error: "No autorizado" }, { status: 403 });
    }
  }

  const active = await prisma.cashRegisterSession.findFirst({
    where: { campusId, status: "ABIERTA" },
    include: { movements: true, openedBy: { select: { name: true } } },
  });
  if (!active) {
    return Response.json({ session: null });
  }

  const entradas = active.movements.filter((m) => m.tipo === "ENTRADA").reduce((sum, m) => sum + m.montoCents, 0);
  const salidas = active.movements.filter((m) => m.tipo === "SALIDA").reduce((sum, m) => sum + m.montoCents, 0);

  return Response.json({
    session: {
      id: active.id,
      openedAt: active.openedAt,
      openedByName: active.openedBy.name,
      openingCents: active.openingCents,
      entradasCents: entradas,
      salidasCents: salidas,
      expectedCents: active.openingCents + entradas - salidas,
    },
  });
}
