import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/campus-scope", () => ({ getCampusScope: vi.fn() }));
vi.mock("@/lib/staff-permissions", () => ({ hasModuleAccess: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    recursoMaterial: { findMany: vi.fn(), create: vi.fn() },
  },
}));

import { auth } from "@/lib/auth";
import { getCampusScope } from "@/lib/campus-scope";
import { hasModuleAccess } from "@/lib/staff-permissions";
import { prisma } from "@/lib/prisma";
import { GET, POST } from "@/app/api/admin/recursos-materiales/route";

function jsonRequest(body?: unknown) {
  return new Request("http://localhost/api/admin/recursos-materiales", {
    method: "POST",
    body: body !== undefined ? JSON.stringify(body) : undefined,
    headers: { "Content-Type": "application/json" },
  });
}

describe("GET /api/admin/recursos-materiales", () => {
  beforeEach(() => vi.clearAllMocks());

  it("scopes the list to the caller's campuses", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1", role: "STAFF" } });
    (hasModuleAccess as any).mockResolvedValue("read");
    (getCampusScope as any).mockResolvedValue({ type: "CAMPUS_LIST", campusIds: ["c1"] });
    (prisma.recursoMaterial.findMany as any).mockResolvedValue([]);

    const res = await GET();
    expect(res.status).toBe(200);
    expect(prisma.recursoMaterial.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { campusId: { in: ["c1"] } } })
    );
  });
});

describe("POST /api/admin/recursos-materiales", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 403 with read-only access", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1", role: "STAFF" } });
    (hasModuleAccess as any).mockResolvedValue("read");
    const res = await POST(jsonRequest({ nombre: "Libro A1", campusId: "c1" }));
    expect(res.status).toBe(403);
  });

  it("rejects a campus outside the caller's scope", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1", role: "STAFF" } });
    (hasModuleAccess as any).mockResolvedValue("full");
    (getCampusScope as any).mockResolvedValue({ type: "CAMPUS_LIST", campusIds: ["c1"] });

    const res = await POST(jsonRequest({ nombre: "Libro A1", campusId: "c2" }));
    expect(res.status).toBe(403);
    expect(prisma.recursoMaterial.create).not.toHaveBeenCalled();
  });

  it("rejects a negative cantidadDisponible", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1", role: "STAFF" } });
    (hasModuleAccess as any).mockResolvedValue("full");
    (getCampusScope as any).mockResolvedValue({ type: "ALL" });

    const res = await POST(jsonRequest({ nombre: "Libro A1", campusId: "c1", cantidadDisponible: -1 }));
    expect(res.status).toBe(400);
  });

  it("creates a resource within scope", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1", role: "STAFF" } });
    (hasModuleAccess as any).mockResolvedValue("full");
    (getCampusScope as any).mockResolvedValue({ type: "ALL" });
    (prisma.recursoMaterial.create as any).mockResolvedValue({ id: "r1" });

    const res = await POST(jsonRequest({ nombre: "Libro A1", campusId: "c1", cantidadDisponible: 5, precioUnitarioCents: 20000 }));
    expect(res.status).toBe(201);
    expect(prisma.recursoMaterial.create).toHaveBeenCalledWith({
      data: { nombre: "Libro A1", campusId: "c1", cantidadDisponible: 5, precioUnitarioCents: 20000 },
    });
  });
});
