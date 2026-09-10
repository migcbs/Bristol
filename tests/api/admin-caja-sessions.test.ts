import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/campus-scope", () => ({ assertCampusInScope: vi.fn() }));
vi.mock("@/lib/staff-permissions", () => ({ hasModuleAccess: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    cashRegisterSession: { findFirst: vi.fn(), create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  },
}));

import { auth } from "@/lib/auth";
import { assertCampusInScope } from "@/lib/campus-scope";
import { hasModuleAccess } from "@/lib/staff-permissions";
import { prisma } from "@/lib/prisma";
import { POST, GET } from "@/app/api/admin/caja/sessions/route";
import { POST as CLOSE } from "@/app/api/admin/caja/sessions/[id]/close/route";

function jsonRequest(url: string, body?: unknown) {
  return new Request(url, {
    method: "POST",
    body: body !== undefined ? JSON.stringify(body) : undefined,
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/admin/caja/sessions (abrir caja)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 without a session", async () => {
    (auth as any).mockResolvedValue(null);
    const res = await POST(jsonRequest("http://localhost", { campusId: "c1", openingCents: 50000 }));
    expect(res.status).toBe(401);
  });

  it("returns 403 for a puesto without full recursos_caja access", async () => {
    (auth as any).mockResolvedValue({ user: { id: "s1", role: "STAFF" } });
    (hasModuleAccess as any).mockResolvedValue("read");
    const res = await POST(jsonRequest("http://localhost", { campusId: "c1", openingCents: 50000 }));
    expect(res.status).toBe(403);
  });

  it("rejects opening a caja that's already open", async () => {
    (auth as any).mockResolvedValue({ user: { id: "s1", role: "STAFF" } });
    (hasModuleAccess as any).mockResolvedValue("full");
    (assertCampusInScope as any).mockResolvedValue(true);
    (prisma.cashRegisterSession.findFirst as any).mockResolvedValue({ id: "existing" });

    const res = await POST(jsonRequest("http://localhost", { campusId: "c1", openingCents: 50000 }));
    expect(res.status).toBe(400);
    expect(prisma.cashRegisterSession.create).not.toHaveBeenCalled();
  });

  it("opens a new session", async () => {
    (auth as any).mockResolvedValue({ user: { id: "s1", role: "STAFF" } });
    (hasModuleAccess as any).mockResolvedValue("full");
    (assertCampusInScope as any).mockResolvedValue(true);
    (prisma.cashRegisterSession.findFirst as any).mockResolvedValue(null);
    (prisma.cashRegisterSession.create as any).mockResolvedValue({ id: "new-session" });

    const res = await POST(jsonRequest("http://localhost", { campusId: "c1", openingCents: 50000 }));
    expect(res.status).toBe(201);
    expect(prisma.cashRegisterSession.create).toHaveBeenCalledWith({
      data: { campusId: "c1", openedById: "s1", openingCents: 50000 },
    });
  });
});

describe("GET /api/admin/caja/sessions (estado activo)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns { session: null } when nothing is open", async () => {
    (auth as any).mockResolvedValue({ user: { id: "s1", role: "STAFF" } });
    (hasModuleAccess as any).mockResolvedValue("full");
    (assertCampusInScope as any).mockResolvedValue(true);
    (prisma.cashRegisterSession.findFirst as any).mockResolvedValue(null);

    const res = await GET(new Request("http://localhost?campusId=c1"));
    const body = await res.json();
    expect(body).toEqual({ session: null });
  });

  it("computes live totals from the session's movements", async () => {
    (auth as any).mockResolvedValue({ user: { id: "s1", role: "STAFF" } });
    (hasModuleAccess as any).mockResolvedValue("full");
    (assertCampusInScope as any).mockResolvedValue(true);
    (prisma.cashRegisterSession.findFirst as any).mockResolvedValue({
      id: "sess1",
      openedAt: new Date("2026-09-10T08:00:00Z"),
      openedBy: { name: "Caja Xalapa" },
      openingCents: 50000,
      movements: [
        { tipo: "ENTRADA", montoCents: 150000 },
        { tipo: "ENTRADA", montoCents: 35000 },
        { tipo: "SALIDA", montoCents: 20000 },
      ],
    });

    const res = await GET(new Request("http://localhost?campusId=c1"));
    const body = await res.json();
    expect(body.session.entradasCents).toBe(185000);
    expect(body.session.salidasCents).toBe(20000);
    expect(body.session.expectedCents).toBe(50000 + 185000 - 20000);
  });
});

describe("POST /api/admin/caja/sessions/[id]/close (cerrar caja)", () => {
  beforeEach(() => vi.clearAllMocks());

  function ctx(id = "sess1") {
    return { params: Promise.resolve({ id }) };
  }

  it("returns 400 when the session is already closed", async () => {
    (auth as any).mockResolvedValue({ user: { id: "s1", role: "STAFF" } });
    (hasModuleAccess as any).mockResolvedValue("full");
    (assertCampusInScope as any).mockResolvedValue(true);
    (prisma.cashRegisterSession.findUnique as any).mockResolvedValue({
      id: "sess1",
      campusId: "c1",
      status: "CERRADA",
      movements: [],
    });

    const res = await CLOSE(jsonRequest("http://localhost", { closingCountedCents: 50000 }), ctx());
    expect(res.status).toBe(400);
    expect(prisma.cashRegisterSession.update).not.toHaveBeenCalled();
  });

  it("closes the session and reports the diff against the theoretical total", async () => {
    (auth as any).mockResolvedValue({ user: { id: "s1", role: "STAFF" } });
    (hasModuleAccess as any).mockResolvedValue("full");
    (assertCampusInScope as any).mockResolvedValue(true);
    (prisma.cashRegisterSession.findUnique as any).mockResolvedValue({
      id: "sess1",
      campusId: "c1",
      status: "ABIERTA",
      openingCents: 50000,
      movements: [
        { tipo: "ENTRADA", montoCents: 150000 },
        { tipo: "SALIDA", montoCents: 10000 },
      ],
    });
    (prisma.cashRegisterSession.update as any).mockResolvedValue({ id: "sess1", status: "CERRADA" });

    // Theoretical: 50000 + 150000 - 10000 = 190000; counted 189000 => diff -1000
    const res = await CLOSE(jsonRequest("http://localhost", { closingCountedCents: 189000 }), ctx());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.expectedCents).toBe(190000);
    expect(body.diffCents).toBe(-1000);
  });
});
