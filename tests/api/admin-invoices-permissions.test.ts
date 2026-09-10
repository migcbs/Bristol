import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/campus-scope", () => ({ getCampusScope: vi.fn() }));
vi.mock("@/lib/staff-permissions", () => ({ hasModuleAccess: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { student: { findUnique: vi.fn() }, invoice: { create: vi.fn(), findMany: vi.fn() } },
}));

import { auth } from "@/lib/auth";
import { hasModuleAccess } from "@/lib/staff-permissions";
import { POST, GET } from "@/app/api/admin/invoices/route";

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/admin/invoices", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/admin/invoices — module access", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 403 when the caller's puesto has no cobranzas access", async () => {
    (auth as any).mockResolvedValue({ user: { id: "s1", role: "STAFF" } });
    (hasModuleAccess as any).mockResolvedValue("none");

    const res = await POST(jsonRequest({ studentId: "st1", description: "x", amountCents: 1000, dueDate: "2026-09-01" }));
    expect(res.status).toBe(403);
  });

  // Charge creation is Caja-only (strictly "full") since 2026-09-09 —
  // Recepción's cobranzas level was downgraded from "initiate" to "read"
  // (they consult payment status, they don't create or collect charges).
  it("rejects a puesto with only initiate/read access — creation requires full", async () => {
    (auth as any).mockResolvedValue({ user: { id: "s1", role: "STAFF" } });
    (hasModuleAccess as any).mockResolvedValue("initiate");
    const { prisma } = await import("@/lib/prisma");

    const res = await POST(jsonRequest({ studentId: "st1", description: "x", amountCents: 1000, dueDate: "2026-09-01" }));
    expect(res.status).toBe(403);
    expect(prisma.invoice.create).not.toHaveBeenCalled();
  });

  it("allows full access to create an invoice", async () => {
    (auth as any).mockResolvedValue({ user: { id: "s1", role: "STAFF" } });
    (hasModuleAccess as any).mockResolvedValue("full");
    const { prisma } = await import("@/lib/prisma");
    (prisma.student.findUnique as any).mockResolvedValue({ id: "st1", campusId: "c1" });
    const { getCampusScope } = await import("@/lib/campus-scope");
    (getCampusScope as any).mockResolvedValue({ type: "ALL" });
    (prisma.invoice.create as any).mockResolvedValue({ id: "inv1" });

    const res = await POST(jsonRequest({ studentId: "st1", description: "x", amountCents: 1000, dueDate: "2026-09-01" }));
    expect(res.status).toBe(201);
  });
});

describe("GET /api/admin/invoices — module access", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 403 when the caller's puesto has no cobranzas access (not even read)", async () => {
    (auth as any).mockResolvedValue({ user: { id: "s1", role: "STAFF" } });
    (hasModuleAccess as any).mockResolvedValue("none");

    const res = await GET(new Request("http://localhost"));
    expect(res.status).toBe(403);
  });

  it("allows read-only access", async () => {
    (auth as any).mockResolvedValue({ user: { id: "s1", role: "STAFF" } });
    (hasModuleAccess as any).mockResolvedValue("read");
    const { prisma } = await import("@/lib/prisma");
    (prisma.invoice.findMany as any).mockResolvedValue([]);
    const { getCampusScope } = await import("@/lib/campus-scope");
    (getCampusScope as any).mockResolvedValue({ type: "ALL" });

    const res = await GET(new Request("http://localhost"));
    expect(res.status).toBe(200);
  });
});
