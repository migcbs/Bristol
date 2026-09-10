import { auth } from "@/lib/auth";
import { hasModuleAccess } from "@/lib/staff-permissions";
import { prisma } from "@/lib/prisma";

function assertAdminOrStaff(role: string) {
  return role === "ADMIN" || role === "STAFF";
}

// Reuses the "cobranzas" module gate — the catalog only exists to feed the
// invoice-creation popup, so whoever can create invoices can manage it too.
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }
  const role = (session.user as { role: string }).role;
  if (!assertAdminOrStaff(role)) {
    return Response.json({ error: "No autorizado" }, { status: 403 });
  }

  const access = await hasModuleAccess(session.user as { id: string; role: any }, "cobranzas");
  if (access === "none") {
    return Response.json({ error: "No autorizado" }, { status: 403 });
  }

  const conceptos = await prisma.conceptoPago.findMany({
    where: { activo: true },
    orderBy: { nombre: "asc" },
  });
  return Response.json(conceptos);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }
  const role = (session.user as { role: string }).role;
  if (!assertAdminOrStaff(role)) {
    return Response.json({ error: "No autorizado" }, { status: 403 });
  }

  const access = await hasModuleAccess(session.user as { id: string; role: any }, "cobranzas");
  if (access !== "full" && access !== "initiate") {
    return Response.json({ error: "No autorizado" }, { status: 403 });
  }

  let body: { nombre?: string; montoDefaultCents?: number | null };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Cuerpo de la solicitud inválido" }, { status: 400 });
  }

  const nombre = body.nombre?.trim();
  if (!nombre || nombre.length > 100) {
    return Response.json({ error: "Nombre inválido" }, { status: 400 });
  }
  if (
    body.montoDefaultCents !== undefined &&
    body.montoDefaultCents !== null &&
    (!Number.isSafeInteger(body.montoDefaultCents) || body.montoDefaultCents <= 0)
  ) {
    return Response.json({ error: "Monto por default inválido" }, { status: 400 });
  }

  const existing = await prisma.conceptoPago.findUnique({ where: { nombre } });
  if (existing) {
    return Response.json({ error: "Ya existe un concepto con ese nombre" }, { status: 409 });
  }

  const concepto = await prisma.conceptoPago.create({
    data: { nombre, montoDefaultCents: body.montoDefaultCents ?? null },
  });
  return Response.json(concepto, { status: 201 });
}
