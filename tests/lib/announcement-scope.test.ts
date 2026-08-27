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
  resolveAnnouncementRecipients,
} from "@/lib/announcement-scope";

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
