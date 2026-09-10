import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/staff-permissions", () => ({ hasModuleAccess: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    materialCarpeta: { findMany: vi.fn(), create: vi.fn() },
  },
}));

import { auth } from "@/lib/auth";
import { hasModuleAccess } from "@/lib/staff-permissions";
import { prisma } from "@/lib/prisma";
import { GET, POST } from "@/app/api/admin/material-carpetas/route";

function jsonRequest(body?: unknown) {
  return new Request("http://localhost/api/admin/material-carpetas", {
    method: "POST",
    body: body !== undefined ? JSON.stringify(body) : undefined,
    headers: { "Content-Type": "application/json" },
  });
}

describe("GET /api/admin/material-carpetas", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 403 without full solicitudes access", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1", role: "STAFF" } });
    (hasModuleAccess as any).mockResolvedValue("initiate");
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("shapes each carpeta with item and pending-request counts", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1", role: "STAFF" } });
    (hasModuleAccess as any).mockResolvedValue("full");
    (prisma.materialCarpeta.findMany as any).mockResolvedValue([
      {
        id: "c1",
        nombre: "Nivel A1",
        descripcion: null,
        createdAt: new Date("2026-01-01"),
        createdBy: { name: "Control Escolar" },
        _count: { items: 3 },
        requests: [{ id: "r1" }],
      },
    ]);

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([
      expect.objectContaining({ id: "c1", itemCount: 3, pendingRequestCount: 1, createdByName: "Control Escolar" }),
    ]);
  });
});

describe("POST /api/admin/material-carpetas", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 without a session", async () => {
    (auth as any).mockResolvedValue(null);
    const res = await POST(jsonRequest({ nombre: "Nivel A1" }));
    expect(res.status).toBe(401);
  });

  it("rejects an empty nombre", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1", role: "STAFF" } });
    (hasModuleAccess as any).mockResolvedValue("full");
    const res = await POST(jsonRequest({ nombre: "   " }));
    expect(res.status).toBe(400);
    expect(prisma.materialCarpeta.create).not.toHaveBeenCalled();
  });

  it("creates a carpeta attributed to the acting user", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1", role: "STAFF" } });
    (hasModuleAccess as any).mockResolvedValue("full");
    (prisma.materialCarpeta.create as any).mockResolvedValue({ id: "c1" });

    const res = await POST(jsonRequest({ nombre: "Nivel A1", descripcion: "Guías y exámenes" }));
    expect(res.status).toBe(201);
    expect(prisma.materialCarpeta.create).toHaveBeenCalledWith({
      data: { nombre: "Nivel A1", descripcion: "Guías y exámenes", createdById: "u1" },
    });
  });
});
