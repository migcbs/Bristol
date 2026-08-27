import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { lead: { create: vi.fn() } },
}));

import { prisma } from "@/lib/prisma";
import { POST } from "@/app/api/leads/route";

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/leads", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

const BASE_BODY = { name: "Ana Torres", email: "ana@example.com" };

describe("POST /api/leads — source field", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 when source is not a valid LeadSource value", async () => {
    (prisma.lead.create as any).mockResolvedValue({ id: "l1" });
    const res = await POST(jsonRequest({ ...BASE_BODY, source: "TIKTOK" }));
    expect(res.status).toBe(400);
    expect(prisma.lead.create).not.toHaveBeenCalled();
  });

  it("creates the lead without a source field in the payload when source is omitted (defaults at the DB level)", async () => {
    (prisma.lead.create as any).mockResolvedValue({ id: "l1" });
    const res = await POST(jsonRequest(BASE_BODY));
    expect(res.status).toBe(201);
    const callArg = (prisma.lead.create as any).mock.calls[0][0];
    expect(callArg.data.source).toBeUndefined();
  });

  it("passes a valid source through to the create call", async () => {
    (prisma.lead.create as any).mockResolvedValue({ id: "l1" });
    const res = await POST(jsonRequest({ ...BASE_BODY, source: "REFERIDO" }));
    expect(res.status).toBe(201);
    expect(prisma.lead.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ source: "REFERIDO" }),
    });
  });
});
