import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { user: { findUnique: vi.fn() } },
}));
vi.mock("@/lib/password", () => ({
  verifyPassword: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { authorizeCredentials } from "@/lib/auth";

describe("authorizeCredentials", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the user for valid, verified credentials", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({
      id: "u1",
      email: "a@b.com",
      passwordHash: "hash",
      name: "Ana",
      role: "STUDENT",
      emailVerifiedAt: new Date(),
    });
    (verifyPassword as any).mockResolvedValue(true);

    const user = await authorizeCredentials({ email: "a@b.com", password: "secret" });
    expect(user).toEqual({ id: "u1", email: "a@b.com", name: "Ana", role: "STUDENT" });
  });

  it("returns null for a nonexistent user", async () => {
    (prisma.user.findUnique as any).mockResolvedValue(null);
    const user = await authorizeCredentials({ email: "missing@b.com", password: "secret" });
    expect(user).toBeNull();
  });

  it("returns null for an incorrect password", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({
      id: "u1",
      email: "a@b.com",
      passwordHash: "hash",
      name: "Ana",
      role: "STUDENT",
      emailVerifiedAt: new Date(),
    });
    (verifyPassword as any).mockResolvedValue(false);

    const user = await authorizeCredentials({ email: "a@b.com", password: "wrong" });
    expect(user).toBeNull();
  });

  it("matches a mixed-case email against a lowercase-stored user", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({
      id: "u1",
      email: "a@b.com",
      passwordHash: "hash",
      name: "Ana",
      role: "STUDENT",
      emailVerifiedAt: new Date(),
    });
    (verifyPassword as any).mockResolvedValue(true);

    const user = await authorizeCredentials({ email: "A@B.com", password: "secret" });
    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { email: "a@b.com" } });
    expect(user).toEqual({ id: "u1", email: "a@b.com", name: "Ana", role: "STUDENT" });
  });

  it("returns null when the email is not verified", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({
      id: "u1",
      email: "a@b.com",
      passwordHash: "hash",
      name: "Ana",
      role: "STUDENT",
      emailVerifiedAt: null,
    });
    (verifyPassword as any).mockResolvedValue(true);

    const user = await authorizeCredentials({ email: "a@b.com", password: "secret" });
    expect(user).toBeNull();
  });
});
