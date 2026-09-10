import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/campus-scope", () => ({ getCampusScope: vi.fn() }));
vi.mock("@/lib/staff-permissions", () => ({ hasModuleAccess: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    cashMovement: { findMany: vi.fn(), create: vi.fn() },
    cashRegisterSession: { findFirst: vi.fn() },
  },
}));

import { auth } from "@/lib/auth";
import { getCampusScope } from "@/lib/campus-scope";
import { hasModuleAccess } from "@/lib/staff-permissions";
import { prisma } from "@/lib/prisma";
import { GET, POST } from "@/app/api/admin/movimientos-caja/route";

function jsonRequest(body?: unknown) {
  return new Request("http://localhost/api/admin/movimientos-caja", {
    method: "POST",
    body: body !== undefined ? JSON.stringify(body) : undefined,
    headers: { "Content-Type": "application/json" },
  });
}

describe("GET /api/admin/movimientos-caja", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 without a session", async () => {
    (auth as any).mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });
});

describe("POST /api/admin/movimientos-caja", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects an invalid tipo", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1", role: "STAFF" } });
    (hasModuleAccess as any).mockResolvedValue("full");

    const res = await POST(jsonRequest({ campusId: "c1", tipo: "BOGUS", concepto: "x", montoCents: 100 }));
    expect(res.status).toBe(400);
  });

  it("rejects a non-positive montoCents", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1", role: "STAFF" } });
    (hasModuleAccess as any).mockResolvedValue("full");

    const res = await POST(jsonRequest({ campusId: "c1", tipo: "SALIDA", concepto: "x", montoCents: 0 }));
    expect(res.status).toBe(400);
  });

  it("rejects a campus outside scope", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1", role: "STAFF" } });
    (hasModuleAccess as any).mockResolvedValue("full");
    (getCampusScope as any).mockResolvedValue({ type: "CAMPUS_LIST", campusIds: ["c1"] });

    const res = await POST(jsonRequest({ campusId: "c2", tipo: "SALIDA", concepto: "x", montoCents: 100 }));
    expect(res.status).toBe(403);
    expect(prisma.cashMovement.create).not.toHaveBeenCalled();
  });

  // 2026-09-09: a manual movement now requires an open día-de-caja, same
  // as a POS sale or collecting an invoice payment.
  it("returns 400 when the campus has no open cash-register session", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1", role: "STAFF" } });
    (hasModuleAccess as any).mockResolvedValue("full");
    (getCampusScope as any).mockResolvedValue({ type: "ALL" });
    (prisma.cashRegisterSession.findFirst as any).mockResolvedValue(null);

    const res = await POST(jsonRequest({ campusId: "c1", tipo: "SALIDA", concepto: "Compra de plumones", montoCents: 5000 }));
    expect(res.status).toBe(400);
    expect(prisma.cashMovement.create).not.toHaveBeenCalled();
  });

  it("creates a manual movement tied to the acting user and the open session", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1", role: "STAFF" } });
    (hasModuleAccess as any).mockResolvedValue("full");
    (getCampusScope as any).mockResolvedValue({ type: "ALL" });
    (prisma.cashRegisterSession.findFirst as any).mockResolvedValue({ id: "session1" });
    (prisma.cashMovement.create as any).mockResolvedValue({ id: "cm1" });

    const res = await POST(jsonRequest({ campusId: "c1", tipo: "SALIDA", concepto: "Compra de plumones", montoCents: 5000 }));
    expect(res.status).toBe(201);
    expect(prisma.cashMovement.create).toHaveBeenCalledWith({
      data: {
        campusId: "c1",
        tipo: "SALIDA",
        concepto: "Compra de plumones",
        montoCents: 5000,
        cashRegisterSessionId: "session1",
        createdById: "u1",
      },
    });
  });
});
