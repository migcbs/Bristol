import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/invoice-scope", () => ({ getVisibleStudentIds: vi.fn() }));
vi.mock("@/lib/stripe", () => ({ stripe: { checkout: { sessions: { create: vi.fn() } } } }));
vi.mock("@/lib/prisma", () => ({
  prisma: { invoice: { findUnique: vi.fn(), update: vi.fn() }, student: { findUnique: vi.fn() } },
}));

import { auth } from "@/lib/auth";
import { getVisibleStudentIds } from "@/lib/invoice-scope";
import { prisma } from "@/lib/prisma";
import { POST } from "@/app/api/invoices/[id]/checkout/route";

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("POST /api/invoices/[id]/checkout — age restriction", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 403 when a minor STUDENT (fechaNacimiento makes them under 18) tries to pay", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1", role: "STUDENT" } });
    (prisma.invoice.findUnique as any).mockResolvedValue({
      id: "inv1",
      studentId: "st1",
      status: "PENDING",
      description: "x",
      amountCents: 1000,
    });
    (getVisibleStudentIds as any).mockResolvedValue(["st1"]);
    (prisma.student.findUnique as any).mockResolvedValue({
      id: "st1",
      fechaNacimiento: new Date("2015-01-01"), // clearly a minor
    });

    const res = await POST(new Request("http://localhost", { method: "POST" }), makeParams("inv1"));
    expect(res.status).toBe(403);
  });

  it("returns 403 when a STUDENT's fechaNacimiento is null (cannot verify adulthood, treated as minor)", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1", role: "STUDENT" } });
    (prisma.invoice.findUnique as any).mockResolvedValue({
      id: "inv1",
      studentId: "st1",
      status: "PENDING",
      description: "x",
      amountCents: 1000,
    });
    (getVisibleStudentIds as any).mockResolvedValue(["st1"]);
    (prisma.student.findUnique as any).mockResolvedValue({ id: "st1", fechaNacimiento: null });

    const res = await POST(new Request("http://localhost", { method: "POST" }), makeParams("inv1"));
    expect(res.status).toBe(403);
  });

  it("allows an adult STUDENT to pay", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1", role: "STUDENT" } });
    (prisma.invoice.findUnique as any).mockResolvedValue({
      id: "inv1",
      studentId: "st1",
      status: "PENDING",
      description: "x",
      amountCents: 1000,
    });
    (getVisibleStudentIds as any).mockResolvedValue(["st1"]);
    (prisma.student.findUnique as any).mockResolvedValue({
      id: "st1",
      fechaNacimiento: new Date("1990-01-01"),
    });
    const { stripe } = await import("@/lib/stripe");
    (stripe.checkout.sessions.create as any).mockResolvedValue({ id: "cs1", url: "https://stripe.example/pay" });

    const res = await POST(new Request("http://localhost", { method: "POST" }), makeParams("inv1"));
    expect(res.status).toBe(200);
  });

  it("always allows a PARENT to pay, regardless of the linked student's age", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1", role: "PARENT" } });
    (prisma.invoice.findUnique as any).mockResolvedValue({
      id: "inv1",
      studentId: "st1",
      status: "PENDING",
      description: "x",
      amountCents: 1000,
    });
    (getVisibleStudentIds as any).mockResolvedValue(["st1"]);
    const { stripe } = await import("@/lib/stripe");
    (stripe.checkout.sessions.create as any).mockResolvedValue({ id: "cs1", url: "https://stripe.example/pay" });

    const res = await POST(new Request("http://localhost", { method: "POST" }), makeParams("inv1"));
    expect(res.status).toBe(200);
    expect(prisma.student.findUnique).not.toHaveBeenCalled();
  });
});
