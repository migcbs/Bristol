import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    groupChangeRequest: { findUnique: vi.fn(), update: vi.fn() },
    $transaction: vi.fn(),
  },
}));
vi.mock("@/lib/campus-scope", () => ({ assertCampusInScope: vi.fn() }));
vi.mock("@/lib/notifications", () => ({ notify: vi.fn() }));
vi.mock("@/lib/staff-permissions", () => ({ hasModuleAccess: vi.fn().mockResolvedValue("full") }));

import { auth } from "@/lib/auth";
import { assertCampusInScope } from "@/lib/campus-scope";
import { notify } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { PATCH, reviewGroupChangeRequest } from "@/app/api/admin/group-change-requests/[id]/route";

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

  it("returns 404 for a STAFF user whose scope doesn't include the student's campus", async () => {
    (auth as any).mockResolvedValue({ user: { id: "staff1", role: "STAFF" } });
    (prisma.groupChangeRequest.findUnique as any).mockResolvedValue({
      id: "gcr1",
      status: "PENDIENTE",
      type: "BAJA",
      studentId: "st1",
      currentGroupId: "g1",
      student: { id: "st1", campusId: "campus-other" },
    });
    (assertCampusInScope as any).mockResolvedValue(false);

    const res = await PATCH(jsonRequest({ decision: "APROBADA" }), makeParams("gcr1"));
    expect(res.status).toBe(404);
    expect(assertCampusInScope).toHaveBeenCalledWith({ id: "staff1", role: "STAFF" }, "campus-other");
    expect(prisma.groupChangeRequest.update).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("returns 400 for a CAMBIO_GRUPO request with no requestedGroupId (inconsistent data)", async () => {
    (auth as any).mockResolvedValue({ user: { id: "a1", role: "ADMIN" } });
    (prisma.groupChangeRequest.findUnique as any).mockResolvedValue({
      id: "gcr1",
      status: "PENDIENTE",
      type: "CAMBIO_GRUPO",
      studentId: "st1",
      currentGroupId: "g1",
      requestedGroupId: null,
      student: { id: "st1", campusId: "campus-a" },
    });

    const res = await PATCH(jsonRequest({ decision: "APROBADA" }), makeParams("gcr1"));
    expect(res.status).toBe(400);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("returns 400 when the request is not PENDIENTE", async () => {
    (auth as any).mockResolvedValue({ user: { id: "a1", role: "ADMIN" } });
    (prisma.groupChangeRequest.findUnique as any).mockResolvedValue({ id: "gcr1", status: "APROBADA" });
    const res = await PATCH(jsonRequest({ decision: "APROBADA" }), makeParams("gcr1"));
    expect(res.status).toBe(400);
  });

  it("on REJECTED decision, just updates status/reviewedBy without touching enrollments", async () => {
    (auth as any).mockResolvedValue({ user: { id: "a1", role: "ADMIN" } });
    (prisma.groupChangeRequest.findUnique as any).mockResolvedValue({
      id: "gcr1",
      status: "PENDIENTE",
      type: "BAJA",
      requestedById: "requester1",
    });
    (prisma.groupChangeRequest.update as any).mockResolvedValue({ id: "gcr1", status: "RECHAZADA" });

    const res = await PATCH(jsonRequest({ decision: "RECHAZADA" }), makeParams("gcr1"));
    expect(res.status).toBe(200);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.groupChangeRequest.update).toHaveBeenCalledWith({
      where: { id: "gcr1" },
      data: { status: "RECHAZADA", reviewedById: "a1", reviewedAt: expect.any(Date) },
    });
    expect(notify).toHaveBeenCalledWith(
      "requester1",
      expect.stringContaining("rechazada"),
      "/admin/control-escolar/solicitudes"
    );
  });

  it("on APROBADA + BAJA, closes the enrollment and marks the request approved in one transaction", async () => {
    (auth as any).mockResolvedValue({ user: { id: "a1", role: "ADMIN" } });
    (prisma.groupChangeRequest.findUnique as any).mockResolvedValue({
      id: "gcr1",
      status: "PENDIENTE",
      type: "BAJA",
      studentId: "st1",
      currentGroupId: "g1",
      requestedById: "requester1",
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
    expect(notify).toHaveBeenCalledWith(
      "requester1",
      expect.stringContaining("aprobada"),
      "/admin/control-escolar/solicitudes"
    );
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

  it("reviewGroupChangeRequest called directly with a garbage decision returns 400 and touches nothing", async () => {
    const res = await reviewGroupChangeRequest(
      { id: "a1", role: "ADMIN" },
      "gcr1",
      "BOGUS" as any
    );
    expect(res.status).toBe(400);
    expect(prisma.groupChangeRequest.findUnique).not.toHaveBeenCalled();
    expect(prisma.groupChangeRequest.update).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
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
