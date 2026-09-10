import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    materialLibraryItem: { findUnique: vi.fn(), delete: vi.fn() },
  },
}));

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DELETE } from "@/app/api/admin/material-carpetas/[id]/items/[itemId]/route";

function ctx(id = "c1", itemId = "i1") {
  return { params: Promise.resolve({ id, itemId }) };
}

// Deleting a library item is ADMIN-only (confirmed with the user
// 2026-09-09) — a STAFF account, even with full biblioteca_material
// access, cannot delete.
describe("DELETE /api/admin/material-carpetas/[id]/items/[itemId]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 without a session", async () => {
    (auth as any).mockResolvedValue(null);
    const res = await DELETE(new Request("http://localhost"), ctx());
    expect(res.status).toBe(401);
  });

  it("returns 403 for a STAFF account, even with full biblioteca_material access", async () => {
    (auth as any).mockResolvedValue({ user: { id: "s1", role: "STAFF" } });
    const res = await DELETE(new Request("http://localhost"), ctx());
    expect(res.status).toBe(403);
    expect(prisma.materialLibraryItem.delete).not.toHaveBeenCalled();
  });

  it("returns 404 when the item doesn't belong to the given carpeta", async () => {
    (auth as any).mockResolvedValue({ user: { id: "a1", role: "ADMIN" } });
    (prisma.materialLibraryItem.findUnique as any).mockResolvedValue({ id: "i1", carpetaId: "other-carpeta" });
    const res = await DELETE(new Request("http://localhost"), ctx());
    expect(res.status).toBe(404);
    expect(prisma.materialLibraryItem.delete).not.toHaveBeenCalled();
  });

  it("deletes the item for ADMIN", async () => {
    (auth as any).mockResolvedValue({ user: { id: "a1", role: "ADMIN" } });
    (prisma.materialLibraryItem.findUnique as any).mockResolvedValue({ id: "i1", carpetaId: "c1" });
    const res = await DELETE(new Request("http://localhost"), ctx());
    expect(res.status).toBe(204);
    expect(prisma.materialLibraryItem.delete).toHaveBeenCalledWith({ where: { id: "i1" } });
  });
});
