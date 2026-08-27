import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/invoice-scope", () => ({ getVisibleStudentIds: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { invoice: { findMany: vi.fn() } },
}));

import { auth } from "@/lib/auth";
import { getVisibleStudentIds } from "@/lib/invoice-scope";
import { prisma } from "@/lib/prisma";
import { GET } from "@/app/api/portal/invoices/route";

describe("GET /api/portal/invoices", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 without a session", async () => {
    (auth as any).mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns invoices for the visible student ids", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1", role: "STUDENT" } });
    (getVisibleStudentIds as any).mockResolvedValue(["s1"]);
    (prisma.invoice.findMany as any).mockResolvedValue([]);

    const res = await GET();
    expect(res.status).toBe(200);
    expect(prisma.invoice.findMany).toHaveBeenCalledWith({
      where: { studentId: { in: ["s1"] } },
      orderBy: { dueDate: "asc" },
      include: { student: { include: { user: { select: { name: true } } } } },
    });
  });

  it("returns an empty array without querying when there are no visible students", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u4", role: "TEACHER" } });
    (getVisibleStudentIds as any).mockResolvedValue([]);

    const res = await GET();
    const body = await res.json();
    expect(body).toEqual([]);
    expect(prisma.invoice.findMany).not.toHaveBeenCalled();
  });
});
