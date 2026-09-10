import { prisma } from "@/lib/prisma";
import type { Role, StaffPosition } from "@prisma/client";

// Display label for the admin header's "BRISTOL <ÁREA>" (per the user's
// instruction 2026-09-09 — every área should see its own name there, not a
// generic "Admin"), and anywhere else a puesto needs a human label.
export const STAFF_POSITION_LABELS: Record<StaffPosition, string> = {
  RECEPCION: "Recepción",
  CAJA: "Caja",
  CONTROL_ESCOLAR: "Control Escolar",
  COMERCIAL: "Comercial",
  CALIDAD_CONTROL: "Calidad y Control",
  DIRECCION_CAMPUS: "Dirección de Campus",
};

export function getAreaLabel(role: Role, staffPosition: StaffPosition | null): string {
  if (role === "ADMIN") return "Admin";
  if (role === "STAFF") return staffPosition ? STAFF_POSITION_LABELS[staffPosition] : "Staff";
  return "";
}

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
  | "tickets"
  // Caja's inventory/ledger tools — split off from "cobranzas" 2026-09-09,
  // the same day Recepción's own "cobranzas" level was downgraded from
  // "initiate" to "read" (Caja is the only área that creates/collects
  // charges; Recepción just consults payment status) — Recursos Materiales
  // and Movimientos de Caja are Caja-only operational tools that had been
  // leaking to Recepción through the shared "cobranzas" gate.
  | "recursos_caja"
  // Control Escolar's internal material library — split off from the
  // shared "solicitudes" gate 2026-09-09 (that gate is about group-change
  // requests; Recepción's legitimate "initiate" there was also leaking
  // visibility into the material library, which is unrelated).
  | "biblioteca_material"
  // Comercial's ex-alumnos/directorio tools — split off from "admisiones"
  // 2026-09-09 so Recepción's "read" on admisiones (for lead handoff)
  // doesn't also surface Comercial's reengagement tooling.
  | "comercial_directorio"
  // Reseñas moderation — deliberately "none" for every puesto below. Access
  // is ADMIN plus whichever specific accounts ADMIN grants via
  // `User.extraModuleAccess` (see hasModuleAccess), not a puesto-wide gate —
  // confirmed with the user 2026-09-09, modeled after the custom
  // per-account permission grants in Cibercom's SistemaEmpleados.
  | "resenas"
  // Group creation/editing and teacher/student assignment — confirmed with
  // the user 2026-09-09: Dirección de Campus creates groups and can add
  // both students and teachers to them; Recepción's job stays limited to
  // adding students to an existing group (never creating a group or
  // touching its teacher). Distinct from "disponibilidad" (a read-only cupo
  // view several áreas already had) and from "solicitudes" (the
  // request/approval workflow for a student-initiated group change) — this
  // module is direct group management.
  | "grupos";

export type AccessLevel = "full" | "read" | "initiate" | "none";

/**
 * The full matrix from docs/superpowers/specs/2026-08-29-roles-permissions-design.md,
 * confirmed with the user on 2026-08-29 (plus the recursos_caja/
 * biblioteca_material/comercial_directorio/resenas additions confirmed
 * 2026-09-09). ADMIN and a STAFF user with no staffPosition are handled
 * separately in hasModuleAccess() below — this table only covers the six
 * real puestos.
 */
const MODULE_ACCESS: Record<StaffPosition, Record<Module, AccessLevel>> = {
  RECEPCION: {
    busqueda: "full",
    alta_rapida: "full",
    // Lista de Espera es del área Comercial (confirmed with the user
    // 2026-09-09) — Recepción no la opera, aunque la página siga viviendo
    // bajo /admin/recepcion/lista-espera por ahora (solo el nombre de la
    // carpeta, no el permiso, quedó desalineado — pendiente de renombrar).
    lista_espera: "none",
    agenda: "full",
    bitacora: "full",
    admisiones: "read",
    mercadotecnia: "none",
    // Cobranzas es de Caja — Recepción solo puede CONSULTAR el estatus del
    // pago, no crear cargos ni cobrarlos (confirmed with the user
    // 2026-09-09, downgraded from "initiate").
    cobranzas: "read",
    disponibilidad: "full",
    reinscripciones: "none",
    solicitudes: "initiate",
    incidencias: "read",
    calificaciones_bloque: "none",
    comunicaciones: "read",
    tickets: "full",
    recursos_caja: "none",
    biblioteca_material: "none",
    comercial_directorio: "none",
    resenas: "none",
    // Puede agregar alumnos a un grupo existente, no crear grupos ni tocar
    // al maestro (confirmed with the user 2026-09-09).
    grupos: "initiate",
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
    recursos_caja: "full",
    biblioteca_material: "none",
    comercial_directorio: "none",
    resenas: "none",
    grupos: "none",
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
    recursos_caja: "none",
    biblioteca_material: "full",
    comercial_directorio: "none",
    resenas: "none",
    // Visibilidad de los grupos (relevante para solicitudes de cambio de
    // grupo), no puede crearlos ni editarlos.
    grupos: "read",
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
    recursos_caja: "none",
    biblioteca_material: "none",
    comercial_directorio: "full",
    resenas: "none",
    // Preserva lo que Comercial ya podía ver en la extinta pantalla de
    // Disponibilidad (removida 2026-09-09 por duplicar a Grupos) — solo
    // consulta de cupo, sin poder crear grupos ni agregar alumnos.
    grupos: "read",
  },
  CALIDAD_CONTROL: {
    busqueda: "full",
    alta_rapida: "none",
    lista_espera: "none",
    agenda: "none",
    bitacora: "read",
    admisiones: "read",
    mercadotecnia: "read",
    // Cobranzas no es de Calidad y Control — quitado el 2026-09-09 (el
    // usuario reportó que la pastilla de Cobranzas seguía apareciendo fuera
    // de Admin/Recepción/Caja; "read" seguía contando como acceso para la
    // navegación).
    cobranzas: "none",
    disponibilidad: "none",
    reinscripciones: "read",
    solicitudes: "full",
    incidencias: "full",
    calificaciones_bloque: "read",
    comunicaciones: "full",
    tickets: "full",
    recursos_caja: "none",
    biblioteca_material: "none",
    comercial_directorio: "read",
    resenas: "none",
    // Visibilidad de grupos para auditar incidencias/solicitudes, sin poder
    // crearlos ni editarlos.
    grupos: "read",
  },
  DIRECCION_CAMPUS: {
    busqueda: "full",
    alta_rapida: "full",
    lista_espera: "read",
    agenda: "read",
    bitacora: "full",
    admisiones: "full",
    mercadotecnia: "full",
    // Cobranzas no es de Dirección de Campus — quitado el 2026-09-09, mismo
    // motivo que Calidad y Control arriba.
    cobranzas: "none",
    disponibilidad: "read",
    reinscripciones: "read",
    solicitudes: "full",
    incidencias: "read",
    calificaciones_bloque: "read",
    comunicaciones: "full",
    tickets: "full",
    recursos_caja: "read",
    biblioteca_material: "full",
    comercial_directorio: "full",
    resenas: "none",
    // Dirección crea los grupos y puede agregar tanto alumnos como maestros
    // (confirmed with the user 2026-09-09).
    grupos: "full",
  },
};

/**
 * Fail-closed module access check for the admin panel. ADMIN always gets
 * "full" without a DB round-trip. Any other role (TEACHER/STUDENT/PARENT)
 * gets "none" — this function is only meaningful for the admin panel.
 * A STAFF user with no staffPosition assigned gets "none" on everything
 * from the puesto matrix, same fail-closed default as
 * getCampusScope/leadScopeWhere elsewhere in this codebase, until Dirección
 * de Campus assigns them a puesto — but `extraModuleAccess` grants (see
 * below) still apply even without a puesto, since they're a targeted
 * override independent of it.
 *
 * `extraModuleAccess` is a small array of one-off Module grants an ADMIN
 * can hand a specific account regardless of their puesto — modeled after
 * the custom per-account permission grants in Cibercom's SistemaEmpleados
 * (confirmed with the user 2026-09-09). Today it's only offered for
 * "resenas" (see the admin Reseñas page), but it's a generic mechanism.
 * A grant always resolves to "full", never a downgrade.
 */
export async function hasModuleAccess(
  user: { id: string; role: Role },
  module: Module
): Promise<AccessLevel> {
  if (user.role === "ADMIN") return "full";
  if (user.role !== "STAFF") return "none";

  const staffUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { staffPosition: true, extraModuleAccess: true },
  });
  if (!staffUser) return "none";

  if (staffUser.extraModuleAccess.includes(module)) return "full";
  if (!staffUser.staffPosition) return "none";

  return MODULE_ACCESS[staffUser.staffPosition][module];
}
