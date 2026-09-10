import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/staff-permissions", () => ({ hasModuleAccess: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    conceptoPago: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn() },
  },
}));

import { auth } from "@/lib/auth";
import { hasModuleAccess } from "@/lib/staff-permissions";
import { prisma } from "@/lib/prisma";
import { GET, POST } from "@/app/api/admin/concepto-pagos/route";

function jsonRequest(body?: unknown) {
  return new Request("http://localhost/api/admin/concepto-pagos", {
    method: "POST",
    body: body !== undefined ? JSON.stringify(body) : undefined,
    headers: { "Content-Type": "application/json" },
  });
}

describe("GET /api/admin/concepto-pagos", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 403 with no module access", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1", role: "STAFF" } });
    (hasModuleAccess as any).mockResolvedValue("none");
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("lists only active conceptos, ordered by name", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1", role: "STAFF" } });
    (hasModuleAccess as any).mockResolvedValue("read");
    (prisma.conceptoPago.findMany as any).mockResolvedValue([]);

    const res = await GET();
    expect(res.status).toBe(200);
    expect(prisma.conceptoPago.findMany).toHaveBeenCalledWith({
      where: { activo: true },
      orderBy: { nombre: "asc" },
    });
  });
});

describe("POST /api/admin/concepto-pagos", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 403 with read-only access", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1", role: "STAFF" } });
    (hasModuleAccess as any).mockResolvedValue("read");
    const res = await POST(jsonRequest({ nombre: "Inscripción" }));
    expect(res.status).toBe(403);
  });

  it("rejects an empty nombre", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1", role: "STAFF" } });
    (hasModuleAccess as any).mockResolvedValue("full");
    const res = await POST(jsonRequest({ nombre: "   " }));
    expect(res.status).toBe(400);
  });

  it("rejects a duplicate nombre", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1", role: "STAFF" } });
    (hasModuleAccess as any).mockResolvedValue("full");
    (prisma.conceptoPago.findUnique as any).mockResolvedValue({ id: "cp1" });

    const res = await POST(jsonRequest({ nombre: "Inscripción" }));
    expect(res.status).toBe(409);
    expect(prisma.conceptoPago.create).not.toHaveBeenCalled();
  });

  it("creates a concepto with a trimmed name", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1", role: "STAFF" } });
    (hasModuleAccess as any).mockResolvedValue("initiate");
    (prisma.conceptoPago.findUnique as any).mockResolvedValue(null);
    (prisma.conceptoPago.create as any).mockResolvedValue({ id: "cp1", nombre: "Inscripción" });

    const res = await POST(jsonRequest({ nombre: "  Inscripción  ", montoDefaultCents: 200000 }));
    expect(res.status).toBe(201);
    expect(prisma.conceptoPago.create).toHaveBeenCalledWith({
      data: { nombre: "Inscripción", montoDefaultCents: 200000 },
    });
  });
});
