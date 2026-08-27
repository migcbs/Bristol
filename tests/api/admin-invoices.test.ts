import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/campus-scope", () => ({ getCampusScope: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    invoice: { create: vi.fn(), findMany: vi.fn() },
    student: { findUnique: vi.fn() },
  },
}));

import { auth } from "@/lib/auth";
import { getCampusScope } from "@/lib/campus-scope";
import { prisma } from "@/lib/prisma";
import { POST, GET } from "@/app/api/admin/invoices/route";

function jsonRequest(method: string, body?: unknown) {
  const url = "http://localhost/api/admin/invoices";
  return new Request(url, {
    method,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/admin/invoices", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 without a session", async () => {
    (auth as any).mockResolvedValue(null);
    const res = await POST(jsonRequest("POST", { studentId: "s1" }));
    expect(res.status).toBe(401);
  });

  it("returns 403 for a STUDENT", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1", role: "STUDENT" } });
    const res = await POST(jsonRequest("POST", { studentId: "s1" }));
    expect(res.status).toBe(403);
  });

  it("returns 400 for a non-positive amount", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1", role: "ADMIN" } });
    const res = await POST(
      jsonRequest("POST", {
        studentId: "s1",
        description: "Colegiatura",
        amountCents: 0,
        dueDate: "2026-09-01",
      })
    );
    expect(res.status).toBe(400);
    expect(prisma.invoice.create).not.toHaveBeenCalled();
  });

  it("returns 400 for a non-integer amount", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1", role: "ADMIN" } });
    const res = await POST(
      jsonRequest("POST", {
        studentId: "s1",
        description: "Colegiatura",
        amountCents: 100.5,
        dueDate: "2026-09-01",
      })
    );
    expect(res.status).toBe(400);
    expect(prisma.invoice.create).not.toHaveBeenCalled();
  });

  it("returns 400 for an invalid dueDate string", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1", role: "ADMIN" } });
    const res = await POST(
      jsonRequest("POST", {
        studentId: "s1",
        description: "Colegiatura",
        amountCents: 100000,
        dueDate: "not-a-date",
      })
    );
    expect(res.status).toBe(400);
    expect(prisma.invoice.create).not.toHaveBeenCalled();
  });

  it("returns 400 for an amountCents above the 32-bit Int max", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1", role: "ADMIN" } });
    const res = await POST(
      jsonRequest("POST", {
        studentId: "s1",
        description: "Colegiatura",
        amountCents: 2147483648,
        dueDate: "2026-09-01",
      })
    );
    expect(res.status).toBe(400);
    expect(prisma.invoice.create).not.toHaveBeenCalled();
  });

  it("returns 404 when the student is outside the caller's scope", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u2", role: "STAFF" } });
    (getCampusScope as any).mockResolvedValue({ type: "CAMPUS_LIST", campusIds: ["c1"] });
    (prisma.student.findUnique as any).mockResolvedValue({ id: "s1", campusId: "c2" });

    const res = await POST(
      jsonRequest("POST", {
        studentId: "s1",
        description: "Colegiatura",
        amountCents: 100000,
        dueDate: "2026-09-01",
      })
    );
    expect(res.status).toBe(404);
    expect(prisma.invoice.create).not.toHaveBeenCalled();
  });

  it("creates an invoice for a student within scope", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u2", role: "STAFF" } });
    (getCampusScope as any).mockResolvedValue({ type: "CAMPUS_LIST", campusIds: ["c1"] });
    (prisma.student.findUnique as any).mockResolvedValue({ id: "s1", campusId: "c1" });
    (prisma.invoice.create as any).mockResolvedValue({ id: "i1" });

    const res = await POST(
      jsonRequest("POST", {
        studentId: "s1",
        description: "Colegiatura Marzo",
        amountCents: 150000,
        dueDate: "2026-09-01",
      })
    );
    expect(res.status).toBe(201);
    expect(prisma.invoice.create).toHaveBeenCalledWith({
      data: {
        studentId: "s1",
        description: "Colegiatura Marzo",
        amountCents: 150000,
        dueDate: new Date("2026-09-01"),
      },
    });
  });
});

describe("GET /api/admin/invoices", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 without a session", async () => {
    (auth as any).mockResolvedValue(null);
    const res = await GET(jsonRequest("GET"));
    expect(res.status).toBe(401);
  });

  it("lists all invoices for ADMIN", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1", role: "ADMIN" } });
    (getCampusScope as any).mockResolvedValue({ type: "ALL" });
    (prisma.invoice.findMany as any).mockResolvedValue([]);

    const res = await GET(jsonRequest("GET"));
    expect(res.status).toBe(200);
    expect(prisma.invoice.findMany).toHaveBeenCalledWith({
      where: {},
      orderBy: { createdAt: "desc" },
      include: { student: { include: { user: { select: { name: true } }, campus: true } } },
    });
  });

  it("scopes to the caller's campus for STAFF", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u2", role: "STAFF" } });
    (getCampusScope as any).mockResolvedValue({ type: "CAMPUS_LIST", campusIds: ["c1"] });
    (prisma.invoice.findMany as any).mockResolvedValue([]);

    await GET(jsonRequest("GET"));
    expect(prisma.invoice.findMany).toHaveBeenCalledWith({
      where: { student: { campusId: { in: ["c1"] } } },
      orderBy: { createdAt: "desc" },
      include: { student: { include: { user: { select: { name: true } }, campus: true } } },
    });
  });
});
