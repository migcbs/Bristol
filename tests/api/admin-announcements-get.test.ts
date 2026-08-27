import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/email", () => ({ sendAnnouncementEmail: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { announcement: { findMany: vi.fn() } },
}));

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { GET } from "@/app/api/admin/announcements/route";

describe("GET /api/admin/announcements", () => {
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

  it("ADMIN sees every announcement", async () => {
    (auth as any).mockResolvedValue({ user: { id: "a1", role: "ADMIN" } });
    (prisma.announcement.findMany as any).mockResolvedValue([]);

    await GET();
    expect(prisma.announcement.findMany).toHaveBeenCalledWith({
      where: {},
      orderBy: { createdAt: "desc" },
      include: { createdBy: { select: { id: true, name: true } }, campus: true },
    });
  });

  it("STAFF sees their own announcements plus ALL-audience ones", async () => {
    (auth as any).mockResolvedValue({ user: { id: "s1", role: "STAFF" } });
    (prisma.announcement.findMany as any).mockResolvedValue([]);

    await GET();
    expect(prisma.announcement.findMany).toHaveBeenCalledWith({
      where: { OR: [{ createdById: "s1" }, { audience: "ALL" }] },
      orderBy: { createdAt: "desc" },
      include: { createdBy: { select: { id: true, name: true } }, campus: true },
    });
  });
});
