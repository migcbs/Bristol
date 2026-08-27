import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/campus-scope", () => ({ getCampusScope: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    group: { findUnique: vi.fn() },
    student: { findUnique: vi.fn() },
    enrollment: { findFirst: vi.fn() },
    incident: { create: vi.fn() },
  },
}));

import { auth } from "@/lib/auth";
import { getCampusScope } from "@/lib/campus-scope";
import { prisma } from "@/lib/prisma";
import { POST } from "@/app/api/portal/incidents/route";

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/portal/incidents", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/portal/incidents", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 without a session", async () => {
    (auth as any).mockResolvedValue(null);
    const res = await POST(jsonRequest({ studentId: "s1", description: "x" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 for a missing description", async () => {
    (auth as any).mockResolvedValue({ user: { id: "t1", role: "TEACHER" } });
    const res = await POST(jsonRequest({ studentId: "s1" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for a whitespace-only description", async () => {
    (auth as any).mockResolvedValue({ user: { id: "t1", role: "TEACHER" } });
    const res = await POST(jsonRequest({ studentId: "s1", description: "   " }));
    expect(res.status).toBe(400);
    expect(prisma.incident.create).not.toHaveBeenCalled();
  });

  it("returns 400 for a description exceeding the max length", async () => {
    (auth as any).mockResolvedValue({ user: { id: "t1", role: "TEACHER" } });
    const res = await POST(jsonRequest({ studentId: "s1", description: "a".repeat(2001) }));
    expect(res.status).toBe(400);
    expect(prisma.incident.create).not.toHaveBeenCalled();
  });

  it("returns 403 when groupId is provided but not the teacher's own group", async () => {
    (auth as any).mockResolvedValue({ user: { id: "t1", role: "TEACHER" } });
    (prisma.group.findUnique as any).mockResolvedValue({ id: "g1", teacherId: "t2" });

    const res = await POST(jsonRequest({ studentId: "s1", groupId: "g1", description: "x" }));
    expect(res.status).toBe(403);
    expect(prisma.incident.create).not.toHaveBeenCalled();
  });

  it("returns 400 when the student has no active enrollment in the specified group", async () => {
    (auth as any).mockResolvedValue({ user: { id: "t1", role: "TEACHER" } });
    (prisma.group.findUnique as any).mockResolvedValue({ id: "g1", teacherId: "t1" });
    (prisma.enrollment.findFirst as any).mockResolvedValue(null);

    const res = await POST(jsonRequest({ studentId: "s1", groupId: "g1", description: "x" }));
    expect(res.status).toBe(400);
  });

  it("returns 404 when no groupId is given and the student is outside the caller's campus scope", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u2", role: "STAFF" } });
    (getCampusScope as any).mockResolvedValue({ type: "CAMPUS_LIST", campusIds: ["c1"] });
    (prisma.student.findUnique as any).mockResolvedValue({ id: "s1", campusId: "c2" });

    const res = await POST(jsonRequest({ studentId: "s1", description: "x" }));
    expect(res.status).toBe(404);
  });

  it("returns 404 when no groupId is given and a TEACHER's student is outside their campus scope", async () => {
    (auth as any).mockResolvedValue({ user: { id: "t1", role: "TEACHER" } });
    (getCampusScope as any).mockResolvedValue({ type: "CAMPUS_LIST", campusIds: ["c1"] });
    (prisma.student.findUnique as any).mockResolvedValue({ id: "s1", campusId: "c2" });

    const res = await POST(jsonRequest({ studentId: "s1", description: "x" }));
    expect(res.status).toBe(404);
  });

  it("creates the incident on success with a groupId", async () => {
    (auth as any).mockResolvedValue({ user: { id: "t1", role: "TEACHER" } });
    (prisma.group.findUnique as any).mockResolvedValue({ id: "g1", teacherId: "t1" });
    (prisma.enrollment.findFirst as any).mockResolvedValue({ id: "e1" });
    (prisma.incident.create as any).mockResolvedValue({ id: "i1" });

    const res = await POST(jsonRequest({ studentId: "s1", groupId: "g1", description: "Llegó tarde" }));
    expect(res.status).toBe(201);
    expect(prisma.incident.create).toHaveBeenCalledWith({
      data: { studentId: "s1", groupId: "g1", reportedById: "t1", description: "Llegó tarde" },
    });
  });

  it("trims the description before saving", async () => {
    (auth as any).mockResolvedValue({ user: { id: "t1", role: "TEACHER" } });
    (prisma.group.findUnique as any).mockResolvedValue({ id: "g1", teacherId: "t1" });
    (prisma.enrollment.findFirst as any).mockResolvedValue({ id: "e1" });
    (prisma.incident.create as any).mockResolvedValue({ id: "i1" });

    const res = await POST(
      jsonRequest({ studentId: "s1", groupId: "g1", description: "  Llegó tarde  " })
    );
    expect(res.status).toBe(201);
    expect(prisma.incident.create).toHaveBeenCalledWith({
      data: { studentId: "s1", groupId: "g1", reportedById: "t1", description: "Llegó tarde" },
    });
  });
});
