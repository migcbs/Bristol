import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { user: { update: vi.fn() } },
}));
vi.mock("@/lib/tokens", () => ({
  consumeToken: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { consumeToken } from "@/lib/tokens";
import { POST as verifyEmail } from "@/app/api/auth/verify-email/route";

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/auth/verify-email", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("verify-email", () => {
  beforeEach(() => vi.clearAllMocks());

  it("marks the user verified for a valid token", async () => {
    (consumeToken as any).mockResolvedValue({ userId: "u1" });

    const res = await verifyEmail(jsonRequest({ token: "valid" }));
    expect(res.status).toBe(200);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { emailVerifiedAt: expect.any(Date) },
    });
  });

  it("returns 400 for an invalid or expired token", async () => {
    (consumeToken as any).mockResolvedValue(null);

    const res = await verifyEmail(jsonRequest({ token: "bad" }));
    expect(res.status).toBe(400);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});
