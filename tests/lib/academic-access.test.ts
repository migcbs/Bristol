import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    group: { findMany: vi.fn() },
    student: { findUnique: vi.fn() },
    enrollment: { findMany: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { getVisibleGroupIds, getVisibleEnrollmentIds } from "@/lib/academic-access";

describe("getVisibleGroupIds", () => {
  beforeEach(() => vi.clearAllMocks());

  it("TEACHER sees their own groups", async () => {
    (prisma.group.findMany as any).mockResolvedValue([{ id: "g1" }, { id: "g2" }]);
    const ids = await getVisibleGroupIds({ id: "t1", role: "TEACHER" as any });
    expect(prisma.group.findMany).toHaveBeenCalledWith({ where: { teacherId: "t1" }, select: { id: true } });
    expect(ids).toEqual(["g1", "g2"]);
  });

  it("STUDENT sees groups of their own active enrollments", async () => {
    (prisma.student.findUnique as any).mockResolvedValue({ id: "s1" });
    (prisma.enrollment.findMany as any).mockResolvedValue([{ groupId: "g1" }, { groupId: "g1" }]);
    const ids = await getVisibleGroupIds({ id: "u1", role: "STUDENT" as any });
    expect(prisma.enrollment.findMany).toHaveBeenCalledWith({
      where: { studentId: "s1", completedAt: null },
      select: { groupId: true },
    });
    expect(ids).toEqual(["g1"]);
  });

  it("STUDENT with no Student record returns an empty array", async () => {
    (prisma.student.findUnique as any).mockResolvedValue(null);
    const ids = await getVisibleGroupIds({ id: "u1", role: "STUDENT" as any });
    expect(ids).toEqual([]);
  });

  it("PARENT sees groups of all their children's active enrollments, deduplicated", async () => {
    (prisma.enrollment.findMany as any).mockResolvedValue([{ groupId: "g1" }, { groupId: "g2" }, { groupId: "g1" }]);
    const ids = await getVisibleGroupIds({ id: "p1", role: "PARENT" as any });
    expect(prisma.enrollment.findMany).toHaveBeenCalledWith({
      where: { completedAt: null, student: { parentLinks: { some: { parentUserId: "p1" } } } },
      select: { groupId: true },
    });
    expect(ids.sort()).toEqual(["g1", "g2"]);
  });

  it("ADMIN/STAFF get an empty array (not portal viewers)", async () => {
    expect(await getVisibleGroupIds({ id: "a1", role: "ADMIN" as any })).toEqual([]);
    expect(await getVisibleGroupIds({ id: "s1", role: "STAFF" as any })).toEqual([]);
  });
});

describe("getVisibleEnrollmentIds", () => {
  beforeEach(() => vi.clearAllMocks());

  it("TEACHER sees active enrollments in their own groups", async () => {
    (prisma.enrollment.findMany as any).mockResolvedValue([{ id: "e1" }]);
    const ids = await getVisibleEnrollmentIds({ id: "t1", role: "TEACHER" as any });
    expect(prisma.enrollment.findMany).toHaveBeenCalledWith({
      where: { completedAt: null, group: { teacherId: "t1" } },
      select: { id: true },
    });
    expect(ids).toEqual(["e1"]);
  });

  it("STUDENT sees their own active enrollments", async () => {
    (prisma.student.findUnique as any).mockResolvedValue({ id: "s1" });
    (prisma.enrollment.findMany as any).mockResolvedValue([{ id: "e1" }]);
    const ids = await getVisibleEnrollmentIds({ id: "u1", role: "STUDENT" as any });
    expect(prisma.enrollment.findMany).toHaveBeenCalledWith({
      where: { studentId: "s1", completedAt: null },
      select: { id: true },
    });
    expect(ids).toEqual(["e1"]);
  });

  it("PARENT sees active enrollments of all their children", async () => {
    (prisma.enrollment.findMany as any).mockResolvedValue([{ id: "e1" }, { id: "e2" }]);
    const ids = await getVisibleEnrollmentIds({ id: "p1", role: "PARENT" as any });
    expect(prisma.enrollment.findMany).toHaveBeenCalledWith({
      where: { completedAt: null, student: { parentLinks: { some: { parentUserId: "p1" } } } },
      select: { id: true },
    });
    expect(ids).toEqual(["e1", "e2"]);
  });

  it("ADMIN/STAFF get an empty array", async () => {
    expect(await getVisibleEnrollmentIds({ id: "a1", role: "ADMIN" as any })).toEqual([]);
  });
});
