import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/campus-scope", () => ({ getCampusScope: vi.fn() }));
vi.mock("@/lib/staff-permissions", () => ({ hasModuleAccess: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    invoice: { findUnique: vi.fn(), update: vi.fn() },
    cashMovement: { create: vi.fn() },
    cashRegisterSession: { findFirst: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import { auth } from "@/lib/auth";
import { getCampusScope } from "@/lib/campus-scope";
import { hasModuleAccess } from "@/lib/staff-permissions";
import { prisma } from "@/lib/prisma";
import { PATCH } from "@/app/api/admin/invoices/[id]/route";

function jsonRequest(body?: unknown) {
  return new Request("http://localhost/api/admin/invoices/i1", {
    method: "PATCH",
    body: body !== undefined ? JSON.stringify(body) : undefined,
    headers: { "Content-Type": "application/json" },
  });
}

function ctx(id = "i1") {
  return { params: Promise.resolve({ id }) };
}

describe("PATCH /api/admin/invoices/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 without a session", async () => {
    (auth as any).mockResolvedValue(null);
    const res = await PATCH(jsonRequest({ action: "mark-paid" }), ctx());
    expect(res.status).toBe(401);
  });

  it("returns 403 when cobranzas access is read-only", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1", role: "STAFF" } });
    (hasModuleAccess as any).mockResolvedValue("read");
    const res = await PATCH(jsonRequest({ action: "mark-paid" }), ctx());
    expect(res.status).toBe(403);
  });

  it("returns 400 for an unrecognized action", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1", role: "STAFF" } });
    (hasModuleAccess as any).mockResolvedValue("full");
    const res = await PATCH(jsonRequest({ action: "bogus" }), ctx());
    expect(res.status).toBe(400);
  });

  it("returns 404 when the invoice is outside the caller's campus scope", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1", role: "STAFF" } });
    (hasModuleAccess as any).mockResolvedValue("full");
    (prisma.invoice.findUnique as any).mockResolvedValue({
      id: "i1",
      status: "PENDING",
      student: { campusId: "c2" },
    });
    (getCampusScope as any).mockResolvedValue({ type: "CAMPUS_LIST", campusIds: ["c1"] });

    const res = await PATCH(jsonRequest({ action: "mark-paid" }), ctx());
    expect(res.status).toBe(404);
  });

  it("returns 400 when the invoice is already paid or canceled", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1", role: "STAFF" } });
    (hasModuleAccess as any).mockResolvedValue("full");
    (prisma.invoice.findUnique as any).mockResolvedValue({
      id: "i1",
      status: "PAID",
      student: { campusId: "c1" },
    });
    (getCampusScope as any).mockResolvedValue({ type: "ALL" });

    const res = await PATCH(jsonRequest({ action: "mark-paid" }), ctx());
    expect(res.status).toBe(400);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("marks a pending invoice paid and creates a matching CashMovement", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1", role: "STAFF" } });
    (hasModuleAccess as any).mockResolvedValue("full");
    (prisma.invoice.findUnique as any).mockResolvedValue({
      id: "i1",
      status: "PENDING",
      description: "Colegiatura",
      amountCents: 150000,
      student: { campusId: "c1" },
    });
    (getCampusScope as any).mockResolvedValue({ type: "ALL" });
    (prisma.cashRegisterSession.findFirst as any).mockResolvedValue({ id: "session1" });
    (prisma.$transaction as any).mockResolvedValue([{ id: "i1", status: "PAID" }, { id: "cm1" }]);

    const res = await PATCH(jsonRequest({ action: "mark-paid" }), ctx());
    expect(res.status).toBe(200);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    const calledWith = (prisma.$transaction as any).mock.calls[0][0];
    expect(calledWith).toHaveLength(2);
  });

  // 2026-09-09: collecting cash now requires an open día-de-caja, same as
  // a POS sale or a manual movement — otherwise it could never show up in
  // that day's corte/cierre totals.
  it("returns 400 when the campus has no open cash-register session", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1", role: "STAFF" } });
    (hasModuleAccess as any).mockResolvedValue("full");
    (prisma.invoice.findUnique as any).mockResolvedValue({
      id: "i1",
      status: "PENDING",
      description: "Colegiatura",
      amountCents: 150000,
      student: { campusId: "c1" },
    });
    (getCampusScope as any).mockResolvedValue({ type: "ALL" });
    (prisma.cashRegisterSession.findFirst as any).mockResolvedValue(null);

    const res = await PATCH(jsonRequest({ action: "mark-paid" }), ctx());
    expect(res.status).toBe(400);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
