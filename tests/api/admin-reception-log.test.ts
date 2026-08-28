import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/campus-scope", () => ({ getCampusScope: vi.fn(), assertCampusInScope: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    receptionLogEntry: { findMany: vi.fn(), create: vi.fn() },
    lead: { count: vi.fn() },
    student: { count: vi.fn() },
  },
}));

import { auth } from "@/lib/auth";
import { assertCampusInScope, getCampusScope } from "@/lib/campus-scope";
import { prisma } from "@/lib/prisma";
import { GET, POST } from "@/app/api/admin/reception-log/route";
import { GET as GET_REPORT } from "@/app/api/admin/reception-log/monthly-report/route";

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/admin/reception-log", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/admin/reception-log", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 for a blank note", async () => {
    (auth as any).mockResolvedValue({ user: { id: "s1", role: "STAFF" } });
    const res = await POST(jsonRequest({ campusId: "c1", type: "NOTA", note: "   " }));
    expect(res.status).toBe(400);
    expect(prisma.receptionLogEntry.create).not.toHaveBeenCalled();
  });

  it("creates a log entry on success", async () => {
    (auth as any).mockResolvedValue({ user: { id: "s1", role: "STAFF" } });
    (assertCampusInScope as any).mockResolvedValue(true);
    (prisma.receptionLogEntry.create as any).mockResolvedValue({ id: "rl1" });
    const res = await POST(jsonRequest({ campusId: "c1", type: "LLAMADA", note: "Llamó un padre de familia" }));
    expect(res.status).toBe(201);
  });

  it("returns 403 when STAFF attempts to log an entry outside their campus scope", async () => {
    (auth as any).mockResolvedValue({ user: { id: "s1", role: "STAFF" } });
    (assertCampusInScope as any).mockResolvedValue(false);
    const res = await POST(jsonRequest({ campusId: "c2", type: "LLAMADA", note: "Llamó un padre de familia" }));
    expect(res.status).toBe(403);
    expect(prisma.receptionLogEntry.create).not.toHaveBeenCalled();
  });

  it("creates a log entry for ADMIN without a scope check", async () => {
    (auth as any).mockResolvedValue({ user: { id: "a1", role: "ADMIN" } });
    (prisma.receptionLogEntry.create as any).mockResolvedValue({ id: "rl2" });
    const res = await POST(jsonRequest({ campusId: "c9", type: "NOTA", note: "Nota administrativa" }));
    expect(res.status).toBe(201);
    expect(assertCampusInScope).not.toHaveBeenCalled();
  });
});

describe("GET /api/admin/reception-log", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 without a session", async () => {
    (auth as any).mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });
});

describe("GET /api/admin/reception-log/monthly-report", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns altas and bajas counts for the current month, scoped by campus", async () => {
    (auth as any).mockResolvedValue({ user: { id: "s1", role: "STAFF" } });
    (getCampusScope as any).mockResolvedValue({ type: "CAMPUS_LIST", campusIds: ["c1"] });
    (prisma.lead.count as any).mockResolvedValue(4);
    (prisma.student.count as any).mockResolvedValue(1);

    const res = await GET_REPORT();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ altas: 4, bajas: 1 });
  });
});
