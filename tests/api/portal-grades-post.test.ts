import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { enrollment: { findUnique: vi.fn() }, grade: { create: vi.fn() } },
}));

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { POST } from "@/app/api/portal/grades/route";

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/portal/grades", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

const VALID_BODY = { enrollmentId: "e1", title: "Examen parcial 1", score: 85, maxScore: 100 };

describe("POST /api/portal/grades", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 without a session", async () => {
    (auth as any).mockResolvedValue(null);
    const res = await POST(jsonRequest(VALID_BODY));
    expect(res.status).toBe(401);
  });

  it("returns 403 for a non-TEACHER role", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1", role: "PARENT" } });
    const res = await POST(jsonRequest(VALID_BODY));
    expect(res.status).toBe(403);
  });

  it("returns 404 when the enrollment doesn't exist", async () => {
    (auth as any).mockResolvedValue({ user: { id: "t1", role: "TEACHER" } });
    (prisma.enrollment.findUnique as any).mockResolvedValue(null);
    const res = await POST(jsonRequest(VALID_BODY));
    expect(res.status).toBe(404);
  });

  it("returns 403 when the enrollment's group is not the caller's own", async () => {
    (auth as any).mockResolvedValue({ user: { id: "t1", role: "TEACHER" } });
    (prisma.enrollment.findUnique as any).mockResolvedValue({
      id: "e1",
      completedAt: null,
      group: { teacherId: "t2" },
    });
    const res = await POST(jsonRequest(VALID_BODY));
    expect(res.status).toBe(403);
    expect(prisma.grade.create).not.toHaveBeenCalled();
  });

  it("returns 400 when the enrollment is not active", async () => {
    (auth as any).mockResolvedValue({ user: { id: "t1", role: "TEACHER" } });
    (prisma.enrollment.findUnique as any).mockResolvedValue({
      id: "e1",
      completedAt: new Date(),
      group: { teacherId: "t1" },
    });
    const res = await POST(jsonRequest(VALID_BODY));
    expect(res.status).toBe(400);
  });

  it("returns 400 when score is out of range or maxScore is not positive", async () => {
    (auth as any).mockResolvedValue({ user: { id: "t1", role: "TEACHER" } });
    (prisma.enrollment.findUnique as any).mockResolvedValue({
      id: "e1",
      completedAt: null,
      group: { teacherId: "t1" },
    });

    const tooHigh = await POST(jsonRequest({ ...VALID_BODY, score: 150 }));
    expect(tooHigh.status).toBe(400);

    const negative = await POST(jsonRequest({ ...VALID_BODY, score: -5 }));
    expect(negative.status).toBe(400);

    const zeroMax = await POST(jsonRequest({ ...VALID_BODY, maxScore: 0 }));
    expect(zeroMax.status).toBe(400);

    expect(prisma.grade.create).not.toHaveBeenCalled();
  });

  it("creates the grade on success, defaulting maxScore to 100 when omitted", async () => {
    (auth as any).mockResolvedValue({ user: { id: "t1", role: "TEACHER" } });
    (prisma.enrollment.findUnique as any).mockResolvedValue({
      id: "e1",
      completedAt: null,
      group: { teacherId: "t1" },
    });
    (prisma.grade.create as any).mockResolvedValue({ id: "gr1" });

    const res = await POST(jsonRequest({ enrollmentId: "e1", title: "Examen parcial 1", score: 85 }));
    expect(res.status).toBe(201);
    expect(prisma.grade.create).toHaveBeenCalledWith({
      data: { enrollmentId: "e1", title: "Examen parcial 1", score: 85, maxScore: 100, createdById: "t1" },
    });
  });
});
