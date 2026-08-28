import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/campus-scope", () => ({ getCampusScope: vi.fn(), leadScopeWhere: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { lead: { findMany: vi.fn(), updateMany: vi.fn() } },
}));

import { auth } from "@/lib/auth";
import { getCampusScope, leadScopeWhere } from "@/lib/campus-scope";
import { prisma } from "@/lib/prisma";
import { GET, PATCH } from "@/app/api/admin/leads/waitlist/route";

function jsonRequest(body: unknown, method = "PATCH") {
  return new Request("http://localhost/api/admin/leads/waitlist", {
    method,
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("GET /api/admin/leads/waitlist", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 without a session", async () => {
    (auth as any).mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns leads scoped by campus, ordered by createdAt", async () => {
    (auth as any).mockResolvedValue({ user: { id: "s1", role: "STAFF" } });
    (getCampusScope as any).mockResolvedValue({ type: "CAMPUS_LIST", campusIds: ["c1"] });
    (leadScopeWhere as any).mockReturnValue({ campusId: { in: ["c1"] } });
    (prisma.lead.findMany as any).mockResolvedValue([]);

    const res = await GET();
    expect(res.status).toBe(200);
    expect(prisma.lead.findMany).toHaveBeenCalledWith({
      where: { campusId: { in: ["c1"] } },
      orderBy: { createdAt: "asc" },
    });
  });
});

describe("PATCH /api/admin/leads/waitlist", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 for an invalid status value", async () => {
    (auth as any).mockResolvedValue({ user: { id: "a1", role: "ADMIN" } });
    const res = await PATCH(jsonRequest({ id: "l1", status: "BOGUS" }));
    expect(res.status).toBe(400);
    expect(prisma.lead.updateMany).not.toHaveBeenCalled();
  });

  it("updates the lead's status on a valid request within scope", async () => {
    (auth as any).mockResolvedValue({ user: { id: "a1", role: "ADMIN" } });
    (getCampusScope as any).mockResolvedValue({ type: "ALL" });
    (leadScopeWhere as any).mockReturnValue({});
    (prisma.lead.updateMany as any).mockResolvedValue({ count: 1 });

    const res = await PATCH(jsonRequest({ id: "l1", status: "CONTACTED" }));
    expect(res.status).toBe(200);
    expect(prisma.lead.updateMany).toHaveBeenCalledWith({
      where: { id: "l1" },
      data: { status: "CONTACTED" },
    });
  });

  it("returns 404 when the lead doesn't exist or is outside the caller's scope", async () => {
    (auth as any).mockResolvedValue({ user: { id: "s1", role: "STAFF" } });
    (getCampusScope as any).mockResolvedValue({ type: "CAMPUS_LIST", campusIds: ["c1"] });
    (leadScopeWhere as any).mockReturnValue({ campusId: { in: ["c1"] } });
    (prisma.lead.updateMany as any).mockResolvedValue({ count: 0 });

    const res = await PATCH(jsonRequest({ id: "l1", status: "CONTACTED" }));
    expect(res.status).toBe(404);
  });
});
