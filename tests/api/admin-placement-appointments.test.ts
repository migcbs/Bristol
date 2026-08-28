import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/campus-scope", () => ({ getCampusScope: vi.fn(), assertCampusInScope: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    placementAppointment: { findMany: vi.fn(), create: vi.fn() },
    lead: { findUnique: vi.fn() },
  },
}));

import { auth } from "@/lib/auth";
import { assertCampusInScope, getCampusScope } from "@/lib/campus-scope";
import { prisma } from "@/lib/prisma";
import { GET, POST } from "@/app/api/admin/placement-appointments/route";

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/admin/placement-appointments", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

const VALID_BODY = { leadId: "l1", campusId: "c1", scheduledFor: "2026-09-01T16:00:00.000Z" };

describe("GET /api/admin/placement-appointments", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 without a session", async () => {
    (auth as any).mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns appointments scoped by campus", async () => {
    (auth as any).mockResolvedValue({ user: { id: "s1", role: "STAFF" } });
    (getCampusScope as any).mockResolvedValue({ type: "CAMPUS_LIST", campusIds: ["c1"] });
    (prisma.placementAppointment.findMany as any).mockResolvedValue([]);

    const res = await GET();
    expect(res.status).toBe(200);
    expect(prisma.placementAppointment.findMany).toHaveBeenCalledWith({
      where: { campusId: { in: ["c1"] } },
      orderBy: { scheduledFor: "asc" },
      include: { lead: true },
    });
  });
});

describe("POST /api/admin/placement-appointments", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 for a nonexistent leadId", async () => {
    (auth as any).mockResolvedValue({ user: { id: "a1", role: "ADMIN" } });
    (prisma.lead.findUnique as any).mockResolvedValue(null);
    const res = await POST(jsonRequest(VALID_BODY));
    expect(res.status).toBe(404);
    expect(prisma.placementAppointment.create).not.toHaveBeenCalled();
  });

  it("returns 400 when the requested slot overlaps an existing appointment at the same campus and time", async () => {
    (auth as any).mockResolvedValue({ user: { id: "a1", role: "ADMIN" } });
    (prisma.lead.findUnique as any).mockResolvedValue({ id: "l1" });
    (prisma.placementAppointment.findMany as any).mockResolvedValue([
      { id: "existing", scheduledFor: new Date(VALID_BODY.scheduledFor) },
    ]);

    const res = await POST(jsonRequest(VALID_BODY));
    expect(res.status).toBe(400);
    expect(prisma.placementAppointment.create).not.toHaveBeenCalled();
  });

  it("returns 403 when STAFF attempts to create an appointment outside their campus scope", async () => {
    (auth as any).mockResolvedValue({ user: { id: "s1", role: "STAFF" } });
    (assertCampusInScope as any).mockImplementation(async (_user: unknown, campusId: string) => campusId === "c1");
    (prisma.lead.findUnique as any).mockResolvedValue({ id: "l1" });

    const res = await POST(jsonRequest({ ...VALID_BODY, campusId: "c2" }));
    expect(res.status).toBe(403);
    expect(prisma.placementAppointment.create).not.toHaveBeenCalled();
  });

  it("creates the appointment on success", async () => {
    (auth as any).mockResolvedValue({ user: { id: "a1", role: "ADMIN" } });
    (prisma.lead.findUnique as any).mockResolvedValue({ id: "l1" });
    (prisma.placementAppointment.findMany as any).mockResolvedValue([]);
    (prisma.placementAppointment.create as any).mockResolvedValue({ id: "pa1" });

    const res = await POST(jsonRequest(VALID_BODY));
    expect(res.status).toBe(201);
  });

  it("returns 400 when notes exceed 2000 characters", async () => {
    (auth as any).mockResolvedValue({ user: { id: "a1", role: "ADMIN" } });
    const res = await POST(jsonRequest({ ...VALID_BODY, notes: "a".repeat(2001) }));
    expect(res.status).toBe(400);
    expect(prisma.placementAppointment.create).not.toHaveBeenCalled();
  });

  it("returns 403 when STAFF attempts to attach a lead outside their campus scope", async () => {
    (auth as any).mockResolvedValue({ user: { id: "s1", role: "STAFF" } });
    (assertCampusInScope as any).mockImplementation(async (_user: unknown, campusId: string) => campusId === "c1");
    (prisma.lead.findUnique as any).mockResolvedValue({ id: "l1", campusId: "c2" });

    const res = await POST(jsonRequest(VALID_BODY));
    expect(res.status).toBe(403);
    expect(prisma.placementAppointment.create).not.toHaveBeenCalled();
  });

  it("allows STAFF to attach a lead with no assigned campus", async () => {
    (auth as any).mockResolvedValue({ user: { id: "s1", role: "STAFF" } });
    (assertCampusInScope as any).mockImplementation(async (_user: unknown, campusId: string) => campusId === "c1");
    (prisma.lead.findUnique as any).mockResolvedValue({ id: "l1", campusId: null });
    (prisma.placementAppointment.findMany as any).mockResolvedValue([]);
    (prisma.placementAppointment.create as any).mockResolvedValue({ id: "pa1" });

    const res = await POST(jsonRequest(VALID_BODY));
    expect(res.status).toBe(201);
  });

  it("returns 409 when the lead already has an appointment", async () => {
    (auth as any).mockResolvedValue({ user: { id: "a1", role: "ADMIN" } });
    (prisma.lead.findUnique as any).mockResolvedValue({ id: "l1" });
    (prisma.placementAppointment.findMany as any).mockResolvedValue([]);
    const collision = Object.assign(new Error("Unique constraint failed"), {
      code: "P2002",
      meta: { target: ["leadId"] },
    });
    (prisma.placementAppointment.create as any).mockRejectedValue(collision);

    const res = await POST(jsonRequest(VALID_BODY));
    expect(res.status).toBe(409);
  });
});
