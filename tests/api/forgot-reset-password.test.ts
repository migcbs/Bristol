import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn(), update: vi.fn() },
  },
}));
vi.mock("@/lib/tokens", () => ({
  createToken: vi.fn(),
  consumeToken: vi.fn(),
}));
vi.mock("@/lib/email", () => ({
  sendPasswordResetEmail: vi.fn(),
}));
vi.mock("@/lib/password", () => ({
  hashPassword: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { createToken, consumeToken } from "@/lib/tokens";
import { sendPasswordResetEmail } from "@/lib/email";
import { hashPassword } from "@/lib/password";
import { POST as forgotPassword } from "@/app/api/auth/forgot-password/route";
import { POST as resetPassword } from "@/app/api/auth/reset-password/route";

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("forgot-password", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sends a reset email for an existing user", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({ id: "u1", email: "a@b.com" });
    (createToken as any).mockResolvedValue("raw-token");

    const res = await forgotPassword(jsonRequest({ email: "a@b.com" }));
    expect(res.status).toBe(200);
    expect(sendPasswordResetEmail).toHaveBeenCalledWith("a@b.com", "raw-token");
  });

  it("returns 200 without sending email for a nonexistent user (no account enumeration)", async () => {
    (prisma.user.findUnique as any).mockResolvedValue(null);

    const res = await forgotPassword(jsonRequest({ email: "missing@b.com" }));
    expect(res.status).toBe(200);
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
  });
});

describe("reset-password", () => {
  beforeEach(() => vi.clearAllMocks());

  it("updates the password for a valid token", async () => {
    (consumeToken as any).mockResolvedValue({ userId: "u1" });
    (hashPassword as any).mockResolvedValue("new-hash");

    const res = await resetPassword(jsonRequest({ token: "valid", password: "new-secret" }));
    expect(res.status).toBe(200);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { passwordHash: "new-hash" },
    });
  });

  it("returns 400 for an invalid or expired token", async () => {
    (consumeToken as any).mockResolvedValue(null);

    const res = await resetPassword(jsonRequest({ token: "bad", password: "new-secret" }));
    expect(res.status).toBe(400);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});
