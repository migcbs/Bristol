import { prisma } from "@/lib/prisma";
import type { Role, StaffPosition } from "@prisma/client";

export type Module =
  | "busqueda"
  | "alta_rapida"
  | "lista_espera"
  | "agenda"
  | "bitacora"
  | "admisiones"
  | "mercadotecnia"
  | "cobranzas"
  | "disponibilidad"
  | "reinscripciones"
  | "solicitudes"
  | "incidencias"
  | "calificaciones_bloque"
  | "comunicaciones"
  | "tickets";

export type AccessLevel = "full" | "read" | "initiate" | "none";

/**
 * The full matrix from docs/superpowers/specs/2026-08-29-roles-permissions-design.md,
 * confirmed with the user on 2026-08-29. ADMIN and a STAFF user with no
 * staffPosition are handled separately in hasModuleAccess() below — this
 * table only covers the six real puestos.
 */
const MODULE_ACCESS: Record<StaffPosition, Record<Module, AccessLevel>> = {
  RECEPCION: {
    busqueda: "full",
    alta_rapida: "full",
    lista_espera: "full",
    agenda: "full",
    bitacora: "full",
    admisiones: "read",
    mercadotecnia: "none",
    cobranzas: "initiate",
    disponibilidad: "full",
    reinscripciones: "none",
    solicitudes: "initiate",
    incidencias: "read",
    calificaciones_bloque: "none",
    comunicaciones: "read",
    tickets: "full",
  },
  CAJA: {
    busqueda: "full",
    alta_rapida: "none",
    lista_espera: "none",
    agenda: "none",
    bitacora: "none",
    admisiones: "none",
    mercadotecnia: "none",
    cobranzas: "full",
    disponibilidad: "none",
    reinscripciones: "none",
    solicitudes: "none",
    incidencias: "none",
    calificaciones_bloque: "none",
    comunicaciones: "none",
    tickets: "full",
  },
  CONTROL_ESCOLAR: {
    busqueda: "full",
    alta_rapida: "none",
    lista_espera: "none",
    agenda: "none",
    bitacora: "none",
    admisiones: "none",
    mercadotecnia: "none",
    cobranzas: "none",
    disponibilidad: "full",
    reinscripciones: "full",
    solicitudes: "full",
    incidencias: "read",
    calificaciones_bloque: "full",
    comunicaciones: "none",
    tickets: "full",
  },
  COMERCIAL: {
    busqueda: "full",
    alta_rapida: "none",
    lista_espera: "full",
    agenda: "full",
    bitacora: "none",
    admisiones: "full",
    mercadotecnia: "full",
    cobranzas: "none",
    disponibilidad: "read",
    reinscripciones: "none",
    solicitudes: "none",
    incidencias: "none",
    calificaciones_bloque: "none",
    comunicaciones: "full",
    tickets: "full",
  },
  CALIDAD_CONTROL: {
    busqueda: "full",
    alta_rapida: "none",
    lista_espera: "none",
    agenda: "none",
    bitacora: "read",
    admisiones: "read",
    mercadotecnia: "read",
    cobranzas: "read",
    disponibilidad: "none",
    reinscripciones: "read",
    solicitudes: "full",
    incidencias: "full",
    calificaciones_bloque: "read",
    comunicaciones: "full",
    tickets: "full",
  },
  DIRECCION_CAMPUS: {
    busqueda: "full",
    alta_rapida: "full",
    lista_espera: "read",
    agenda: "read",
    bitacora: "full",
    admisiones: "full",
    mercadotecnia: "full",
    cobranzas: "read",
    disponibilidad: "read",
    reinscripciones: "read",
    solicitudes: "full",
    incidencias: "read",
    calificaciones_bloque: "read",
    comunicaciones: "full",
    tickets: "full",
  },
};

/**
 * Fail-closed module access check for the admin panel. ADMIN always gets
 * "full" without a DB round-trip. Any other role (TEACHER/STUDENT/PARENT)
 * gets "none" — this function is only meaningful for the admin panel.
 * A STAFF user with no staffPosition assigned gets "none" on everything,
 * same fail-closed default as getCampusScope/leadScopeWhere elsewhere in
 * this codebase, until Dirección de Campus assigns them a puesto.
 */
export async function hasModuleAccess(
  user: { id: string; role: Role },
  module: Module
): Promise<AccessLevel> {
  if (user.role === "ADMIN") return "full";
  if (user.role !== "STAFF") return "none";

  const staffUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { staffPosition: true },
  });
  if (!staffUser?.staffPosition) return "none";

  return MODULE_ACCESS[staffUser.staffPosition][module];
}
