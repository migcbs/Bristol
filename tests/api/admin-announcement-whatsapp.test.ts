import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/campus-scope", () => ({ assertCampusInScope: vi.fn(), getCampusScope: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    announcement: { findUnique: vi.fn() },
    student: { findMany: vi.fn() },
  },
}));

import { auth } from "@/lib/auth";
import { getCampusScope } from "@/lib/campus-scope";
import { prisma } from "@/lib/prisma";
import { GET } from "@/app/api/admin/announcements/[id]/whatsapp/route";

function ctx(id = "a1") {
  return { params: Promise.resolve({ id }) };
}

describe("GET /api/admin/announcements/[id]/whatsapp", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 without a session", async () => {
    (auth as any).mockResolvedValue(null);
    const res = await GET(new Request("http://localhost"), ctx());
    expect(res.status).toBe(401);
  });

  it("returns only students with a valid mobile number, plus the composed message", async () => {
    (auth as any).mockResolvedValue({ user: { id: "s1", role: "STAFF" } });
    (getCampusScope as any).mockResolvedValue({ type: "ALL" });
    (prisma.announcement.findUnique as any).mockResolvedValue({
      id: "a1",
      title: "Aviso",
      body: "Mañana no hay clases.",
      audience: "ALL",
      campusId: null,
      role: null,
    });
    (prisma.student.findMany as any).mockResolvedValue([
      { telefonoMovil: "2281234567", user: { name: "Ana" } },
      { telefonoMovil: "123", user: { name: "Sin número válido" } },
    ]);

    const res = await GET(new Request("http://localhost"), ctx());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toBe("Aviso\n\nMañana no hay clases.");
    expect(body.recipients).toEqual([{ name: "Ana", phone: "2281234567" }]);
  });

  it("returns no phone recipients for a ROLE announcement aimed at TEACHERs", async () => {
    (auth as any).mockResolvedValue({ user: { id: "s1", role: "STAFF" } });
    (getCampusScope as any).mockResolvedValue({ type: "ALL" });
    (prisma.announcement.findUnique as any).mockResolvedValue({
      id: "a1",
      title: "Junta de maestros",
      body: "Viernes 3pm.",
      audience: "ROLE",
      campusId: null,
      role: "TEACHER",
    });

    const res = await GET(new Request("http://localhost"), ctx());
    const body = await res.json();
    expect(body.recipients).toEqual([]);
    expect(prisma.student.findMany).not.toHaveBeenCalled();
  });
});
