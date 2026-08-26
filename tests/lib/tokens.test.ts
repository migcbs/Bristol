import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    verificationToken: {
      create: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import { createToken, consumeToken } from "@/lib/tokens";

describe("tokens", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a token record and returns the raw token", async () => {
    (prisma.verificationToken.create as any).mockResolvedValue({});
    const token = await createToken("user-1", "EMAIL_VERIFY", 60);
    expect(typeof token).toBe("string");
    expect(token.length).toBeGreaterThan(10);
    expect(prisma.verificationToken.create).toHaveBeenCalledOnce();
  });

  it("consumes a valid, unexpired token and deletes it", async () => {
    (prisma.verificationToken.findUnique as any).mockResolvedValue({
      id: "t1",
      userId: "user-1",
      purpose: "PASSWORD_RESET",
      expiresAt: new Date(Date.now() + 60_000),
    });
    (prisma.verificationToken.delete as any).mockResolvedValue({});

    const result = await consumeToken("raw-token", "PASSWORD_RESET");
    expect(result).toEqual({ userId: "user-1" });
    expect(prisma.verificationToken.delete).toHaveBeenCalledWith({ where: { id: "t1" } });
  });

  it("rejects an expired token", async () => {
    (prisma.verificationToken.findUnique as any).mockResolvedValue({
      id: "t2",
      userId: "user-1",
      purpose: "PASSWORD_RESET",
      expiresAt: new Date(Date.now() - 1_000),
    });

    const result = await consumeToken("raw-token", "PASSWORD_RESET");
    expect(result).toBeNull();
    expect(prisma.verificationToken.delete).toHaveBeenCalledWith({ where: { id: "t2" } });
  });

  it("rejects a token with the wrong purpose", async () => {
    (prisma.verificationToken.findUnique as any).mockResolvedValue({
      id: "t3",
      userId: "user-1",
      purpose: "EMAIL_VERIFY",
      expiresAt: new Date(Date.now() + 60_000),
    });

    const result = await consumeToken("raw-token", "PASSWORD_RESET");
    expect(result).toBeNull();
  });

  it("returns null for a token that does not exist", async () => {
    (prisma.verificationToken.findUnique as any).mockResolvedValue(null);
    const result = await consumeToken("missing", "EMAIL_VERIFY");
    expect(result).toBeNull();
  });
});
