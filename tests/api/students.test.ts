import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/campus-scope", () => ({ getCampusScope: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { student: { findMany: vi.fn() } },
}));

import { auth } from "@/lib/auth";
import { getCampusScope } from "@/lib/campus-scope";
import { prisma } from "@/lib/prisma";
import { GET } from "@/app/api/students/route";

describe("GET /api/students", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when there is no session", async () => {
    (auth as any).mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("queries all students for ADMIN scope", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1", role: "ADMIN" } });
    (getCampusScope as any).mockResolvedValue({ type: "ALL" });
    (prisma.student.findMany as any).mockResolvedValue([{ id: "s1" }]);

    const res = await GET();
    expect(prisma.student.findMany).toHaveBeenCalledWith({ where: {} });
    expect(res.status).toBe(200);
  });

  it("filters by campusIds for CAMPUS_LIST scope", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u2", role: "STAFF" } });
    (getCampusScope as any).mockResolvedValue({ type: "CAMPUS_LIST", campusIds: ["c1", "c2"] });
    (prisma.student.findMany as any).mockResolvedValue([]);

    await GET();
    expect(prisma.student.findMany).toHaveBeenCalledWith({
      where: { campusId: { in: ["c1", "c2"] } },
    });
  });

  it("filters by a single campusId for SINGLE_CAMPUS scope", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u3", role: "STUDENT" } });
    (getCampusScope as any).mockResolvedValue({ type: "SINGLE_CAMPUS", campusId: "c1" });
    (prisma.student.findMany as any).mockResolvedValue([]);

    await GET();
    expect(prisma.student.findMany).toHaveBeenCalledWith({ where: { campusId: "c1" } });
  });

  it("returns an empty list for NONE scope without querying", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u4", role: "PARENT" } });
    (getCampusScope as any).mockResolvedValue({ type: "NONE" });

    const res = await GET();
    const body = await res.json();
    expect(body).toEqual([]);
    expect(prisma.student.findMany).not.toHaveBeenCalled();
  });
});
