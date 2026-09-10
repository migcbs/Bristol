import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/campus-scope", () => ({ getCampusScope: vi.fn(), leadScopeWhere: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    student: { findMany: vi.fn() },
    lead: { findMany: vi.fn() },
    group: { findMany: vi.fn() },
    curso: { findMany: vi.fn() },
    user: { findMany: vi.fn() },
    campus: { findMany: vi.fn() },
  },
}));

import { auth } from "@/lib/auth";
import { getCampusScope, leadScopeWhere } from "@/lib/campus-scope";
import { prisma } from "@/lib/prisma";
import { GET } from "@/app/api/admin/search/route";

function getRequest(qs: string) {
  return new Request(`http://localhost/api/admin/search${qs}`);
}

describe("GET /api/admin/search", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 without a session", async () => {
    (auth as any).mockResolvedValue(null);
    const res = await GET(getRequest("?q=ana"));
    expect(res.status).toBe(401);
  });

  it("returns 403 for a TEACHER", async () => {
    (auth as any).mockResolvedValue({ user: { id: "t1", role: "TEACHER" } });
    const res = await GET(getRequest("?q=ana"));
    expect(res.status).toBe(403);
  });

  it("returns 400 for a query shorter than 2 characters", async () => {
    (auth as any).mockResolvedValue({ user: { id: "a1", role: "ADMIN" } });
    const res = await GET(getRequest("?q=a"));
    expect(res.status).toBe(400);
  });

  it("returns grouped results scoped by campus, limited to 5 per type", async () => {
    (auth as any).mockResolvedValue({ user: { id: "s1", role: "STAFF" } });
    (getCampusScope as any).mockResolvedValue({ type: "CAMPUS_LIST", campusIds: ["c1"] });
    (leadScopeWhere as any).mockReturnValue({ OR: [{ campusId: { in: ["c1"] } }, { campusId: null }] });
    (prisma.student.findMany as any).mockResolvedValue([]);
    (prisma.lead.findMany as any).mockResolvedValue([]);
    (prisma.group.findMany as any).mockResolvedValue([]);
    (prisma.curso.findMany as any).mockResolvedValue([]);
    (prisma.user.findMany as any).mockResolvedValue([]);

    const res = await GET(getRequest("?q=ana"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ intent: null, students: [], leads: [], groups: [], cursos: [], parents: [] });

    expect(prisma.student.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 5,
        where: expect.objectContaining({ campusId: { in: ["c1"] } }),
      })
    );
    expect(leadScopeWhere).toHaveBeenCalledWith({ type: "CAMPUS_LIST", campusIds: ["c1"] });
    expect(prisma.lead.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 5,
        where: expect.objectContaining({
          AND: expect.arrayContaining([{ OR: [{ campusId: { in: ["c1"] } }, { campusId: null }] }]),
        }),
      })
    );
    expect(prisma.group.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 5,
        where: expect.objectContaining({ campusId: { in: ["c1"] } }),
      })
    );
    expect(prisma.curso.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 5 }));
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 5, where: expect.objectContaining({ role: "PARENT" }) })
    );
  });

  it("recognizes a smart 'alumnos del grupo X' query and only queries students", async () => {
    (auth as any).mockResolvedValue({ user: { id: "a1", role: "ADMIN" } });
    (getCampusScope as any).mockResolvedValue({ type: "ALL" });
    (prisma.student.findMany as any).mockResolvedValue([]);

    const res = await GET(getRequest("?q=" + encodeURIComponent("alumnos del grupo A1")));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.intent).toEqual({ type: "students_by_group", term: "A1" });
    expect(prisma.lead.findMany).not.toHaveBeenCalled();
    expect(prisma.group.findMany).not.toHaveBeenCalled();
    expect(prisma.student.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          enrollments: {
            some: {
              completedAt: null,
              group: {
                OR: [
                  { name: { contains: "A1", mode: "insensitive" } },
                  { codigoGrupo: { contains: "A1", mode: "insensitive" } },
                ],
              },
            },
          },
        }),
      })
    );
  });
});
