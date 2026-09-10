import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    materialCarpeta: { findMany: vi.fn() },
    materialLibraryItem: { findMany: vi.fn() },
  },
}));

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { GET } from "@/app/api/portal/material-carpetas/route";

describe("GET /api/portal/material-carpetas", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 403 for a non-teacher role", async () => {
    (auth as any).mockResolvedValue({ user: { id: "s1", role: "STUDENT" } });
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("only exposes items for carpetas with an APROBADA request", async () => {
    (auth as any).mockResolvedValue({ user: { id: "t1", role: "TEACHER" } });
    (prisma.materialCarpeta.findMany as any).mockResolvedValue([
      { id: "c1", nombre: "A1", descripcion: null, requests: [{ status: "APROBADA" }] },
      { id: "c2", nombre: "A2", descripcion: null, requests: [{ status: "PENDIENTE" }] },
      { id: "c3", nombre: "A3", descripcion: null, requests: [] },
    ]);
    (prisma.materialLibraryItem.findMany as any).mockResolvedValue([
      { id: "i1", carpetaId: "c1", titulo: "Examen" },
    ]);

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([
      { id: "c1", nombre: "A1", descripcion: null, accessStatus: "APROBADA", items: [expect.objectContaining({ id: "i1" })] },
      { id: "c2", nombre: "A2", descripcion: null, accessStatus: "PENDIENTE", items: [] },
      { id: "c3", nombre: "A3", descripcion: null, accessStatus: null, items: [] },
    ]);
    expect(prisma.materialLibraryItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { carpetaId: { in: ["c1"] } } })
    );
  });

  it("skips the items query entirely when no carpeta is approved", async () => {
    (auth as any).mockResolvedValue({ user: { id: "t1", role: "TEACHER" } });
    (prisma.materialCarpeta.findMany as any).mockResolvedValue([
      { id: "c1", nombre: "A1", descripcion: null, requests: [] },
    ]);

    const res = await GET();
    expect(res.status).toBe(200);
    expect(prisma.materialLibraryItem.findMany).not.toHaveBeenCalled();
  });
});
