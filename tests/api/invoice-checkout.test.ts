import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/invoice-scope", () => ({ getVisibleStudentIds: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { invoice: { findUnique: vi.fn(), update: vi.fn() } },
}));
vi.mock("@/lib/stripe", () => ({
  stripe: { checkout: { sessions: { create: vi.fn() } } },
}));

import { auth } from "@/lib/auth";
import { getVisibleStudentIds } from "@/lib/invoice-scope";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { POST } from "@/app/api/invoices/[id]/checkout/route";

const ctx = { params: Promise.resolve({ id: "i1" }) };

describe("POST /api/invoices/[id]/checkout", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 without a session", async () => {
    (auth as any).mockResolvedValue(null);
    const res = await POST(new Request("http://localhost"), ctx);
    expect(res.status).toBe(401);
  });

  it("returns 404 when the invoice does not belong to the caller", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1", role: "STUDENT" } });
    (getVisibleStudentIds as any).mockResolvedValue(["s1"]);
    (prisma.invoice.findUnique as any).mockResolvedValue({ id: "i1", studentId: "s2", status: "PENDING" });

    const res = await POST(new Request("http://localhost"), ctx);
    expect(res.status).toBe(404);
    expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it("returns 400 when the invoice is already paid", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1", role: "STUDENT" } });
    (getVisibleStudentIds as any).mockResolvedValue(["s1"]);
    (prisma.invoice.findUnique as any).mockResolvedValue({ id: "i1", studentId: "s1", status: "PAID" });

    const res = await POST(new Request("http://localhost"), ctx);
    expect(res.status).toBe(400);
    expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it("returns 400 when the invoice is canceled", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1", role: "STUDENT" } });
    (getVisibleStudentIds as any).mockResolvedValue(["s1"]);
    (prisma.invoice.findUnique as any).mockResolvedValue({ id: "i1", studentId: "s1", status: "CANCELED" });

    const res = await POST(new Request("http://localhost"), ctx);
    expect(res.status).toBe(400);
    expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it("allows an OVERDUE invoice to proceed to checkout", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1", role: "STUDENT" } });
    (getVisibleStudentIds as any).mockResolvedValue(["s1"]);
    (prisma.invoice.findUnique as any).mockResolvedValue({
      id: "i1",
      studentId: "s1",
      status: "OVERDUE",
      description: "Colegiatura",
      amountCents: 150000,
    });
    (stripe.checkout.sessions.create as any).mockResolvedValue({
      id: "cs_123",
      url: "https://checkout.stripe.com/cs_123",
    });
    (prisma.invoice.update as any).mockResolvedValue({});

    const res = await POST(new Request("http://localhost"), ctx);
    expect(res.status).toBe(200);
    expect(stripe.checkout.sessions.create).toHaveBeenCalled();
  });

  it("returns 502 when Stripe fails to create the checkout session", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1", role: "STUDENT" } });
    (getVisibleStudentIds as any).mockResolvedValue(["s1"]);
    (prisma.invoice.findUnique as any).mockResolvedValue({
      id: "i1",
      studentId: "s1",
      status: "PENDING",
      description: "Colegiatura",
      amountCents: 150000,
    });
    (stripe.checkout.sessions.create as any).mockRejectedValue(new Error("stripe down"));

    const res = await POST(new Request("http://localhost"), ctx);
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error).not.toMatch(/stripe down/i);
    expect(prisma.invoice.update).not.toHaveBeenCalled();
  });

  it("creates a Stripe Checkout Session for a valid pending invoice", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1", role: "STUDENT" } });
    (getVisibleStudentIds as any).mockResolvedValue(["s1"]);
    (prisma.invoice.findUnique as any).mockResolvedValue({
      id: "i1",
      studentId: "s1",
      status: "PENDING",
      description: "Colegiatura",
      amountCents: 150000,
    });
    (stripe.checkout.sessions.create as any).mockResolvedValue({
      id: "cs_123",
      url: "https://checkout.stripe.com/cs_123",
    });
    (prisma.invoice.update as any).mockResolvedValue({});

    const res = await POST(new Request("http://localhost"), ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ url: "https://checkout.stripe.com/cs_123" });
    expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "payment",
        line_items: [
          expect.objectContaining({
            price_data: expect.objectContaining({
              currency: "mxn",
              unit_amount: 150000,
            }),
            quantity: 1,
          }),
        ],
        metadata: { invoiceId: "i1" },
      })
    );
    expect(prisma.invoice.update).toHaveBeenCalledWith({
      where: { id: "i1" },
      data: { stripeCheckoutSessionId: "cs_123" },
    });
  });
});
