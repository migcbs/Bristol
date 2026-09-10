import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/notifications", () => ({ notify: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    materialCarpeta: { findUnique: vi.fn() },
    materialAccessRequest: { findFirst: vi.fn(), create: vi.fn() },
    user: { findMany: vi.fn() },
  },
}));

import { auth } from "@/lib/auth";
import { notify } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { POST } from "@/app/api/portal/material-access-requests/route";

function jsonRequest(body?: unknown) {
  return new Request("http://localhost/api/portal/material-access-requests", {
    method: "POST",
    body: body !== undefined ? JSON.stringify(body) : undefined,
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/portal/material-access-requests", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 403 for a non-teacher role", async () => {
    (auth as any).mockResolvedValue({ user: { id: "s1", role: "STUDENT" } });
    const res = await POST(jsonRequest({ carpetaId: "c1" }));
    expect(res.status).toBe(403);
  });

  it("returns 404 for a nonexistent carpeta", async () => {
    (auth as any).mockResolvedValue({ user: { id: "t1", role: "TEACHER" } });
    (prisma.materialCarpeta.findUnique as any).mockResolvedValue(null);
    const res = await POST(jsonRequest({ carpetaId: "c1" }));
    expect(res.status).toBe(404);
  });

  it("returns 409 when the teacher already has an APROBADA request", async () => {
    (auth as any).mockResolvedValue({ user: { id: "t1", role: "TEACHER" } });
    (prisma.materialCarpeta.findUnique as any).mockResolvedValue({ id: "c1", nombre: "A1" });
    (prisma.materialAccessRequest.findFirst as any).mockResolvedValue({ status: "APROBADA" });
    const res = await POST(jsonRequest({ carpetaId: "c1" }));
    expect(res.status).toBe(409);
    expect(prisma.materialAccessRequest.create).not.toHaveBeenCalled();
  });

  it("returns 409 when a PENDIENTE request already exists", async () => {
    (auth as any).mockResolvedValue({ user: { id: "t1", role: "TEACHER" } });
    (prisma.materialCarpeta.findUnique as any).mockResolvedValue({ id: "c1", nombre: "A1" });
    (prisma.materialAccessRequest.findFirst as any).mockResolvedValue({ status: "PENDIENTE" });
    const res = await POST(jsonRequest({ carpetaId: "c1" }));
    expect(res.status).toBe(409);
  });

  it("allows a fresh request after a RECHAZADA one", async () => {
    (auth as any).mockResolvedValue({ user: { id: "t1", role: "TEACHER" } });
    (prisma.materialCarpeta.findUnique as any).mockResolvedValue({ id: "c1", nombre: "A1" });
    (prisma.materialAccessRequest.findFirst as any).mockResolvedValue(null);
    (prisma.materialAccessRequest.create as any).mockResolvedValue({ id: "r1" });
    (prisma.user.findMany as any).mockResolvedValue([{ id: "admin1" }]);

    const res = await POST(jsonRequest({ carpetaId: "c1", motivo: "Preparar clases" }));
    expect(res.status).toBe(201);
    expect(prisma.materialAccessRequest.create).toHaveBeenCalledWith({
      data: { carpetaId: "c1", teacherId: "t1", motivo: "Preparar clases" },
    });
    expect(notify).toHaveBeenCalledWith("admin1", expect.stringContaining("A1"), "/admin/control-escolar/biblioteca");
  });
});
