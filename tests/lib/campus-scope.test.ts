import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    staffCampus: { findMany: vi.fn() },
    teacherCampus: { findMany: vi.fn() },
    student: { findUnique: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { getCampusScope } from "@/lib/campus-scope";

describe("getCampusScope", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns ALL for ADMIN", async () => {
    const scope = await getCampusScope({ id: "u1", role: "ADMIN" });
    expect(scope).toEqual({ type: "ALL" });
  });

  it("returns CAMPUS_LIST for STAFF from StaffCampus", async () => {
    (prisma.staffCampus.findMany as any).mockResolvedValue([
      { campusId: "c1" },
      { campusId: "c2" },
    ]);
    const scope = await getCampusScope({ id: "u2", role: "STAFF" });
    expect(scope).toEqual({ type: "CAMPUS_LIST", campusIds: ["c1", "c2"] });
  });

  it("returns CAMPUS_LIST for TEACHER from TeacherCampus", async () => {
    (prisma.teacherCampus.findMany as any).mockResolvedValue([{ campusId: "c3" }]);
    const scope = await getCampusScope({ id: "u3", role: "TEACHER" });
    expect(scope).toEqual({ type: "CAMPUS_LIST", campusIds: ["c3"] });
  });

  it("returns SINGLE_CAMPUS for STUDENT from Student.campusId", async () => {
    (prisma.student.findUnique as any).mockResolvedValue({ campusId: "c4" });
    const scope = await getCampusScope({ id: "u4", role: "STUDENT" });
    expect(scope).toEqual({ type: "SINGLE_CAMPUS", campusId: "c4" });
  });

  it("returns NONE for PARENT", async () => {
    const scope = await getCampusScope({ id: "u5", role: "PARENT" });
    expect(scope).toEqual({ type: "NONE" });
  });
});
