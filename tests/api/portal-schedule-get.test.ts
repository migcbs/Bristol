import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/academic-access", () => ({ getVisibleGroupIds: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { scheduleSlot: { findMany: vi.fn() } },
}));

import { auth } from "@/lib/auth";
import { getVisibleGroupIds } from "@/lib/academic-access";
import { prisma } from "@/lib/prisma";
import { GET } from "@/app/api/portal/schedule/route";

function getRequest(qs: string) {
  return new Request(`http://localhost/api/portal/schedule${qs}`);
}

describe("GET /api/portal/schedule", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 without a session", async () => {
    (auth as any).mockResolvedValue(null);
    const res = await GET(getRequest(""));
    expect(res.status).toBe(401);
  });

  it("returns 404 when a specific groupId is not visible to the caller", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1", role: "STUDENT" } });
    (getVisibleGroupIds as any).mockResolvedValue(["g1"]);
    const res = await GET(getRequest("?groupId=g2"));
    expect(res.status).toBe(404);
    expect(prisma.scheduleSlot.findMany).not.toHaveBeenCalled();
  });

  it("returns the slots for a visible specific groupId", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1", role: "STUDENT" } });
    (getVisibleGroupIds as any).mockResolvedValue(["g1"]);
    (prisma.scheduleSlot.findMany as any).mockResolvedValue([]);

    const res = await GET(getRequest("?groupId=g1"));
    expect(res.status).toBe(200);
    expect(prisma.scheduleSlot.findMany).toHaveBeenCalledWith({
      where: { groupId: "g1" },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    });
  });

  it("with no groupId, returns slots for every group visible to the caller", async () => {
    (auth as any).mockResolvedValue({ user: { id: "t1", role: "TEACHER" } });
    (getVisibleGroupIds as any).mockResolvedValue(["g1", "g2"]);
    (prisma.scheduleSlot.findMany as any).mockResolvedValue([]);

    const res = await GET(getRequest(""));
    expect(res.status).toBe(200);
    expect(prisma.scheduleSlot.findMany).toHaveBeenCalledWith({
      where: { groupId: { in: ["g1", "g2"] } },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    });
  });
});
