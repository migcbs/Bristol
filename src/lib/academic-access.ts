import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";

/**
 * Group ids a portal user (TEACHER/STUDENT/PARENT) may READ from —
 * schedule and materials live at the Group level. Writes never use this:
 * a TEACHER's write authority is always checked directly against
 * Group.teacherId, per the pattern established in Gestión Escolar.
 */
export async function getVisibleGroupIds(user: { id: string; role: Role }): Promise<string[]> {
  switch (user.role) {
    case "TEACHER": {
      const rows = await prisma.group.findMany({
        where: { teacherId: user.id },
        select: { id: true },
      });
      return rows.map((r) => r.id);
    }
    case "STUDENT": {
      const student = await prisma.student.findUnique({
        where: { userId: user.id },
        select: { id: true },
      });
      if (!student) return [];
      const rows = await prisma.enrollment.findMany({
        where: { studentId: student.id, completedAt: null },
        select: { groupId: true },
      });
      return [...new Set(rows.map((r) => r.groupId))];
    }
    case "PARENT": {
      const rows = await prisma.enrollment.findMany({
        where: { completedAt: null, student: { parentLinks: { some: { parentUserId: user.id } } } },
        select: { groupId: true },
      });
      return [...new Set(rows.map((r) => r.groupId))];
    }
    default:
      return [];
  }
}

/**
 * Enrollment ids a portal user may READ grades from. Same role logic as
 * getVisibleGroupIds, but resolved directly to Enrollment ids since
 * Grade is keyed on enrollmentId, not groupId.
 */
export async function getVisibleEnrollmentIds(user: { id: string; role: Role }): Promise<string[]> {
  switch (user.role) {
    case "TEACHER": {
      const rows = await prisma.enrollment.findMany({
        where: { group: { teacherId: user.id } },
        select: { id: true },
      });
      return rows.map((r) => r.id);
    }
    case "STUDENT": {
      const student = await prisma.student.findUnique({
        where: { userId: user.id },
        select: { id: true },
      });
      if (!student) return [];
      const rows = await prisma.enrollment.findMany({
        where: { studentId: student.id },
        select: { id: true },
      });
      return rows.map((r) => r.id);
    }
    case "PARENT": {
      const rows = await prisma.enrollment.findMany({
        where: { student: { parentLinks: { some: { parentUserId: user.id } } } },
        select: { id: true },
      });
      return rows.map((r) => r.id);
    }
    default:
      return [];
  }
}
