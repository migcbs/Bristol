import { describe, it, expect, vi, beforeEach } from "vitest";

const txUpdateMany = vi.fn();
const txCreate = vi.fn();

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/campus-scope", () => ({ getCampusScope: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    enrollment: { findUnique: vi.fn(), updateMany: vi.fn(), create: vi.fn() },
    group: { findUnique: vi.fn() },
    $transaction: vi.fn((fn: any) =>
      fn({
        enrollment: { updateMany: txUpdateMany, create: txCreate },
      }),
    ),
  },
}));

import { auth } from "@/lib/auth";
import { getCampusScope } from "@/lib/campus-scope";
import { prisma } from "@/lib/prisma";
import { POST } from "@/app/api/admin/reinscripciones/route";

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/admin/reinscripciones", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/admin/reinscripciones", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    txUpdateMany.mockResolvedValue({ count: 1 });
    txCreate.mockResolvedValue({ id: "e2" });
  });

  it("returns 401 without a session", async () => {
    (auth as any).mockResolvedValue(null);
    const res = await POST(jsonRequest({ enrollmentId: "e1", newGroupId: "g2" }));
    expect(res.status).toBe(401);
  });

  it("returns 403 for a STUDENT", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1", role: "STUDENT" } });
    const res = await POST(jsonRequest({ enrollmentId: "e1", newGroupId: "g2" }));
    expect(res.status).toBe(403);
  });

  it("returns 404 when the enrollment is outside the caller's scope", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u2", role: "STAFF" } });
    (getCampusScope as any).mockResolvedValue({ type: "CAMPUS_LIST", campusIds: ["c1"] });
    (prisma.enrollment.findUnique as any).mockResolvedValue({
      id: "e1",
      completedAt: null,
      student: { campusId: "c2" },
    });

    const res = await POST(jsonRequest({ enrollmentId: "e1", newGroupId: "g2" }));
    expect(res.status).toBe(404);
  });

  it("returns 400 when the enrollment is already completed", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1", role: "ADMIN" } });
    (getCampusScope as any).mockResolvedValue({ type: "ALL" });
    (prisma.enrollment.findUnique as any).mockResolvedValue({
      id: "e1",
      completedAt: new Date(),
      studentId: "s1",
      student: { campusId: "c1" },
    });

    const res = await POST(jsonRequest({ enrollmentId: "e1", newGroupId: "g2" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when the destination group is at a different campus", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1", role: "ADMIN" } });
    (getCampusScope as any).mockResolvedValue({ type: "ALL" });
    (prisma.enrollment.findUnique as any).mockResolvedValue({
      id: "e1",
      completedAt: null,
      studentId: "s1",
      student: { campusId: "c1" },
    });
    (prisma.group.findUnique as any).mockResolvedValue({ id: "g2", campusId: "c2" });

    const res = await POST(jsonRequest({ enrollmentId: "e1", newGroupId: "g2" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when the destination group does not exist", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1", role: "ADMIN" } });
    (getCampusScope as any).mockResolvedValue({ type: "ALL" });
    (prisma.enrollment.findUnique as any).mockResolvedValue({
      id: "e1",
      completedAt: null,
      studentId: "s1",
      student: { campusId: "c1" },
    });
    (prisma.group.findUnique as any).mockResolvedValue(null);

    const res = await POST(jsonRequest({ enrollmentId: "e1", newGroupId: "g2" }));
    expect(res.status).toBe(400);
  });

  it("re-enrolls successfully within a transaction", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1", role: "ADMIN" } });
    (getCampusScope as any).mockResolvedValue({ type: "ALL" });
    (prisma.enrollment.findUnique as any).mockResolvedValue({
      id: "e1",
      completedAt: null,
      studentId: "s1",
      student: { campusId: "c1" },
    });
    (prisma.group.findUnique as any).mockResolvedValue({ id: "g2", campusId: "c1" });

    const res = await POST(jsonRequest({ enrollmentId: "e1", newGroupId: "g2" }));
    expect(res.status).toBe(200);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(txUpdateMany).toHaveBeenCalledWith({
      where: { id: "e1", completedAt: null },
      data: { completedAt: expect.any(Date) },
    });
    expect(txCreate).toHaveBeenCalledWith({
      data: { studentId: "s1", groupId: "g2" },
    });
  });

  it("returns 400 when the student already has an active enrollment (P2002 on the partial index)", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1", role: "ADMIN" } });
    (getCampusScope as any).mockResolvedValue({ type: "ALL" });
    (prisma.enrollment.findUnique as any).mockResolvedValue({
      id: "e1",
      completedAt: null,
      studentId: "s1",
      student: { campusId: "c1" },
    });
    (prisma.group.findUnique as any).mockResolvedValue({ id: "g2", campusId: "c1" });
    (prisma.$transaction as any).mockRejectedValueOnce(
      Object.assign(new Error("Unique constraint failed"), { code: "P2002" }),
    );

    const res = await POST(jsonRequest({ enrollmentId: "e1", newGroupId: "g2" }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/inscripción activa/i);
  });

  it("returns 400 and does not create when a concurrent request already closed the enrollment", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1", role: "ADMIN" } });
    (getCampusScope as any).mockResolvedValue({ type: "ALL" });
    (prisma.enrollment.findUnique as any).mockResolvedValue({
      id: "e1",
      completedAt: null,
      studentId: "s1",
      student: { campusId: "c1" },
    });
    (prisma.group.findUnique as any).mockResolvedValue({ id: "g2", campusId: "c1" });
    txUpdateMany.mockResolvedValue({ count: 0 });

    const res = await POST(jsonRequest({ enrollmentId: "e1", newGroupId: "g2" }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/ya fue completada/i);
    expect(txCreate).not.toHaveBeenCalled();
  });
});
