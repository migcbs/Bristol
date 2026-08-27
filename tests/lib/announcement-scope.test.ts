import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    teacherCampus: { findMany: vi.fn() },
    student: { findUnique: vi.fn(), findMany: vi.fn() },
    parentStudent: { findMany: vi.fn() },
    user: { findMany: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import {
  getRecipientCampusIds,
  announcementAudienceWhere,
  announcementAdminListWhere,
  resolveAnnouncementRecipients,
} from "@/lib/announcement-scope";

/**
 * Simulates Prisma's OR/equality semantics for the fields the where-clause
 * actually uses, so we can assert an announcement is provably excluded
 * rather than just asserting the where-clause's shape.
 */
function matches(
  announcement: { audience: string; role?: string | null; campusId?: string | null },
  where: { OR?: Array<Record<string, unknown>> }
): boolean {
  return (where.OR ?? []).some((clause) => {
    if (clause.audience !== announcement.audience) return false;
    if ("role" in clause && clause.role !== announcement.role) return false;
    if ("campusId" in clause) {
      const campusClause = clause.campusId as { in: string[] };
      if (!announcement.campusId || !campusClause.in.includes(announcement.campusId)) return false;
    }
    return true;
  });
}

describe("getRecipientCampusIds", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns TeacherCampus campus ids for TEACHER", async () => {
    (prisma.teacherCampus.findMany as any).mockResolvedValue([{ campusId: "c1" }, { campusId: "c2" }]);
    const ids = await getRecipientCampusIds({ id: "t1", role: "TEACHER" as any });
    expect(ids).toEqual(["c1", "c2"]);
  });

  it("returns the student's own campus for STUDENT", async () => {
    (prisma.student.findUnique as any).mockResolvedValue({ campusId: "c1" });
    const ids = await getRecipientCampusIds({ id: "s1", role: "STUDENT" as any });
    expect(ids).toEqual(["c1"]);
  });

  it("returns an empty array for STUDENT with no Student record", async () => {
    (prisma.student.findUnique as any).mockResolvedValue(null);
    const ids = await getRecipientCampusIds({ id: "s1", role: "STUDENT" as any });
    expect(ids).toEqual([]);
  });

  it("returns deduplicated campus ids across all children for PARENT", async () => {
    (prisma.parentStudent.findMany as any).mockResolvedValue([
      { student: { campusId: "c1" } },
      { student: { campusId: "c1" } },
      { student: { campusId: "c2" } },
    ]);
    const ids = await getRecipientCampusIds({ id: "p1", role: "PARENT" as any });
    expect(ids.sort()).toEqual(["c1", "c2"]);
  });

  it("returns an empty array for ADMIN/STAFF (not portal recipients)", async () => {
    expect(await getRecipientCampusIds({ id: "a1", role: "ADMIN" as any })).toEqual([]);
    expect(await getRecipientCampusIds({ id: "st1", role: "STAFF" as any })).toEqual([]);
  });
});

describe("announcementAudienceWhere", () => {
  it("always includes ALL and this user's ROLE", () => {
    const where = announcementAudienceWhere({ role: "TEACHER" as any }, []);
    expect(where).toEqual({
      OR: [{ audience: "ALL" }, { audience: "ROLE", role: "TEACHER" }],
    });
  });

  it("includes a CAMPUS clause when campusIds is non-empty", () => {
    const where = announcementAudienceWhere({ role: "STUDENT" as any }, ["c1", "c2"]);
    expect(where).toEqual({
      OR: [
        { audience: "ALL" },
        { audience: "ROLE", role: "STUDENT" },
        { audience: "CAMPUS", campusId: { in: ["c1", "c2"] } },
      ],
    });
  });

  it("excludes announcements outside this user's audience (negative case)", () => {
    const where = announcementAudienceWhere({ role: "TEACHER" as any }, ["c1"]);

    // A ROLE announcement addressed to a different role must not match.
    expect(matches({ audience: "ROLE", role: "STUDENT" }, where)).toBe(false);
    // A CAMPUS announcement for a campus this teacher isn't at must not match.
    expect(matches({ audience: "CAMPUS", campusId: "c2" }, where)).toBe(false);

    // Sanity check: things that SHOULD match still do, so `matches` isn't vacuously false.
    expect(matches({ audience: "ALL" }, where)).toBe(true);
    expect(matches({ audience: "ROLE", role: "TEACHER" }, where)).toBe(true);
    expect(matches({ audience: "CAMPUS", campusId: "c1" }, where)).toBe(true);
  });
});

describe("announcementAdminListWhere", () => {
  it("returns an empty where (sees everything) for ADMIN", () => {
    expect(announcementAdminListWhere({ id: "a1", role: "ADMIN" as any })).toEqual({});
  });

  it("returns own-announcements-plus-ALL for STAFF", () => {
    expect(announcementAdminListWhere({ id: "s1", role: "STAFF" as any })).toEqual({
      OR: [{ createdById: "s1" }, { audience: "ALL" }],
    });
  });
});

describe("resolveAnnouncementRecipients", () => {
  beforeEach(() => vi.clearAllMocks());

  it("ALL resolves to every user", async () => {
    (prisma.user.findMany as any).mockResolvedValue([{ id: "u1", email: "a@x.com" }]);
    const recipients = await resolveAnnouncementRecipients({ audience: "ALL", campusId: null, role: null });
    expect(prisma.user.findMany).toHaveBeenCalledWith({ select: { id: true, email: true } });
    expect(recipients).toEqual([{ id: "u1", email: "a@x.com" }]);
  });

  it("ROLE resolves to users of that role", async () => {
    (prisma.user.findMany as any).mockResolvedValue([{ id: "u1", email: "t@x.com" }]);
    const recipients = await resolveAnnouncementRecipients({ audience: "ROLE", campusId: null, role: "TEACHER" as any });
    expect(prisma.user.findMany).toHaveBeenCalledWith({
      where: { role: "TEACHER" },
      select: { id: true, email: true },
    });
    expect(recipients).toEqual([{ id: "u1", email: "t@x.com" }]);
  });

  it("CAMPUS resolves to the union of teachers, students, and parents at that campus, deduplicated", async () => {
    (prisma.teacherCampus.findMany as any).mockResolvedValue([
      { user: { id: "t1", email: "t1@x.com" } },
    ]);
    (prisma.student.findMany as any).mockResolvedValue([
      { user: { id: "s1", email: "s1@x.com" } },
    ]);
    (prisma.parentStudent.findMany as any).mockResolvedValue([
      { parent: { id: "p1", email: "p1@x.com" } },
      { parent: { id: "p1", email: "p1@x.com" } }, // two children, same parent
    ]);

    const recipients = await resolveAnnouncementRecipients({ audience: "CAMPUS", campusId: "c1", role: null });

    expect(recipients).toHaveLength(3);
    expect(recipients).toEqual(
      expect.arrayContaining([
        { id: "t1", email: "t1@x.com" },
        { id: "s1", email: "s1@x.com" },
        { id: "p1", email: "p1@x.com" },
      ])
    );
  });
});
