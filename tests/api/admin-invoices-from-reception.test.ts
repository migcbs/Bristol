import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/campus-scope", () => ({ getCampusScope: vi.fn(), assertCampusInScope: vi.fn() }));
vi.mock("@/lib/staff-permissions", () => ({ hasModuleAccess: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { student: { findUnique: vi.fn() }, invoice: { create: vi.fn() } },
}));

import { auth } from "@/lib/auth";
import { assertCampusInScope } from "@/lib/campus-scope";
import { hasModuleAccess } from "@/lib/staff-permissions";
import { prisma } from "@/lib/prisma";
import { POST } from "@/app/api/admin/invoices/from-reception/route";

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/admin/invoices/from-reception", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

const VALID_BODY = {
  studentId: "st1",
  description: "Colegiatura septiembre",
  baseCents: 200000,
  dueDate: "2026-09-15",
};

describe("POST /api/admin/invoices/from-reception", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (hasModuleAccess as any).mockResolvedValue("full");
  });

  it("returns 401 without a session", async () => {
    (auth as any).mockResolvedValue(null);
    const res = await POST(jsonRequest(VALID_BODY));
    expect(res.status).toBe(401);
  });

  it("returns 403 for a TEACHER", async () => {
    (auth as any).mockResolvedValue({ user: { id: "t1", role: "TEACHER" } });
    const res = await POST(jsonRequest(VALID_BODY));
    expect(res.status).toBe(403);
  });

  it("returns 404 when the student doesn't exist", async () => {
    (auth as any).mockResolvedValue({ user: { id: "a1", role: "ADMIN" } });
    (prisma.student.findUnique as any).mockResolvedValue(null);
    const res = await POST(jsonRequest(VALID_BODY));
    expect(res.status).toBe(404);
    expect(prisma.invoice.create).not.toHaveBeenCalled();
  });

  it("returns 403 when STAFF targets a student outside their campus scope", async () => {
    (auth as any).mockResolvedValue({ user: { id: "s1", role: "STAFF" } });
    (prisma.student.findUnique as any).mockResolvedValue({ id: "st1", campusId: "c2" });
    (assertCampusInScope as any).mockResolvedValue(false);
    const res = await POST(jsonRequest(VALID_BODY));
    expect(res.status).toBe(403);
    expect(prisma.invoice.create).not.toHaveBeenCalled();
  });

  it("returns 400 when baseCents exceeds the upper bound", async () => {
    (auth as any).mockResolvedValue({ user: { id: "a1", role: "ADMIN" } });
    (prisma.student.findUnique as any).mockResolvedValue({ id: "st1", campusId: "c1" });
    const res = await POST(jsonRequest({ ...VALID_BODY, baseCents: 100_000_001 }));
    expect(res.status).toBe(400);
    expect(prisma.invoice.create).not.toHaveBeenCalled();
  });

  it("returns 400 for a scholarship percent out of 0-100 range", async () => {
    (auth as any).mockResolvedValue({ user: { id: "a1", role: "ADMIN" } });
    (prisma.student.findUnique as any).mockResolvedValue({ id: "st1", campusId: "c1" });
    const res = await POST(jsonRequest({ ...VALID_BODY, scholarshipPercent: 150 }));
    expect(res.status).toBe(400);
  });

  it("computes amountCents from base minus scholarship minus early-payment discount, and creates the invoice", async () => {
    (auth as any).mockResolvedValue({ user: { id: "a1", role: "ADMIN" } });
    (prisma.student.findUnique as any).mockResolvedValue({ id: "st1", campusId: "c1" });
    (prisma.invoice.create as any).mockResolvedValue({ id: "inv1" });

    const res = await POST(
      jsonRequest({
        ...VALID_BODY,
        scholarshipPercent: 20,
        earlyPaymentDiscountCents: 5000,
      })
    );
    expect(res.status).toBe(201);
    // base 200000 - 20% (40000) - 5000 = 155000
    expect(prisma.invoice.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        studentId: "st1",
        description: "Colegiatura septiembre",
        baseCents: 200000,
        scholarshipPercent: 20,
        earlyPaymentDiscountCents: 5000,
        amountCents: 155000,
        status: "PENDING",
      }),
    });
  });

  it("rounds scholarshipPercent to 2 decimals and uses the rounded value in amountCents", async () => {
    (auth as any).mockResolvedValue({ user: { id: "a1", role: "ADMIN" } });
    (prisma.student.findUnique as any).mockResolvedValue({ id: "st1", campusId: "c1" });
    (prisma.invoice.create as any).mockResolvedValue({ id: "inv1" });

    const res = await POST(jsonRequest({ ...VALID_BODY, baseCents: 300000, scholarshipPercent: 33.333 }));
    expect(res.status).toBe(201);
    // rounded scholarshipPercent = 33.33; scholarshipCents = round(300000*33.33/100) = 99990
    expect(prisma.invoice.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        scholarshipPercent: 33.33,
        amountCents: 200010,
      }),
    });
  });
});
