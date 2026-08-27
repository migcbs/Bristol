import { prisma } from "@/lib/prisma";
import type { Prisma, Role } from "@prisma/client";

/**
 * Campus ids relevant to a portal user (TEACHER/STUDENT/PARENT) for
 * matching CAMPUS-audience announcements. Distinct from the admin-side
 * getCampusScope in campus-scope.ts: getCampusScope returns NONE for
 * PARENT (a parent manages nothing), but a parent must still see CAMPUS
 * announcements for any of their children's campuses. Do not conflate
 * the two — they answer different questions ("what can I manage" vs.
 * "what's relevant to me").
 */
export async function getRecipientCampusIds(user: { id: string; role: Role }): Promise<string[]> {
  switch (user.role) {
    case "TEACHER": {
      const rows = await prisma.teacherCampus.findMany({
        where: { userId: user.id },
        select: { campusId: true },
      });
      return rows.map((r) => r.campusId);
    }
    case "STUDENT": {
      const student = await prisma.student.findUnique({
        where: { userId: user.id },
        select: { campusId: true },
      });
      return student ? [student.campusId] : [];
    }
    case "PARENT": {
      const rows = await prisma.parentStudent.findMany({
        where: { parentUserId: user.id },
        select: { student: { select: { campusId: true } } },
      });
      return [...new Set(rows.map((r) => r.student.campusId))];
    }
    default:
      return [];
  }
}

/**
 * Builds the Prisma `where` clause matching every announcement that
 * reaches this user: always ALL and their own ROLE, plus CAMPUS
 * announcements for any campus in `campusIds` when non-empty.
 */
export function announcementAudienceWhere(
  user: { role: Role },
  campusIds: string[]
): Prisma.AnnouncementWhereInput {
  const or: Prisma.AnnouncementWhereInput[] = [
    { audience: "ALL" },
    { audience: "ROLE", role: user.role },
  ];
  if (campusIds.length > 0) {
    or.push({ audience: "CAMPUS", campusId: { in: campusIds } });
  }
  return { OR: or };
}

/**
 * Builds the Prisma `where` clause for the admin-side announcement list:
 * an ADMIN sees every announcement, while STAFF sees only the ones they
 * created plus any ALL-audience announcement.
 */
export function announcementAdminListWhere(user: { id: string; role: Role }): Prisma.AnnouncementWhereInput {
  return user.role === "ADMIN" ? {} : { OR: [{ createdById: user.id }, { audience: "ALL" }] };
}

/**
 * Inverse direction: given an announcement, resolves the concrete list
 * of users it reaches, for email sending. CAMPUS recipients are the
 * union of TEACHER/STUDENT/PARENT at that campus (not Staff/Admin —
 * announcements are addressed to the school community, not to the
 * people administering it), deduplicated by user id.
 */
export async function resolveAnnouncementRecipients(announcement: {
  audience: "ALL" | "CAMPUS" | "ROLE";
  campusId: string | null;
  role: Role | null;
}): Promise<{ id: string; email: string }[]> {
  if (announcement.audience === "ALL") {
    return prisma.user.findMany({ select: { id: true, email: true } });
  }

  if (announcement.audience === "ROLE") {
    return prisma.user.findMany({
      where: { role: announcement.role! },
      select: { id: true, email: true },
    });
  }

  const campusId = announcement.campusId!;
  const [teacherRows, studentRows, parentRows] = await Promise.all([
    prisma.teacherCampus.findMany({
      where: { campusId },
      select: { user: { select: { id: true, email: true } } },
    }),
    prisma.student.findMany({
      where: { campusId },
      select: { user: { select: { id: true, email: true } } },
    }),
    prisma.parentStudent.findMany({
      where: { student: { campusId } },
      select: { parent: { select: { id: true, email: true } } },
    }),
  ]);

  const byId = new Map<string, { id: string; email: string }>();
  for (const row of teacherRows) byId.set(row.user.id, row.user);
  for (const row of studentRows) byId.set(row.user.id, row.user);
  for (const row of parentRows) byId.set(row.parent.id, row.parent);

  return [...byId.values()];
}
