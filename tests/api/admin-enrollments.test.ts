import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/campus-scope", () => ({ getCampusScope: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { enrollment: { findMany: vi.fn() } },
}));

import { auth } from "@/lib/auth";
import { getCampusScope } from "@/lib/campus-scope";
import { prisma } from "@/lib/prisma";
import { GET } from "@/app/api/admin/enrollments/route";

describe("GET /api/admin/enrollments", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 without a session", async () => {
    (auth as any).mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns 403 for a STUDENT", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1", role: "STUDENT" } });
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("lists all active enrollments for ADMIN", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1", role: "ADMIN" } });
    (getCampusScope as any).mockResolvedValue({ type: "ALL" });
    (prisma.enrollment.findMany as any).mockResolvedValue([]);

    const res = await GET();
    expect(res.status).toBe(200);
    expect(prisma.enrollment.findMany).toHaveBeenCalledWith({
      where: { completedAt: null },
      orderBy: { enrolledAt: "asc" },
      include: {
        student: { include: { user: true, campus: true } },
        group: { include: { level: true } },
      },
    });
  });

  it("scopes to the caller's campus for STAFF", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u2", role: "STAFF" } });
    (getCampusScope as any).mockResolvedValue({ type: "CAMPUS_LIST", campusIds: ["c1"] });
    (prisma.enrollment.findMany as any).mockResolvedValue([]);

    await GET();
    expect(prisma.enrollment.findMany).toHaveBeenCalledWith({
      where: { completedAt: null, student: { campusId: { in: ["c1"] } } },
      orderBy: { enrolledAt: "asc" },
      include: {
        student: { include: { user: true, campus: true } },
        group: { include: { level: true } },
      },
    });
  });
});
