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

describe("POST /api/leads", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a lead with valid name and email", async () => {
    (prisma.lead.create as any).mockResolvedValue({
      id: "l1",
      name: "Ana",
      email: "ana@example.com",
      phone: null,
      message: null,
      campusId: null,
    });

    const res = await POST(jsonRequest({ name: "Ana", email: "ana@example.com" }));
    expect(res.status).toBe(201);
    expect(prisma.lead.create).toHaveBeenCalledWith({
      data: {
        name: "Ana",
        email: "ana@example.com",
        phone: undefined,
        message: undefined,
        campusId: undefined,
      },
    });
  });

  it("passes through optional phone, message, and campusId when provided", async () => {
    (prisma.lead.create as any).mockResolvedValue({ id: "l2" });

    await POST(
      jsonRequest({
        name: "Luis",
        email: "luis@example.com",
        phone: "5512345678",
        message: "Quiero informes",
        campusId: "c1",
      })
    );

    expect(prisma.lead.create).toHaveBeenCalledWith({
      data: {
        name: "Luis",
        email: "luis@example.com",
        phone: "5512345678",
        message: "Quiero informes",
        campusId: "c1",
      },
    });
  });

  it("returns 400 when name is missing", async () => {
    const res = await POST(jsonRequest({ email: "ana@example.com" }));
    expect(res.status).toBe(400);
    expect(prisma.lead.create).not.toHaveBeenCalled();
  });

  it("returns 400 when email is missing", async () => {
    const res = await POST(jsonRequest({ name: "Ana" }));
    expect(res.status).toBe(400);
    expect(prisma.lead.create).not.toHaveBeenCalled();
  });

  it("returns 400 when email is malformed", async () => {
    const res = await POST(jsonRequest({ name: "Ana", email: "not-an-email" }));
    expect(res.status).toBe(400);
    expect(prisma.lead.create).not.toHaveBeenCalled();
  });

  it("returns 400 for malformed JSON body", async () => {
    const badRequest = new Request("http://localhost/api/leads", {
      method: "POST",
      body: "{not valid json",
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(badRequest);
    expect(res.status).toBe(400);
    expect(prisma.lead.create).not.toHaveBeenCalled();
  });

  it("returns 400 when name is only whitespace", async () => {
    const res = await POST(jsonRequest({ name: "   ", email: "ana@example.com" }));
    expect(res.status).toBe(400);
    expect(prisma.lead.create).not.toHaveBeenCalled();
  });

  it("returns 400 when email is only whitespace", async () => {
    const res = await POST(jsonRequest({ name: "Ana", email: "   " }));
    expect(res.status).toBe(400);
    expect(prisma.lead.create).not.toHaveBeenCalled();
  });

  it("trims whitespace around valid name and email before saving", async () => {
    (prisma.lead.create as any).mockResolvedValue({ id: "l3" });

    await POST(jsonRequest({ name: "  Ana  ", email: "  ana@example.com  " }));

    expect(prisma.lead.create).toHaveBeenCalledWith({
      data: {
        name: "Ana",
        email: "ana@example.com",
        phone: undefined,
        message: undefined,
        campusId: undefined,
      },
    });
  });

  it("returns 400 when name exceeds 120 characters", async () => {
    const res = await POST(jsonRequest({ name: "a".repeat(121), email: "ana@example.com" }));
    expect(res.status).toBe(400);
    expect(prisma.lead.create).not.toHaveBeenCalled();
  });

  it("returns 400 when email exceeds 254 characters", async () => {
    const longEmail = `${"a".repeat(250)}@a.co`;
    const res = await POST(jsonRequest({ name: "Ana", email: longEmail }));
    expect(res.status).toBe(400);
    expect(prisma.lead.create).not.toHaveBeenCalled();
  });

  it("returns 400 when phone exceeds 30 characters", async () => {
    const res = await POST(
      jsonRequest({ name: "Ana", email: "ana@example.com", phone: "1".repeat(31) })
    );
    expect(res.status).toBe(400);
    expect(prisma.lead.create).not.toHaveBeenCalled();
  });

  it("returns 400 when message exceeds 2000 characters", async () => {
    const res = await POST(
      jsonRequest({ name: "Ana", email: "ana@example.com", message: "a".repeat(2001) })
    );
    expect(res.status).toBe(400);
    expect(prisma.lead.create).not.toHaveBeenCalled();
  });

  it("returns 400 when campusId is an empty string", async () => {
    const res = await POST(
      jsonRequest({ name: "Ana", email: "ana@example.com", campusId: "" })
    );
    expect(res.status).toBe(400);
    expect(prisma.lead.create).not.toHaveBeenCalled();
  });

  it("returns 400 with a generic message when prisma.lead.create throws", async () => {
    (prisma.lead.create as any).mockRejectedValue(new Error("Foreign key constraint failed"));

    const res = await POST(
      jsonRequest({ name: "Ana", email: "ana@example.com", campusId: "does-not-exist" })
    );
    const bodyJson = await res.json();

    expect(res.status).toBe(400);
    expect(bodyJson.error).not.toMatch(/constraint/i);
  });
});
