import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { enrollment: { findUnique: vi.fn() }, blockEvaluation: { create: vi.fn() } },
}));

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { POST } from "@/app/api/admin/block-evaluations/route";

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/admin/block-evaluations", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

const VALID_BODY = {
  enrollmentId: "e1",
  bloqueNumero: 1,
  notaListening: 90,
  notaSpeaking: 85,
  notaReading: 92,
  notaWriting: 88,
  notaGrammar: 80,
};

describe("POST /api/admin/block-evaluations", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 without a session", async () => {
    (auth as any).mockResolvedValue(null);
    const res = await POST(jsonRequest(VALID_BODY));
    expect(res.status).toBe(401);
  });

  it("returns 403 for a non-TEACHER role", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1", role: "STAFF" } });
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
      group: { teacherId: "t2" },
    });
    const res = await POST(jsonRequest(VALID_BODY));
    expect(res.status).toBe(403);
    expect(prisma.blockEvaluation.create).not.toHaveBeenCalled();
  });

  it("returns 400 when any score is out of 0-100 range", async () => {
    (auth as any).mockResolvedValue({ user: { id: "t1", role: "TEACHER" } });
    (prisma.enrollment.findUnique as any).mockResolvedValue({ id: "e1", group: { teacherId: "t1" } });
    const res = await POST(jsonRequest({ ...VALID_BODY, notaGrammar: 150 }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for a duplicate bloqueNumero on the same enrollment (P2002)", async () => {
    (auth as any).mockResolvedValue({ user: { id: "t1", role: "TEACHER" } });
    (prisma.enrollment.findUnique as any).mockResolvedValue({ id: "e1", group: { teacherId: "t1" } });
    (prisma.blockEvaluation.create as any).mockRejectedValue(
      Object.assign(new Error("Unique constraint failed"), { code: "P2002" })
    );
    const res = await POST(jsonRequest(VALID_BODY));
    expect(res.status).toBe(400);
  });

  it("computes promedioBloque and creates the evaluation on success", async () => {
    (auth as any).mockResolvedValue({ user: { id: "t1", role: "TEACHER" } });
    (prisma.enrollment.findUnique as any).mockResolvedValue({ id: "e1", group: { teacherId: "t1" } });
    (prisma.blockEvaluation.create as any).mockResolvedValue({ id: "be1" });

    const res = await POST(jsonRequest(VALID_BODY));
    expect(res.status).toBe(201);
    // (90+85+92+88+80)/5 = 87
    expect(prisma.blockEvaluation.create).toHaveBeenCalledWith({
      data: {
        enrollmentId: "e1",
        bloqueNumero: 1,
        notaListening: 90,
        notaSpeaking: 85,
        notaReading: 92,
        notaWriting: 88,
        notaGrammar: 80,
        promedioBloque: 87,
        createdById: "t1",
      },
    });
  });
});
