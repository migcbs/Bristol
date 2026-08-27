import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/campus-scope", () => ({ getCampusScope: vi.fn(), leadScopeWhere: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { lead: { groupBy: vi.fn() } },
}));

import { auth } from "@/lib/auth";
import { getCampusScope, leadScopeWhere } from "@/lib/campus-scope";
import { prisma } from "@/lib/prisma";
import { GET } from "@/app/api/admin/marketing/summary/route";

describe("GET /api/admin/marketing/summary", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 without a session", async () => {
    (auth as any).mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns 403 for a TEACHER", async () => {
    (auth as any).mockResolvedValue({ user: { id: "t1", role: "TEACHER" } });
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("returns counts grouped by status and by source, scoped via leadScopeWhere", async () => {
    (auth as any).mockResolvedValue({ user: { id: "s1", role: "STAFF" } });
    (getCampusScope as any).mockResolvedValue({ type: "CAMPUS_LIST", campusIds: ["c1"] });
    (leadScopeWhere as any).mockReturnValue({ campusId: { in: ["c1"] } });
    (prisma.lead.groupBy as any)
      .mockResolvedValueOnce([{ status: "NEW", _count: { _all: 3 } }])
      .mockResolvedValueOnce([{ source: "WEB", _count: { _all: 2 } }]);

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      byStatus: [{ status: "NEW", count: 3 }],
      bySource: [{ source: "WEB", count: 2 }],
    });
    expect(prisma.lead.groupBy).toHaveBeenCalledWith({
      by: ["status"],
      where: { campusId: { in: ["c1"] } },
      _count: { _all: true },
    });
    expect(prisma.lead.groupBy).toHaveBeenCalledWith({
      by: ["source"],
      where: { campusId: { in: ["c1"] } },
      _count: { _all: true },
    });
  });
});
