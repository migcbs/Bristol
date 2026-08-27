import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/stripe", () => ({
  stripe: { webhooks: { constructEvent: vi.fn() } },
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { invoice: { updateMany: vi.fn() } },
}));

import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { POST } from "@/app/api/webhooks/stripe/route";

function webhookRequest(body: string, signature = "valid-signature") {
  return new Request("http://localhost/api/webhooks/stripe", {
    method: "POST",
    body,
    headers: { "stripe-signature": signature },
  });
}

describe("POST /api/webhooks/stripe", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 when signature verification fails", async () => {
    (stripe.webhooks.constructEvent as any).mockImplementation(() => {
      throw new Error("invalid signature");
    });

    const res = await POST(webhookRequest("{}"));
    expect(res.status).toBe(400);
    expect(prisma.invoice.updateMany).not.toHaveBeenCalled();
  });

  it("marks the invoice as PAID on checkout.session.completed with payment_status paid", async () => {
    (stripe.webhooks.constructEvent as any).mockReturnValue({
      type: "checkout.session.completed",
      data: { object: { id: "cs_123", payment_status: "paid", metadata: { invoiceId: "i1" } } },
    });
    (prisma.invoice.updateMany as any).mockResolvedValue({ count: 1 });

    const res = await POST(webhookRequest("{}"));
    expect(res.status).toBe(200);
    expect(prisma.invoice.updateMany).toHaveBeenCalledWith({
      where: { id: "i1", status: { in: ["PENDING", "OVERDUE"] } },
      data: { status: "PAID", paidAt: expect.any(Date) },
    });
  });

  it("marks an OVERDUE invoice as PAID when payment completes late", async () => {
    (stripe.webhooks.constructEvent as any).mockReturnValue({
      type: "checkout.session.completed",
      data: { object: { id: "cs_123", payment_status: "paid", metadata: { invoiceId: "i1" } } },
    });
    (prisma.invoice.updateMany as any).mockResolvedValue({ count: 1 });

    const res = await POST(webhookRequest("{}"));
    expect(res.status).toBe(200);
    expect(prisma.invoice.updateMany).toHaveBeenCalledWith({
      where: { id: "i1", status: { in: ["PENDING", "OVERDUE"] } },
      data: { status: "PAID", paidAt: expect.any(Date) },
    });
    // The where-clause matches both PENDING and OVERDUE invoices (not a specific
    // starting status), so an invoice that was OVERDUE when the customer paid
    // still transitions to PAID here, instead of silently no-oping.
  });

  it("does NOT mark the invoice paid when checkout.session.completed fires with payment_status unpaid (e.g. OXXO voucher generation)", async () => {
    (stripe.webhooks.constructEvent as any).mockReturnValue({
      type: "checkout.session.completed",
      data: { object: { id: "cs_123", payment_status: "unpaid", metadata: { invoiceId: "i1" } } },
    });

    const res = await POST(webhookRequest("{}"));
    expect(res.status).toBe(200);
    expect(prisma.invoice.updateMany).not.toHaveBeenCalled();
  });

  it("marks the invoice as PAID on checkout.session.async_payment_succeeded (e.g. OXXO completing later)", async () => {
    (stripe.webhooks.constructEvent as any).mockReturnValue({
      type: "checkout.session.async_payment_succeeded",
      data: { object: { id: "cs_123", payment_status: "paid", metadata: { invoiceId: "i1" } } },
    });
    (prisma.invoice.updateMany as any).mockResolvedValue({ count: 1 });

    const res = await POST(webhookRequest("{}"));
    expect(res.status).toBe(200);
    expect(prisma.invoice.updateMany).toHaveBeenCalledWith({
      where: { id: "i1", status: { in: ["PENDING", "OVERDUE"] } },
      data: { status: "PAID", paidAt: expect.any(Date) },
    });
  });

  it("does not touch the database when metadata.invoiceId is missing", async () => {
    (stripe.webhooks.constructEvent as any).mockReturnValue({
      type: "checkout.session.completed",
      data: { object: { id: "cs_123", payment_status: "paid", metadata: {} } },
    });

    const res = await POST(webhookRequest("{}"));
    expect(res.status).toBe(200);
    expect(prisma.invoice.updateMany).not.toHaveBeenCalled();
  });

  it("ignores unrelated event types without touching the database", async () => {
    (stripe.webhooks.constructEvent as any).mockReturnValue({
      type: "payment_intent.created",
      data: { object: {} },
    });

    const res = await POST(webhookRequest("{}"));
    expect(res.status).toBe(200);
    expect(prisma.invoice.updateMany).not.toHaveBeenCalled();
  });
});
