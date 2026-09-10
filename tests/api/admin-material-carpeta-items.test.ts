import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/staff-permissions", () => ({ hasModuleAccess: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    materialCarpeta: { findUnique: vi.fn() },
    materialLibraryItem: { create: vi.fn() },
  },
}));

import { auth } from "@/lib/auth";
import { hasModuleAccess } from "@/lib/staff-permissions";
import { prisma } from "@/lib/prisma";
import { POST } from "@/app/api/admin/material-carpetas/[id]/items/route";

function jsonRequest(body?: unknown) {
  return new Request("http://localhost/api/admin/material-carpetas/c1/items", {
    method: "POST",
    body: body !== undefined ? JSON.stringify(body) : undefined,
    headers: { "Content-Type": "application/json" },
  });
}

function ctx(id = "c1") {
  return { params: Promise.resolve({ id }) };
}

describe("POST /api/admin/material-carpetas/[id]/items", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 403 without full solicitudes access", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1", role: "STAFF" } });
    (hasModuleAccess as any).mockResolvedValue("read");
    const res = await POST(jsonRequest({ titulo: "Examen", url: "https://example.com/a.pdf" }), ctx());
    expect(res.status).toBe(403);
  });

  it("returns 404 when the carpeta doesn't exist", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1", role: "STAFF" } });
    (hasModuleAccess as any).mockResolvedValue("full");
    (prisma.materialCarpeta.findUnique as any).mockResolvedValue(null);
    const res = await POST(jsonRequest({ titulo: "Examen", url: "https://example.com/a.pdf" }), ctx());
    expect(res.status).toBe(404);
  });

  it("rejects a malformed URL", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1", role: "STAFF" } });
    (hasModuleAccess as any).mockResolvedValue("full");
    (prisma.materialCarpeta.findUnique as any).mockResolvedValue({ id: "c1" });
    const res = await POST(jsonRequest({ titulo: "Examen", url: "not-a-url" }), ctx());
    expect(res.status).toBe(400);
    expect(prisma.materialLibraryItem.create).not.toHaveBeenCalled();
  });

  it("creates an item attributed to the acting user", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1", role: "STAFF" } });
    (hasModuleAccess as any).mockResolvedValue("full");
    (prisma.materialCarpeta.findUnique as any).mockResolvedValue({ id: "c1" });
    (prisma.materialLibraryItem.create as any).mockResolvedValue({ id: "i1" });

    const res = await POST(
      jsonRequest({ titulo: "Examen A1", url: "https://example.com/a.pdf", descripcion: "Módulo 1" }),
      ctx()
    );
    expect(res.status).toBe(201);
    expect(prisma.materialLibraryItem.create).toHaveBeenCalledWith({
      data: { carpetaId: "c1", titulo: "Examen A1", url: "https://example.com/a.pdf", descripcion: "Módulo 1", uploadedById: "u1" },
    });
  });
});
