import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/campus-scope", () => ({ assertCampusInScope: vi.fn() }));
vi.mock("@/lib/staff-permissions", () => ({ hasModuleAccess: vi.fn() }));
vi.mock("@/lib/notifications", () => ({ notify: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    recursoMaterial: { findUnique: vi.fn(), update: vi.fn() },
    cashRegisterSession: { findFirst: vi.fn() },
    cashMovement: { create: vi.fn() },
    user: { findMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import { auth } from "@/lib/auth";
import { assertCampusInScope } from "@/lib/campus-scope";
import { hasModuleAccess } from "@/lib/staff-permissions";
import { notify } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { POST } from "@/app/api/admin/caja/pos/sale/route";

function jsonRequest(body?: unknown) {
  return new Request("http://localhost", {
    method: "POST",
    body: body !== undefined ? JSON.stringify(body) : undefined,
    headers: { "Content-Type": "application/json" },
  });
}

const RECURSO = {
  id: "r1",
  nombre: "Libro A1",
  campusId: "c1",
  cantidadDisponible: 10,
  precioUnitarioCents: 35000,
  stockMinimo: 5,
};

describe("POST /api/admin/caja/pos/sale", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 without a session", async () => {
    (auth as any).mockResolvedValue(null);
    const res = await POST(jsonRequest({ recursoMaterialId: "r1", cantidad: 1 }));
    expect(res.status).toBe(401);
  });

  it("returns 403 without full recursos_caja access", async () => {
    (auth as any).mockResolvedValue({ user: { id: "s1", role: "STAFF" } });
    (hasModuleAccess as any).mockResolvedValue("read");
    const res = await POST(jsonRequest({ recursoMaterialId: "r1", cantidad: 1 }));
    expect(res.status).toBe(403);
  });

  it("rejects selling more than is in stock", async () => {
    (auth as any).mockResolvedValue({ user: { id: "s1", role: "STAFF" } });
    (hasModuleAccess as any).mockResolvedValue("full");
    (assertCampusInScope as any).mockResolvedValue(true);
    (prisma.recursoMaterial.findUnique as any).mockResolvedValue(RECURSO);

    const res = await POST(jsonRequest({ recursoMaterialId: "r1", cantidad: 99 }));
    expect(res.status).toBe(400);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejects the sale when the campus has no open caja session", async () => {
    (auth as any).mockResolvedValue({ user: { id: "s1", role: "STAFF" } });
    (hasModuleAccess as any).mockResolvedValue("full");
    (assertCampusInScope as any).mockResolvedValue(true);
    (prisma.recursoMaterial.findUnique as any).mockResolvedValue(RECURSO);
    (prisma.cashRegisterSession.findFirst as any).mockResolvedValue(null);

    const res = await POST(jsonRequest({ recursoMaterialId: "r1", cantidad: 1 }));
    expect(res.status).toBe(400);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("decrements stock and logs a CashMovement on a normal sale (no low-stock notification)", async () => {
    (auth as any).mockResolvedValue({ user: { id: "s1", role: "STAFF" } });
    (hasModuleAccess as any).mockResolvedValue("full");
    (assertCampusInScope as any).mockResolvedValue(true);
    (prisma.recursoMaterial.findUnique as any).mockResolvedValue(RECURSO);
    (prisma.cashRegisterSession.findFirst as any).mockResolvedValue({ id: "sess1" });
    (prisma.$transaction as any).mockResolvedValue([
      { ...RECURSO, cantidadDisponible: 8 },
      { id: "cm1" },
    ]);

    const res = await POST(jsonRequest({ recursoMaterialId: "r1", cantidad: 2 }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.remaining).toBe(8);
    expect(notify).not.toHaveBeenCalled();
  });

  it("notifies ADMIN and CAJA staff when the sale drops stock to/below stockMinimo", async () => {
    (auth as any).mockResolvedValue({ user: { id: "s1", role: "STAFF" } });
    (hasModuleAccess as any).mockResolvedValue("full");
    (assertCampusInScope as any).mockResolvedValue(true);
    (prisma.recursoMaterial.findUnique as any).mockResolvedValue(RECURSO);
    (prisma.cashRegisterSession.findFirst as any).mockResolvedValue({ id: "sess1" });
    (prisma.$transaction as any).mockResolvedValue([
      { ...RECURSO, cantidadDisponible: 3 },
      { id: "cm1" },
    ]);
    (prisma.user.findMany as any).mockResolvedValue([{ id: "admin1" }, { id: "caja1" }]);

    const res = await POST(jsonRequest({ recursoMaterialId: "r1", cantidad: 7 }));
    expect(res.status).toBe(201);
    expect(notify).toHaveBeenCalledTimes(2);
    expect(notify).toHaveBeenCalledWith("admin1", expect.stringContaining("Libro A1"), "/admin/caja/recursos-materiales");
  });
});
