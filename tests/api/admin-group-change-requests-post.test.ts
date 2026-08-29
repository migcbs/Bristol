import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/campus-scope", () => ({ getCampusScope: vi.fn(), assertCampusInScope: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    student: { findUnique: vi.fn() },
    enrollment: { findFirst: vi.fn() },
    group: { findUnique: vi.fn() },
    groupChangeRequest: { create: vi.fn(), findMany: vi.fn() },
  },
}));

import { auth } from "@/lib/auth";
import { assertCampusInScope } from "@/lib/campus-scope";
import { prisma } from "@/lib/prisma";
import { POST } from "@/app/api/admin/group-change-requests/route";

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/admin/group-change-requests", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

const VALID_BODY = { type: "BAJA", studentId: "st1", currentGroupId: "g1", reason: "Cambio de ciudad" };

describe("POST /api/admin/group-change-requests", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 without a session", async () => {
    (auth as any).mockResolvedValue(null);
    const res = await POST(jsonRequest(VALID_BODY));
    expect(res.status).toBe(401);
  });

  it("returns 400 for CAMBIO_GRUPO with no requestedGroupId", async () => {
    (auth as any).mockResolvedValue({ user: { id: "s1", role: "STAFF" } });
    const res = await POST(jsonRequest({ ...VALID_BODY, type: "CAMBIO_GRUPO" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for a blank reason", async () => {
    (auth as any).mockResolvedValue({ user: { id: "s1", role: "STAFF" } });
    const res = await POST(jsonRequest({ ...VALID_BODY, reason: "   " }));
    expect(res.status).toBe(400);
  });

  it("returns 404 when the student has no active enrollment in currentGroupId", async () => {
    (auth as any).mockResolvedValue({ user: { id: "a1", role: "ADMIN" } });
    (prisma.enrollment.findFirst as any).mockResolvedValue(null);
    const res = await POST(jsonRequest(VALID_BODY));
    expect(res.status).toBe(404);
    expect(prisma.groupChangeRequest.create).not.toHaveBeenCalled();
  });

  it("returns 403 when STAFF's scope doesn't include the student's campus", async () => {
    (auth as any).mockResolvedValue({ user: { id: "s1", role: "STAFF" } });
    (prisma.enrollment.findFirst as any).mockResolvedValue({ id: "e1", student: { campusId: "c2" } });
    (assertCampusInScope as any).mockResolvedValue(false);
    const res = await POST(jsonRequest(VALID_BODY));
    expect(res.status).toBe(403);
    expect(prisma.groupChangeRequest.create).not.toHaveBeenCalled();
  });

  it("creates the request on success", async () => {
    (auth as any).mockResolvedValue({ user: { id: "a1", role: "ADMIN" } });
    (prisma.enrollment.findFirst as any).mockResolvedValue({ id: "e1", student: { campusId: "c1" } });
    (prisma.groupChangeRequest.create as any).mockResolvedValue({ id: "gcr1" });

    const res = await POST(jsonRequest(VALID_BODY));
    expect(res.status).toBe(201);
    expect(prisma.groupChangeRequest.create).toHaveBeenCalledWith({
      data: {
        type: "BAJA",
        studentId: "st1",
        currentGroupId: "g1",
        requestedGroupId: null,
        reason: "Cambio de ciudad",
        requestedById: "a1",
      },
    });
  });

  it("forces requestedGroupId to null for a BAJA request even if the client sends one", async () => {
    (auth as any).mockResolvedValue({ user: { id: "a1", role: "ADMIN" } });
    (prisma.enrollment.findFirst as any).mockResolvedValue({ id: "e1", student: { campusId: "c1" } });
    (prisma.groupChangeRequest.create as any).mockResolvedValue({ id: "gcr1" });

    const res = await POST(jsonRequest({ ...VALID_BODY, requestedGroupId: "g-sneaky" }));
    expect(res.status).toBe(201);
    expect(prisma.groupChangeRequest.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ requestedGroupId: null }),
    });
    expect(prisma.group.findUnique).not.toHaveBeenCalled();
  });

  it("returns 400 when requestedGroupId doesn't exist", async () => {
    (auth as any).mockResolvedValue({ user: { id: "a1", role: "ADMIN" } });
    (prisma.enrollment.findFirst as any).mockResolvedValue({ id: "e1", student: { campusId: "c1" } });
    (prisma.group.findUnique as any).mockResolvedValue(null);

    const res = await POST(
      jsonRequest({ ...VALID_BODY, type: "CAMBIO_GRUPO", requestedGroupId: "g-missing" })
    );
    expect(res.status).toBe(400);
    expect(prisma.groupChangeRequest.create).not.toHaveBeenCalled();
  });

  it("returns 400 when requestedGroupId is at a different campus than the student", async () => {
    (auth as any).mockResolvedValue({ user: { id: "a1", role: "ADMIN" } });
    (prisma.enrollment.findFirst as any).mockResolvedValue({ id: "e1", student: { campusId: "c1" } });
    (prisma.group.findUnique as any).mockResolvedValue({ id: "g2", campusId: "c2" });

    const res = await POST(
      jsonRequest({ ...VALID_BODY, type: "CAMBIO_GRUPO", requestedGroupId: "g2" })
    );
    expect(res.status).toBe(400);
    expect(prisma.groupChangeRequest.create).not.toHaveBeenCalled();
  });

  it("returns 400 when requestedGroupId is the same as currentGroupId", async () => {
    (auth as any).mockResolvedValue({ user: { id: "a1", role: "ADMIN" } });
    (prisma.enrollment.findFirst as any).mockResolvedValue({ id: "e1", student: { campusId: "c1" } });
    (prisma.group.findUnique as any).mockResolvedValue({ id: "g1", campusId: "c1" });

    const res = await POST(
      jsonRequest({ ...VALID_BODY, type: "CAMBIO_GRUPO", requestedGroupId: "g1" })
    );
    expect(res.status).toBe(400);
    expect(prisma.groupChangeRequest.create).not.toHaveBeenCalled();
  });

  it("creates a CAMBIO_GRUPO request when requestedGroupId is valid and same-campus", async () => {
    (auth as any).mockResolvedValue({ user: { id: "a1", role: "ADMIN" } });
    (prisma.enrollment.findFirst as any).mockResolvedValue({ id: "e1", student: { campusId: "c1" } });
    (prisma.group.findUnique as any).mockResolvedValue({ id: "g2", campusId: "c1" });
    (prisma.groupChangeRequest.create as any).mockResolvedValue({ id: "gcr1" });

    const res = await POST(
      jsonRequest({ ...VALID_BODY, type: "CAMBIO_GRUPO", requestedGroupId: "g2" })
    );
    expect(res.status).toBe(201);
    expect(prisma.groupChangeRequest.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ requestedGroupId: "g2" }),
    });
  });
});
