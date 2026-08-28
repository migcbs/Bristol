import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/campus-scope", () => ({ assertCampusInScope: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { student: { findUnique: vi.fn() }, invoice: { findMany: vi.fn() } },
}));

import { auth } from "@/lib/auth";
import { assertCampusInScope } from "@/lib/campus-scope";
import { prisma } from "@/lib/prisma";
import { GET } from "@/app/api/admin/students/[id]/financial-status/route";

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("GET /api/admin/students/[id]/financial-status", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 without a session", async () => {
    (auth as any).mockResolvedValue(null);
    const res = await GET(new Request("http://localhost"), makeParams("st1"));
    expect(res.status).toBe(401);
  });

  it("returns 404 when the student doesn't exist", async () => {
    (auth as any).mockResolvedValue({ user: { id: "a1", role: "ADMIN" } });
    (prisma.student.findUnique as any).mockResolvedValue(null);
    const res = await GET(new Request("http://localhost"), makeParams("st1"));
    expect(res.status).toBe(404);
  });

  it("returns 404 when STAFF's scope doesn't include the student's campus", async () => {
    (auth as any).mockResolvedValue({ user: { id: "s1", role: "STAFF" } });
    (prisma.student.findUnique as any).mockResolvedValue({ id: "st1", campusId: "c2" });
    (assertCampusInScope as any).mockResolvedValue(false);
    const res = await GET(new Request("http://localhost"), makeParams("st1"));
    expect(res.status).toBe(404);
  });

  it("returns the computed status for an in-scope student", async () => {
    (auth as any).mockResolvedValue({ user: { id: "a1", role: "ADMIN" } });
    (prisma.student.findUnique as any).mockResolvedValue({ id: "st1", campusId: "c1" });
    (prisma.invoice.findMany as any).mockResolvedValue([{ status: "OVERDUE" }]);

    const res = await GET(new Request("http://localhost"), makeParams("st1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ status: "MOROSO" });
  });
});
