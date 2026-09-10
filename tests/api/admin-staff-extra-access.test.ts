import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn(), update: vi.fn() },
  },
}));

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PATCH } from "@/app/api/admin/staff/[id]/extra-access/route";

function jsonRequest(body?: unknown) {
  return new Request("http://localhost/api/admin/staff/s1/extra-access", {
    method: "PATCH",
    body: body !== undefined ? JSON.stringify(body) : undefined,
    headers: { "Content-Type": "application/json" },
  });
}
function ctx(id = "s1") {
  return { params: Promise.resolve({ id }) };
}

describe("PATCH /api/admin/staff/[id]/extra-access", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 403 for a non-ADMIN caller", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1", role: "STAFF" } });
    const res = await PATCH(jsonRequest({ module: "resenas", grant: true }), ctx());
    expect(res.status).toBe(403);
  });

  it("rejects a module outside the grantable allowlist", async () => {
    (auth as any).mockResolvedValue({ user: { id: "a1", role: "ADMIN" } });
    const res = await PATCH(jsonRequest({ module: "cobranzas", grant: true }), ctx());
    expect(res.status).toBe(400);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("returns 404 when the target isn't a STAFF account", async () => {
    (auth as any).mockResolvedValue({ user: { id: "a1", role: "ADMIN" } });
    (prisma.user.findUnique as any).mockResolvedValue({ role: "ADMIN", extraModuleAccess: [] });
    const res = await PATCH(jsonRequest({ module: "resenas", grant: true }), ctx());
    expect(res.status).toBe(404);
  });

  it("grants a module without duplicating an existing entry", async () => {
    (auth as any).mockResolvedValue({ user: { id: "a1", role: "ADMIN" } });
    (prisma.user.findUnique as any).mockResolvedValue({ role: "STAFF", extraModuleAccess: ["resenas"] });
    (prisma.user.update as any).mockResolvedValue({ id: "s1", extraModuleAccess: ["resenas"] });

    const res = await PATCH(jsonRequest({ module: "resenas", grant: true }), ctx());
    expect(res.status).toBe(200);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "s1" },
      data: { extraModuleAccess: ["resenas"] },
      select: { id: true, extraModuleAccess: true },
    });
  });

  it("revokes a module", async () => {
    (auth as any).mockResolvedValue({ user: { id: "a1", role: "ADMIN" } });
    (prisma.user.findUnique as any).mockResolvedValue({ role: "STAFF", extraModuleAccess: ["resenas"] });
    (prisma.user.update as any).mockResolvedValue({ id: "s1", extraModuleAccess: [] });

    const res = await PATCH(jsonRequest({ module: "resenas", grant: false }), ctx());
    expect(res.status).toBe(200);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "s1" },
      data: { extraModuleAccess: [] },
      select: { id: true, extraModuleAccess: true },
    });
  });
});
