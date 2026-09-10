import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Module } from "@/lib/staff-permissions";
import type { Role } from "@prisma/client";

// The set of modules ADMIN is allowed to grant one-off — deliberately not
// every Module: this is meant for genuinely puesto-independent grants
// (today: Reseñas), not a backdoor around the puesto matrix for modules
// that already have a clear owning área.
const GRANTABLE_MODULES: Module[] = ["resenas"];

// ADMIN-only: grants or revokes one Module for one specific STAFF account,
// independent of their puesto — see the `extraModuleAccess` comment on
// User in prisma/schema.prisma and hasModuleAccess() in
// src/lib/staff-permissions.ts. Modeled after the custom per-account
// permission grants in Cibercom's SistemaEmpleados (confirmed with the
// user 2026-09-09).
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }
  const role = (session.user as { role: Role }).role;
  if (role !== "ADMIN") {
    return Response.json({ error: "No autorizado" }, { status: 403 });
  }

  let body: { module?: string; grant?: boolean };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Cuerpo de la solicitud inválido" }, { status: 400 });
  }

  if (!body.module || !GRANTABLE_MODULES.includes(body.module as Module) || typeof body.grant !== "boolean") {
    return Response.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const { id } = await context.params;
  const target = await prisma.user.findUnique({ where: { id }, select: { role: true, extraModuleAccess: true } });
  if (!target || target.role !== "STAFF") {
    return Response.json({ error: "No encontrado" }, { status: 404 });
  }

  const current = new Set(target.extraModuleAccess);
  if (body.grant) {
    current.add(body.module);
  } else {
    current.delete(body.module);
  }

  const updated = await prisma.user.update({
    where: { id },
    data: { extraModuleAccess: [...current] },
    select: { id: true, extraModuleAccess: true },
  });

  return Response.json(updated);
}
