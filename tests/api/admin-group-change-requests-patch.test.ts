import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    groupChangeRequest: { findUnique: vi.fn(), update: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PATCH } from "@/app/api/admin/group-change-requests/[id]/route";

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/admin/group-change-requests/gcr1", {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("PATCH /api/admin/group-change-requests/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 without a session", async () => {
    (auth as any).mockResolvedValue(null);
    const res = await PATCH(jsonRequest({ decision: "APROBADA" }), makeParams("gcr1"));
    expect(res.status).toBe(401);
  });

  it("returns 400 for an invalid decision value", async () => {
    (auth as any).mockResolvedValue({ user: { id: "a1", role: "ADMIN" } });
    const res = await PATCH(jsonRequest({ decision: "BOGUS" }), makeParams("gcr1"));
    expect(res.status).toBe(400);
  });

  it("returns 404 for a nonexistent request", async () => {
    (auth as any).mockResolvedValue({ user: { id: "a1", role: "ADMIN" } });
    (prisma.groupChangeRequest.findUnique as any).mockResolvedValue(null);
    const res = await PATCH(jsonRequest({ decision: "APROBADA" }), makeParams("gcr1"));
    expect(res.status).toBe(404);
  });

  it("returns 400 when the request is not PENDIENTE", async () => {
    (auth as any).mockResolvedValue({ user: { id: "a1", role: "ADMIN" } });
    (prisma.groupChangeRequest.findUnique as any).mockResolvedValue({ id: "gcr1", status: "APROBADA" });
    const res = await PATCH(jsonRequest({ decision: "APROBADA" }), makeParams("gcr1"));
    expect(res.status).toBe(400);
  });

  it("on REJECTED decision, just updates status/reviewedBy without touching enrollments", async () => {
    (auth as any).mockResolvedValue({ user: { id: "a1", role: "ADMIN" } });
    (prisma.groupChangeRequest.findUnique as any).mockResolvedValue({ id: "gcr1", status: "PENDIENTE", type: "BAJA" });
    (prisma.groupChangeRequest.update as any).mockResolvedValue({ id: "gcr1", status: "RECHAZADA" });

    const res = await PATCH(jsonRequest({ decision: "RECHAZADA" }), makeParams("gcr1"));
    expect(res.status).toBe(200);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.groupChangeRequest.update).toHaveBeenCalledWith({
      where: { id: "gcr1" },
      data: { status: "RECHAZADA", reviewedById: "a1", reviewedAt: expect.any(Date) },
    });
  });

  it("on APROBADA + BAJA, closes the enrollment and marks the request approved in one transaction", async () => {
    (auth as any).mockResolvedValue({ user: { id: "a1", role: "ADMIN" } });
    (prisma.groupChangeRequest.findUnique as any).mockResolvedValue({
      id: "gcr1",
      status: "PENDIENTE",
      type: "BAJA",
      studentId: "st1",
      currentGroupId: "g1",
    });
    (prisma.$transaction as any).mockImplementation(async (fn: any) =>
      fn({
        enrollment: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
        groupChangeRequest: { update: vi.fn().mockResolvedValue({ id: "gcr1", status: "APROBADA" }) },
      })
    );

    const res = await PATCH(jsonRequest({ decision: "APROBADA" }), makeParams("gcr1"));
    expect(res.status).toBe(200);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it("on APROBADA + CAMBIO_GRUPO, closes current enrollment and creates a new one in one transaction", async () => {
    (auth as any).mockResolvedValue({ user: { id: "a1", role: "ADMIN" } });
    (prisma.groupChangeRequest.findUnique as any).mockResolvedValue({
      id: "gcr1",
      status: "PENDIENTE",
      type: "CAMBIO_GRUPO",
      studentId: "st1",
      currentGroupId: "g1",
      requestedGroupId: "g2",
    });
    (prisma.$transaction as any).mockImplementation(async (fn: any) =>
      fn({
        enrollment: {
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          create: vi.fn().mockResolvedValue({ id: "e2" }),
        },
        groupChangeRequest: { update: vi.fn().mockResolvedValue({ id: "gcr1", status: "APROBADA" }) },
      })
    );

    const res = await PATCH(jsonRequest({ decision: "APROBADA" }), makeParams("gcr1"));
    expect(res.status).toBe(200);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it("returns 400 if the enrollment was already completed by the time of approval (race guard)", async () => {
    (auth as any).mockResolvedValue({ user: { id: "a1", role: "ADMIN" } });
    (prisma.groupChangeRequest.findUnique as any).mockResolvedValue({
      id: "gcr1",
      status: "PENDIENTE",
      type: "BAJA",
      studentId: "st1",
      currentGroupId: "g1",
    });
    (prisma.$transaction as any).mockImplementation(async (fn: any) =>
      fn({ enrollment: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) } })
    );

    const res = await PATCH(jsonRequest({ decision: "APROBADA" }), makeParams("gcr1"));
    expect(res.status).toBe(400);
  });
});
