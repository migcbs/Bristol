import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/academic-access", () => ({ getVisibleEnrollmentIds: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { grade: { findMany: vi.fn() } },
}));

import { auth } from "@/lib/auth";
import { getVisibleEnrollmentIds } from "@/lib/academic-access";
import { prisma } from "@/lib/prisma";
import { GET } from "@/app/api/portal/grades/route";

function getRequest(qs: string) {
  return new Request(`http://localhost/api/portal/grades${qs}`);
}

describe("GET /api/portal/grades", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 without a session", async () => {
    (auth as any).mockResolvedValue(null);
    const res = await GET(getRequest(""));
    expect(res.status).toBe(401);
  });

  it("returns 404 when a specific enrollmentId is not visible to the caller", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1", role: "STUDENT" } });
    (getVisibleEnrollmentIds as any).mockResolvedValue(["e1"]);
    const res = await GET(getRequest("?enrollmentId=e2"));
    expect(res.status).toBe(404);
    expect(prisma.grade.findMany).not.toHaveBeenCalled();
  });

  it("returns grades for a visible specific enrollmentId, most recent first", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1", role: "STUDENT" } });
    (getVisibleEnrollmentIds as any).mockResolvedValue(["e1"]);
    (prisma.grade.findMany as any).mockResolvedValue([]);

    const res = await GET(getRequest("?enrollmentId=e1"));
    expect(res.status).toBe(200);
    expect(prisma.grade.findMany).toHaveBeenCalledWith({
      where: { enrollmentId: "e1" },
      orderBy: { createdAt: "desc" },
    });
  });

  it("with no enrollmentId, returns grades for every enrollment visible to the caller", async () => {
    (auth as any).mockResolvedValue({ user: { id: "p1", role: "PARENT" } });
    (getVisibleEnrollmentIds as any).mockResolvedValue(["e1", "e2"]);
    (prisma.grade.findMany as any).mockResolvedValue([]);

    const res = await GET(getRequest(""));
    expect(res.status).toBe(200);
    expect(prisma.grade.findMany).toHaveBeenCalledWith({
      where: { enrollmentId: { in: ["e1", "e2"] } },
      orderBy: { createdAt: "desc" },
    });
  });
});
