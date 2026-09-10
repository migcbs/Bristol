import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/staff-permissions", () => ({ hasModuleAccess: vi.fn() }));
vi.mock("@/lib/notifications", () => ({ notify: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    materialAccessRequest: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  },
}));

import { auth } from "@/lib/auth";
import { hasModuleAccess } from "@/lib/staff-permissions";
import { notify } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { GET } from "@/app/api/admin/material-access-requests/route";
import { PATCH } from "@/app/api/admin/material-access-requests/[id]/route";

function ctx(id = "r1") {
  return { params: Promise.resolve({ id }) };
}
function patchRequest(body?: unknown) {
  return new Request("http://localhost/api/admin/material-access-requests/r1", {
    method: "PATCH",
    body: body !== undefined ? JSON.stringify(body) : undefined,
    headers: { "Content-Type": "application/json" },
  });
}

describe("GET /api/admin/material-access-requests", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 403 without full solicitudes access", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1", role: "STAFF" } });
    (hasModuleAccess as any).mockResolvedValue("read");
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("lists only pending requests, oldest first", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1", role: "STAFF" } });
    (hasModuleAccess as any).mockResolvedValue("full");
    (prisma.materialAccessRequest.findMany as any).mockResolvedValue([]);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(prisma.materialAccessRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: "PENDIENTE" }, orderBy: { createdAt: "asc" } })
    );
  });
});

describe("PATCH /api/admin/material-access-requests/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 for an invalid decision", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1", role: "STAFF" } });
    const res = await PATCH(patchRequest({ decision: "MAYBE" }), ctx());
    expect(res.status).toBe(400);
  });

  it("returns 403 without full solicitudes access", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1", role: "STAFF" } });
    (hasModuleAccess as any).mockResolvedValue("initiate");
    const res = await PATCH(patchRequest({ decision: "APROBADA" }), ctx());
    expect(res.status).toBe(403);
  });

  it("returns 400 when the request was already reviewed", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1", role: "STAFF" } });
    (hasModuleAccess as any).mockResolvedValue("full");
    (prisma.materialAccessRequest.findUnique as any).mockResolvedValue({
      id: "r1",
      status: "APROBADA",
      teacherId: "t1",
      carpeta: { nombre: "Nivel A1" },
    });
    const res = await PATCH(patchRequest({ decision: "RECHAZADA" }), ctx());
    expect(res.status).toBe(400);
    expect(prisma.materialAccessRequest.update).not.toHaveBeenCalled();
  });

  it("approves a pending request and notifies the teacher", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1", role: "STAFF" } });
    (hasModuleAccess as any).mockResolvedValue("full");
    (prisma.materialAccessRequest.findUnique as any).mockResolvedValue({
      id: "r1",
      status: "PENDIENTE",
      teacherId: "t1",
      carpeta: { nombre: "Nivel A1" },
    });
    (prisma.materialAccessRequest.update as any).mockResolvedValue({ id: "r1", status: "APROBADA" });

    const res = await PATCH(patchRequest({ decision: "APROBADA" }), ctx());
    expect(res.status).toBe(200);
    expect(prisma.materialAccessRequest.update).toHaveBeenCalledWith({
      where: { id: "r1" },
      data: { status: "APROBADA", reviewedById: "u1", reviewedAt: expect.any(Date) },
    });
    expect(notify).toHaveBeenCalledWith("t1", expect.stringContaining("Nivel A1"), "/portal/biblioteca");
  });
});
