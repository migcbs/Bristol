import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/campus-scope", () => ({ assertCampusInScope: vi.fn() }));
vi.mock("@/lib/staff-permissions", () => ({ hasModuleAccess: vi.fn() }));
vi.mock("@/lib/notifications", () => ({ notify: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    group: { findUnique: vi.fn() },
    student: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import { auth } from "@/lib/auth";
import { assertCampusInScope } from "@/lib/campus-scope";
import { hasModuleAccess } from "@/lib/staff-permissions";
import { notify } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { POST } from "@/app/api/admin/groups/[id]/enroll/route";

function req(body: unknown) {
  return new Request("http://localhost/api/admin/groups/g2/enroll", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/admin/groups/[id]/enroll", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 without a session", async () => {
    (auth as any).mockResolvedValue(null);
    const res = await POST(req({ studentId: "st1" }), { params: Promise.resolve({ id: "g2" }) });
    expect(res.status).toBe(401);
  });

  it("returns 403 when the caller's puesto has no grupos access (e.g. CAJA)", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1", role: "STAFF" } });
    (hasModuleAccess as any).mockResolvedValue("none");
    const res = await POST(req({ studentId: "st1" }), { params: Promise.resolve({ id: "g2" }) });
    expect(res.status).toBe(403);
  });

  it("allows RECEPCION (initiate) to move a student, closing the old enrollment and preserving history", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1", role: "STAFF" } });
    (hasModuleAccess as any).mockResolvedValue("initiate");
    (assertCampusInScope as any).mockResolvedValue(true);
    (prisma.group.findUnique as any).mockResolvedValue({
      id: "g2",
      campusId: "c1",
      cupoMaximo: 20,
      _count: { enrollments: 5 },
    });
    (prisma.student.findUnique as any).mockResolvedValue({
      id: "st1",
      userId: "userSt1",
      campusId: "c1",
      enrollments: [{ id: "enr-old", groupId: "g1" }],
    });

    const txEnrollmentUpdate = vi.fn();
    const txEnrollmentCreate = vi.fn().mockResolvedValue({ id: "enr-new", groupId: "g2" });
    (prisma.$transaction as any).mockImplementation(async (fn: any) =>
      fn({
        enrollment: { update: txEnrollmentUpdate, create: txEnrollmentCreate },
      })
    );

    const res = await POST(req({ studentId: "st1" }), { params: Promise.resolve({ id: "g2" }) });
    expect(res.status).toBe(201);
    // The old enrollment is closed (completedAt set), never deleted — so
    // its Grade/BlockEvaluation/AttendanceRecord rows (keyed on
    // enrollmentId) survive the move intact.
    expect(txEnrollmentUpdate).toHaveBeenCalledWith({
      where: { id: "enr-old" },
      data: { completedAt: expect.any(Date) },
    });
    expect(txEnrollmentCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { studentId: "st1", groupId: "g2" } })
    );
    expect(notify).toHaveBeenCalledWith("userSt1", expect.any(String), "/portal/calificaciones");
  });

  it("rejects when the destination group has no cupo left", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1", role: "STAFF" } });
    (hasModuleAccess as any).mockResolvedValue("full");
    (assertCampusInScope as any).mockResolvedValue(true);
    (prisma.group.findUnique as any).mockResolvedValue({
      id: "g2",
      campusId: "c1",
      cupoMaximo: 5,
      _count: { enrollments: 5 },
    });
    (prisma.student.findUnique as any).mockResolvedValue({
      id: "st1",
      userId: "userSt1",
      campusId: "c1",
      enrollments: [],
    });

    const res = await POST(req({ studentId: "st1" }), { params: Promise.resolve({ id: "g2" }) });
    expect(res.status).toBe(400);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
