import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import type { TokenPurpose } from "@prisma/client";

export async function createToken(
  userId: string,
  purpose: TokenPurpose,
  ttlMinutes: number
): Promise<string> {
  const token = crypto.randomBytes(32).toString("hex");
  await prisma.verificationToken.create({
    data: {
      userId,
      token,
      purpose,
      expiresAt: new Date(Date.now() + ttlMinutes * 60_000),
    },
  });
  return token;
}

export async function consumeToken(
  token: string,
  purpose: TokenPurpose
): Promise<{ userId: string } | null> {
  const record = await prisma.verificationToken.findUnique({ where: { token } });
  if (!record) return null;

  await prisma.verificationToken.delete({ where: { id: record.id } });

  if (record.purpose !== purpose) return null;
  if (record.expiresAt.getTime() < Date.now()) return null;

  return { userId: record.userId };
}
