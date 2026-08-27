import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    student: { findUnique: vi.fn() },
    parentStudent: { findMany: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { getVisibleStudentIds } from "@/lib/invoice-scope";

describe("getVisibleStudentIds", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the student's own id for STUDENT", async () => {
    (prisma.student.findUnique as any).mockResolvedValue({ id: "s1" });
    const ids = await getVisibleStudentIds({ id: "u1", role: "STUDENT" });
    expect(ids).toEqual(["s1"]);
  });

  it("returns an empty array for STUDENT with no Student record", async () => {
    (prisma.student.findUnique as any).mockResolvedValue(null);
    const ids = await getVisibleStudentIds({ id: "u1", role: "STUDENT" });
    expect(ids).toEqual([]);
  });

  it("returns linked student ids for PARENT", async () => {
    (prisma.parentStudent.findMany as any).mockResolvedValue([
      { studentId: "s1" },
      { studentId: "s2" },
    ]);
    const ids = await getVisibleStudentIds({ id: "u2", role: "PARENT" });
    expect(ids).toEqual(["s1", "s2"]);
  });

  it("returns an empty array for any other role", async () => {
    const ids = await getVisibleStudentIds({ id: "u3", role: "ADMIN" });
    expect(ids).toEqual([]);
  });
});
