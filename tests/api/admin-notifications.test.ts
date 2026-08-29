import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { notification: { findMany: vi.fn(), updateMany: vi.fn() } },
}));

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { GET } from "@/app/api/admin/notifications/route";
import { PATCH } from "@/app/api/admin/notifications/[id]/read/route";

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("GET /api/admin/notifications", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 without a session", async () => {
    (auth as any).mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns only the caller's own notifications, most recent first", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1", role: "ADMIN" } });
    (prisma.notification.findMany as any).mockResolvedValue([]);

    const res = await GET();
    expect(res.status).toBe(200);
    expect(prisma.notification.findMany).toHaveBeenCalledWith({
      where: { userId: "u1" },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
  });
});

describe("PATCH /api/admin/notifications/[id]/read", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 without a session", async () => {
    (auth as any).mockResolvedValue(null);
    const res = await PATCH(new Request("http://localhost"), makeParams("n1"));
    expect(res.status).toBe(401);
  });

  it("marks the notification read only if it belongs to the caller (scoped updateMany), 404 if not", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1", role: "ADMIN" } });
    (prisma.notification.updateMany as any).mockResolvedValue({ count: 0 });

    const res = await PATCH(new Request("http://localhost"), makeParams("n1"));
    expect(res.status).toBe(404);
    expect(prisma.notification.updateMany).toHaveBeenCalledWith({
      where: { id: "n1", userId: "u1" },
      data: { readAt: expect.any(Date) },
    });
  });

  it("returns 200 when the notification belongs to the caller", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1", role: "ADMIN" } });
    (prisma.notification.updateMany as any).mockResolvedValue({ count: 1 });

    const res = await PATCH(new Request("http://localhost"), makeParams("n1"));
    expect(res.status).toBe(200);
  });
});
