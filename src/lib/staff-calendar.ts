import { prisma } from "@/lib/prisma";
import type { Role, StaffPosition } from "@prisma/client";

export const CALENDAR_AREAS: StaffPosition[] = [
  "RECEPCION",
  "CAJA",
  "CONTROL_ESCOLAR",
  "COMERCIAL",
  "CALIDAD_CONTROL",
  "DIRECCION_CAMPUS",
];

export interface CalendarAccess {
  /** Áreas whose events this user may READ. */
  areas: StaffPosition[];
  /** May this user create/edit events for ANY área (ADMIN, Dirección)? */
  canManageAll: boolean;
  /** This user's own área — the only one a regular puesto may write to. */
  ownArea: StaffPosition | null;
}

// Gates who may read/write StaffCalendarEvent rows by área. The user's
// model (2026-09-09): "cada área tiene su universo de trabajo
// independiente" — a regular puesto only touches its own área's events
// (surfaced today inside that área's own screen, e.g. Recepción's
// Agenda). ADMIN and Dirección de Campus may write any área; Dirección is
// still bounded to its campus through the normal campus scope on the
// campusId field.
export async function getCalendarAccess(user: { id: string; role: Role }): Promise<CalendarAccess> {
  if (user.role === "ADMIN") {
    return { areas: CALENDAR_AREAS, canManageAll: true, ownArea: null };
  }
  if (user.role !== "STAFF") {
    return { areas: [], canManageAll: false, ownArea: null };
  }
  const row = await prisma.user.findUnique({ where: { id: user.id }, select: { staffPosition: true } });
  if (!row?.staffPosition) {
    return { areas: [], canManageAll: false, ownArea: null };
  }
  if (row.staffPosition === "DIRECCION_CAMPUS") {
    return { areas: CALENDAR_AREAS, canManageAll: true, ownArea: "DIRECCION_CAMPUS" };
  }
  return { areas: [row.staffPosition], canManageAll: false, ownArea: row.staffPosition };
}

export function canWriteArea(access: CalendarAccess, area: StaffPosition): boolean {
  return access.canManageAll || access.ownArea === area;
}
