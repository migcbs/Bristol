import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/campus-scope", () => ({ getCampusScope: vi.fn() }));
vi.mock("@/lib/staff-permissions", () => ({ hasModuleAccess: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    student: { findMany: vi.fn() },
  },
}));

import { auth } from "@/lib/auth";
import { getCampusScope } from "@/lib/campus-scope";
import { hasModuleAccess } from "@/lib/staff-permissions";
import { prisma } from "@/lib/prisma";
import { GET } from "@/app/api/admin/ex-alumnos/route";

describe("GET /api/admin/ex-alumnos", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 without a session", async () => {
    (auth as any).mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns 403 without admisiones access", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1", role: "STAFF" } });
    (hasModuleAccess as any).mockResolvedValue("none");
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("only queries students with BAJA/GRADUADO status, scoped by campus", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1", role: "STAFF" } });
    (hasModuleAccess as any).mockResolvedValue("read");
    (getCampusScope as any).mockResolvedValue({ type: "CAMPUS_LIST", campusIds: ["c1"] });
    (prisma.student.findMany as any).mockResolvedValue([]);

    const res = await GET();
    expect(res.status).toBe(200);
    expect(prisma.student.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { campusId: { in: ["c1"] }, estatusAlumno: { in: ["BAJA", "GRADUADO"] } },
      })
    );
  });

  it("shapes each student with their most recent outreach log", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1", role: "STAFF" } });
    (hasModuleAccess as any).mockResolvedValue("full");
    (getCampusScope as any).mockResolvedValue({ type: "ALL" });
    (prisma.student.findMany as any).mockResolvedValue([
      {
        id: "s1",
        user: { name: "Juan Pérez", email: "juan@example.com" },
        campus: { name: "Coatepec" },
        telefonoMovil: "228123",
        estatusAlumno: "BAJA",
        interesadoEnVolver: true,
        alumniOutreachLogs: [{ note: "Llamé", type: "LLAMADA", createdAt: new Date("2026-01-01"), createdBy: { name: "Ana" } }],
      },
    ]);

    const res = await GET();
    const body = await res.json();
    expect(body).toEqual([
      expect.objectContaining({
        id: "s1",
        name: "Juan Pérez",
        lastLog: expect.objectContaining({ note: "Llamé", createdByName: "Ana" }),
      }),
    ]);
  });
});
