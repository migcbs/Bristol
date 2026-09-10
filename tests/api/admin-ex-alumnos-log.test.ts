import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/campus-scope", () => ({ getCampusScope: vi.fn() }));
vi.mock("@/lib/staff-permissions", () => ({ hasModuleAccess: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    student: { findUnique: vi.fn(), update: vi.fn() },
    alumniOutreachLog: { create: vi.fn() },
    $transaction: vi.fn((ops: any[]) => Promise.all(ops)),
  },
}));

import { auth } from "@/lib/auth";
import { getCampusScope } from "@/lib/campus-scope";
import { hasModuleAccess } from "@/lib/staff-permissions";
import { prisma } from "@/lib/prisma";
import { POST } from "@/app/api/admin/ex-alumnos/[id]/log/route";

function jsonRequest(body?: unknown) {
  return new Request("http://localhost/api/admin/ex-alumnos/s1/log", {
    method: "POST",
    body: body !== undefined ? JSON.stringify(body) : undefined,
    headers: { "Content-Type": "application/json" },
  });
}
function ctx(id = "s1") {
  return { params: Promise.resolve({ id }) };
}

describe("POST /api/admin/ex-alumnos/[id]/log", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 403 without full admisiones access", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1", role: "STAFF" } });
    (hasModuleAccess as any).mockResolvedValue("read");
    const res = await POST(jsonRequest({ type: "LLAMADA", note: "hola" }), ctx());
    expect(res.status).toBe(403);
  });

  it("returns 404 when the student is outside the caller's campus scope", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1", role: "STAFF" } });
    (hasModuleAccess as any).mockResolvedValue("full");
    (prisma.student.findUnique as any).mockResolvedValue({ id: "s1", campusId: "c2" });
    (getCampusScope as any).mockResolvedValue({ type: "CAMPUS_LIST", campusIds: ["c1"] });

    const res = await POST(jsonRequest({ type: "LLAMADA", note: "hola" }), ctx());
    expect(res.status).toBe(404);
  });

  it("rejects an invalid type", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1", role: "STAFF" } });
    (hasModuleAccess as any).mockResolvedValue("full");
    (prisma.student.findUnique as any).mockResolvedValue({ id: "s1", campusId: "c1" });
    (getCampusScope as any).mockResolvedValue({ type: "ALL" });

    const res = await POST(jsonRequest({ type: "BOGUS", note: "hola" }), ctx());
    expect(res.status).toBe(400);
    expect(prisma.alumniOutreachLog.create).not.toHaveBeenCalled();
  });

  it("creates a log entry without touching interesadoEnVolver when omitted", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1", role: "STAFF" } });
    (hasModuleAccess as any).mockResolvedValue("full");
    (prisma.student.findUnique as any).mockResolvedValue({ id: "s1", campusId: "c1" });
    (getCampusScope as any).mockResolvedValue({ type: "ALL" });
    (prisma.alumniOutreachLog.create as any).mockResolvedValue({ id: "log1" });

    const res = await POST(jsonRequest({ type: "LLAMADA", note: "Se le llamó" }), ctx());
    expect(res.status).toBe(201);
    expect(prisma.student.update).not.toHaveBeenCalled();
    expect(prisma.alumniOutreachLog.create).toHaveBeenCalledWith({
      data: { studentId: "s1", createdById: "u1", type: "LLAMADA", note: "Se le llamó" },
    });
  });

  it("creates a log entry and updates interesadoEnVolver together when provided", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1", role: "STAFF" } });
    (hasModuleAccess as any).mockResolvedValue("full");
    (prisma.student.findUnique as any).mockResolvedValue({ id: "s1", campusId: "c1" });
    (getCampusScope as any).mockResolvedValue({ type: "ALL" });
    (prisma.alumniOutreachLog.create as any).mockResolvedValue({ id: "log1" });
    (prisma.student.update as any).mockResolvedValue({ id: "s1", interesadoEnVolver: true });

    const res = await POST(jsonRequest({ type: "LLAMADA", note: "Interesado", interesadoEnVolver: true }), ctx());
    expect(res.status).toBe(201);
    expect(prisma.student.update).toHaveBeenCalledWith({ where: { id: "s1" }, data: { interesadoEnVolver: true } });
  });
});
