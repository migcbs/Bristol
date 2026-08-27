import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    staffCampus: { findMany: vi.fn() },
    teacherCampus: { findMany: vi.fn() },
    student: { findUnique: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { getCampusScope, leadScopeWhere, enrollmentScopeWhere } from "@/lib/campus-scope";

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

describe("leadScopeWhere", () => {
  it("returns an empty where clause for ALL", () => {
    expect(leadScopeWhere({ type: "ALL" })).toEqual({});
  });

  it("returns an OR clause (campus list or unassigned) for CAMPUS_LIST", () => {
    expect(leadScopeWhere({ type: "CAMPUS_LIST", campusIds: ["c1", "c2"] })).toEqual({
      OR: [{ campusId: { in: ["c1", "c2"] } }, { campusId: null }],
    });
  });

  it("denies by default for SINGLE_CAMPUS", () => {
    expect(leadScopeWhere({ type: "SINGLE_CAMPUS", campusId: "c1" })).toEqual({
      id: { in: [] },
    });
  });

  it("denies by default for NONE", () => {
    expect(leadScopeWhere({ type: "NONE" })).toEqual({ id: { in: [] } });
  });
});

describe("enrollmentScopeWhere", () => {
  it("returns only the active-enrollment filter for ALL", () => {
    expect(enrollmentScopeWhere({ type: "ALL" })).toEqual({ completedAt: null });
  });

  it("returns an active-enrollment + campus filter for CAMPUS_LIST", () => {
    expect(enrollmentScopeWhere({ type: "CAMPUS_LIST", campusIds: ["c1", "c2"] })).toEqual({
      completedAt: null,
      student: { campusId: { in: ["c1", "c2"] } },
    });
  });

  it("denies by default for SINGLE_CAMPUS", () => {
    expect(enrollmentScopeWhere({ type: "SINGLE_CAMPUS", campusId: "c1" })).toEqual({
      id: { in: [] },
    });
  });

  it("denies by default for NONE", () => {
    expect(enrollmentScopeWhere({ type: "NONE" })).toEqual({ id: { in: [] } });
  });
});
