import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/campus-scope", async () => {
  const actual = await vi.importActual<typeof import("@/lib/campus-scope")>(
    "@/lib/campus-scope"
  );
  return { ...actual, getCampusScope: vi.fn() };
});
vi.mock("@/lib/prisma", () => ({
  prisma: { lead: { findMany: vi.fn() } },
}));

import { auth } from "@/lib/auth";
import { getCampusScope } from "@/lib/campus-scope";
import { prisma } from "@/lib/prisma";
import { GET } from "@/app/api/admin/leads/route";

function requestWithStatus(status?: string) {
  const url = status
    ? `http://localhost/api/admin/leads?status=${status}`
    : "http://localhost/api/admin/leads";
  return new Request(url);
}

describe("GET /api/admin/leads", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when there is no session", async () => {
    (auth as any).mockResolvedValue(null);
    const res = await GET(requestWithStatus());
    expect(res.status).toBe(401);
  });

  it("returns 403 for a non-admin, non-staff role", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1", role: "STUDENT" } });
    const res = await GET(requestWithStatus());
    expect(res.status).toBe(403);
  });

  it("queries all leads for ADMIN with no campus filter", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1", role: "ADMIN" } });
    (getCampusScope as any).mockResolvedValue({ type: "ALL" });
    (prisma.lead.findMany as any).mockResolvedValue([]);

    const res = await GET(requestWithStatus());
    expect(res.status).toBe(200);
    expect(prisma.lead.findMany).toHaveBeenCalledWith({
      where: {},
      orderBy: { createdAt: "desc" },
    });
  });

  it("queries campus-or-unassigned leads for STAFF", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u2", role: "STAFF" } });
    (getCampusScope as any).mockResolvedValue({ type: "CAMPUS_LIST", campusIds: ["c1", "c2"] });
    (prisma.lead.findMany as any).mockResolvedValue([]);

    await GET(requestWithStatus());
    expect(prisma.lead.findMany).toHaveBeenCalledWith({
      where: { OR: [{ campusId: { in: ["c1", "c2"] } }, { campusId: null }] },
      orderBy: { createdAt: "desc" },
    });
  });

  it("adds a status filter when provided", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1", role: "ADMIN" } });
    (getCampusScope as any).mockResolvedValue({ type: "ALL" });
    (prisma.lead.findMany as any).mockResolvedValue([]);

    await GET(requestWithStatus("CONTACTED"));
    expect(prisma.lead.findMany).toHaveBeenCalledWith({
      where: { status: "CONTACTED" },
      orderBy: { createdAt: "desc" },
    });
  });

  it("ignores an invalid status filter value", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1", role: "ADMIN" } });
    (getCampusScope as any).mockResolvedValue({ type: "ALL" });
    (prisma.lead.findMany as any).mockResolvedValue([]);

    await GET(requestWithStatus("NOT_A_STATUS"));
    expect(prisma.lead.findMany).toHaveBeenCalledWith({
      where: {},
      orderBy: { createdAt: "desc" },
    });
  });
});
