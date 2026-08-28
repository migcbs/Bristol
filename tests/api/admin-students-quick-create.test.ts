import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/campus-scope", () => ({ getCampusScope: vi.fn() }));
vi.mock("@/lib/matricula", () => ({ generateMatricula: vi.fn() }));
vi.mock("@/lib/password", () => ({ hashPassword: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(),
    user: { findUnique: vi.fn() },
  },
}));

import { auth } from "@/lib/auth";
import { getCampusScope } from "@/lib/campus-scope";
import { generateMatricula } from "@/lib/matricula";
import { hashPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { POST } from "@/app/api/admin/students/quick-create/route";

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/admin/students/quick-create", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

const VALID_BODY = { name: "Ana Torres", email: "ana@example.com", campusId: "c1" };

describe("POST /api/admin/students/quick-create", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 without a session", async () => {
    (auth as any).mockResolvedValue(null);
    const res = await POST(jsonRequest(VALID_BODY));
    expect(res.status).toBe(401);
  });

  it("returns 403 for a TEACHER", async () => {
    (auth as any).mockResolvedValue({ user: { id: "t1", role: "TEACHER" } });
    const res = await POST(jsonRequest(VALID_BODY));
    expect(res.status).toBe(403);
  });

  it("returns 403 when STAFF targets a campus outside their scope", async () => {
    (auth as any).mockResolvedValue({ user: { id: "s1", role: "STAFF" } });
    (getCampusScope as any).mockResolvedValue({ type: "CAMPUS_LIST", campusIds: ["c2"] });
    const res = await POST(jsonRequest(VALID_BODY));
    expect(res.status).toBe(403);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("returns 400 for a missing name or invalid email", async () => {
    (auth as any).mockResolvedValue({ user: { id: "a1", role: "ADMIN" } });
    const res = await POST(jsonRequest({ email: "ana@example.com", campusId: "c1" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when name exceeds 120 characters", async () => {
    (auth as any).mockResolvedValue({ user: { id: "a1", role: "ADMIN" } });
    const res = await POST(jsonRequest({ ...VALID_BODY, name: "a".repeat(121) }));
    expect(res.status).toBe(400);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("returns 400 when email exceeds 254 characters", async () => {
    (auth as any).mockResolvedValue({ user: { id: "a1", role: "ADMIN" } });
    const longEmail = `${"a".repeat(250)}@example.com`;
    const res = await POST(jsonRequest({ ...VALID_BODY, email: longEmail }));
    expect(res.status).toBe(400);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("returns 409 when a user with the given email already exists", async () => {
    (auth as any).mockResolvedValue({ user: { id: "a1", role: "ADMIN" } });
    (prisma.user.findUnique as any).mockResolvedValue({ id: "existing" });
    const res = await POST(jsonRequest(VALID_BODY));
    expect(res.status).toBe(409);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("creates User+Student with a generated matrícula in one transaction on success", async () => {
    (auth as any).mockResolvedValue({ user: { id: "a1", role: "ADMIN" } });
    (prisma.user.findUnique as any).mockResolvedValue(null);
    (hashPassword as any).mockResolvedValue("hashed");
    (generateMatricula as any).mockResolvedValue("BRI-2026-00001");
    (prisma.$transaction as any).mockImplementation(async (fn: any) =>
      fn({
        user: { create: vi.fn().mockResolvedValue({ id: "u1" }) },
        student: { create: vi.fn().mockResolvedValue({ id: "st1", matricula: "BRI-2026-00001" }) },
      })
    );

    const res = await POST(jsonRequest(VALID_BODY));
    expect(res.status).toBe(201);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it("retries on a matrícula P2002 collision and succeeds on the second attempt", async () => {
    (auth as any).mockResolvedValue({ user: { id: "a1", role: "ADMIN" } });
    (prisma.user.findUnique as any).mockResolvedValue(null);
    (hashPassword as any).mockResolvedValue("hashed");
    (generateMatricula as any).mockResolvedValue("BRI-2026-00001");

    const collision = Object.assign(new Error("Unique constraint failed"), {
      code: "P2002",
      meta: { target: ["matricula"] },
    });

    (prisma.$transaction as any)
      .mockImplementationOnce(async () => {
        throw collision;
      })
      .mockImplementationOnce(async (fn: any) =>
        fn({
          user: { create: vi.fn().mockResolvedValue({ id: "u1" }) },
          student: { create: vi.fn().mockResolvedValue({ id: "st1", matricula: "BRI-2026-00002" }) },
        })
      );

    const res = await POST(jsonRequest(VALID_BODY));
    expect(res.status).toBe(201);
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
  });

  it("returns 500 after exhausting retries on repeated P2002 collisions", async () => {
    (auth as any).mockResolvedValue({ user: { id: "a1", role: "ADMIN" } });
    (prisma.user.findUnique as any).mockResolvedValue(null);
    (hashPassword as any).mockResolvedValue("hashed");
    (generateMatricula as any).mockResolvedValue("BRI-2026-00001");

    const collision = Object.assign(new Error("Unique constraint failed"), {
      code: "P2002",
      meta: { target: ["matricula"] },
    });

    (prisma.$transaction as any).mockImplementation(async () => {
      throw collision;
    });

    const res = await POST(jsonRequest(VALID_BODY));
    expect(res.status).toBe(500);
  });
});
