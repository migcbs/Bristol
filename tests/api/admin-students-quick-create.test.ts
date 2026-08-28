import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/campus-scope", () => ({ getCampusScope: vi.fn() }));
vi.mock("@/lib/matricula", () => ({ generateMatricula: vi.fn() }));
vi.mock("@/lib/password", () => ({ hashPassword: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(),
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

  it("creates User+Student with a generated matrícula in one transaction on success", async () => {
    (auth as any).mockResolvedValue({ user: { id: "a1", role: "ADMIN" } });
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
});
