import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/announcement-scope", () => ({
  getRecipientCampusIds: vi.fn(),
  announcementAudienceWhere: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { announcement: { findMany: vi.fn() } },
}));

import { auth } from "@/lib/auth";
import { getRecipientCampusIds, announcementAudienceWhere } from "@/lib/announcement-scope";
import { prisma } from "@/lib/prisma";
import { GET } from "@/app/api/portal/announcements/route";

describe("GET /api/portal/announcements", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 without a session", async () => {
    (auth as any).mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns 403 for ADMIN/STAFF (this endpoint is for the community, not administrators)", async () => {
    (auth as any).mockResolvedValue({ user: { id: "a1", role: "ADMIN" } });
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("returns announcements matching this user's audience, most recent first", async () => {
    (auth as any).mockResolvedValue({ user: { id: "p1", role: "PARENT" } });
    (getRecipientCampusIds as any).mockResolvedValue(["c1"]);
    (announcementAudienceWhere as any).mockReturnValue({ OR: [{ audience: "ALL" }] });
    (prisma.announcement.findMany as any).mockResolvedValue([]);

    const res = await GET();

    expect(res.status).toBe(200);
    expect(getRecipientCampusIds).toHaveBeenCalledWith({ id: "p1", role: "PARENT" });
    expect(announcementAudienceWhere).toHaveBeenCalledWith({ role: "PARENT" }, ["c1"]);
    expect(prisma.announcement.findMany).toHaveBeenCalledWith({
      where: { OR: [{ audience: "ALL" }] },
      orderBy: { createdAt: "desc" },
    });
  });
});
