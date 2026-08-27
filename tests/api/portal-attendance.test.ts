import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    group: { findUnique: vi.fn() },
    enrollment: { findMany: vi.fn() },
    attendanceRecord: { createMany: vi.fn() },
  },
}));

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { POST } from "@/app/api/portal/attendance/route";

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/portal/attendance", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

const VALID_BODY = {
  groupId: "g1",
  date: "2026-09-01",
  records: [{ enrollmentId: "e1", status: "PRESENT" }],
};

describe("POST /api/portal/attendance", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 without a session", async () => {
    (auth as any).mockResolvedValue(null);
    const res = await POST(jsonRequest(VALID_BODY));
    expect(res.status).toBe(401);
  });

  it("returns 403 when the group is not the caller's own", async () => {
    (auth as any).mockResolvedValue({ user: { id: "t1", role: "TEACHER" } });
    (prisma.group.findUnique as any).mockResolvedValue({ id: "g1", teacherId: "t2" });

    const res = await POST(jsonRequest(VALID_BODY));
    expect(res.status).toBe(403);
    expect(prisma.attendanceRecord.createMany).not.toHaveBeenCalled();
  });

  it("returns 400 when an enrollmentId is not an active enrollment in that group", async () => {
    (auth as any).mockResolvedValue({ user: { id: "t1", role: "TEACHER" } });
    (prisma.group.findUnique as any).mockResolvedValue({ id: "g1", teacherId: "t1" });
    (prisma.enrollment.findMany as any).mockResolvedValue([]);

    const res = await POST(jsonRequest(VALID_BODY));
    expect(res.status).toBe(400);
    expect(prisma.attendanceRecord.createMany).not.toHaveBeenCalled();
  });

  it("returns 400 when attendance for that date already exists (unique violation)", async () => {
    (auth as any).mockResolvedValue({ user: { id: "t1", role: "TEACHER" } });
    (prisma.group.findUnique as any).mockResolvedValue({ id: "g1", teacherId: "t1" });
    (prisma.enrollment.findMany as any).mockResolvedValue([{ id: "e1" }]);
    (prisma.attendanceRecord.createMany as any).mockRejectedValue(
      Object.assign(new Error("Unique constraint failed"), { code: "P2002" })
    );

    const res = await POST(jsonRequest(VALID_BODY));
    expect(res.status).toBe(400);
  });

  it("creates all records in one createMany call on success", async () => {
    (auth as any).mockResolvedValue({ user: { id: "t1", role: "TEACHER" } });
    (prisma.group.findUnique as any).mockResolvedValue({ id: "g1", teacherId: "t1" });
    (prisma.enrollment.findMany as any).mockResolvedValue([{ id: "e1" }]);
    (prisma.attendanceRecord.createMany as any).mockResolvedValue({ count: 1 });

    const res = await POST(jsonRequest(VALID_BODY));
    expect(res.status).toBe(201);
    expect(prisma.attendanceRecord.createMany).toHaveBeenCalledWith({
      data: [{ enrollmentId: "e1", date: new Date("2026-09-01"), status: "PRESENT" }],
    });
  });
});
