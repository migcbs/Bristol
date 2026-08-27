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

  it("marks the invoice as PAID on checkout.session.completed", async () => {
    (stripe.webhooks.constructEvent as any).mockReturnValue({
      type: "checkout.session.completed",
      data: { object: { id: "cs_123" } },
    });
    (prisma.invoice.updateMany as any).mockResolvedValue({ count: 1 });

    const res = await POST(webhookRequest("{}"));
    expect(res.status).toBe(200);
    expect(prisma.invoice.updateMany).toHaveBeenCalledWith({
      where: { stripeCheckoutSessionId: "cs_123" },
      data: { status: "PAID", paidAt: expect.any(Date) },
    });
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
