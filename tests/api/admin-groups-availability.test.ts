import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/campus-scope", () => ({ getCampusScope: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { group: { findMany: vi.fn() } },
}));

import { auth } from "@/lib/auth";
import { getCampusScope } from "@/lib/campus-scope";
import { prisma } from "@/lib/prisma";
import { GET } from "@/app/api/admin/groups/availability/route";

describe("GET /api/admin/groups/availability", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 without a session", async () => {
    (auth as any).mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns groups scoped by campus with cupoMaximo and active-enrollment counts", async () => {
    (auth as any).mockResolvedValue({ user: { id: "s1", role: "STAFF" } });
    (getCampusScope as any).mockResolvedValue({ type: "CAMPUS_LIST", campusIds: ["c1"] });
    (prisma.group.findMany as any).mockResolvedValue([
      { id: "g1", name: "A1 Matutino", cupoMaximo: 15, campus: { name: "Coatepec" }, level: { code: "A1" }, _count: { enrollments: 12 } },
    ]);

    const res = await GET();
    expect(res.status).toBe(200);
    expect(prisma.group.findMany).toHaveBeenCalledWith({
      where: { campusId: { in: ["c1"] } },
      include: {
        campus: true,
        level: true,
        _count: { select: { enrollments: { where: { completedAt: null } } } },
      },
      orderBy: { name: "asc" },
    });
  });
});
