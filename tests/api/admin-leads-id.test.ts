import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/campus-scope", () => ({ getCampusScope: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    lead: { findUnique: vi.fn(), update: vi.fn() },
    campus: { findUnique: vi.fn() },
  },
}));

import { auth } from "@/lib/auth";
import { getCampusScope } from "@/lib/campus-scope";
import { prisma } from "@/lib/prisma";
import { PATCH } from "@/app/api/admin/leads/[id]/route";

function patchRequest(body: unknown) {
  return new Request("http://localhost/api/admin/leads/l1", {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

const ctx = { params: Promise.resolve({ id: "l1" }) };

describe("PATCH /api/admin/leads/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when there is no session", async () => {
    (auth as any).mockResolvedValue(null);
    const res = await PATCH(patchRequest({ status: "CONTACTED" }), ctx);
    expect(res.status).toBe(401);
  });

  it("returns 403 for a non-admin, non-staff role", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1", role: "PARENT" } });
    const res = await PATCH(patchRequest({ status: "CONTACTED" }), ctx);
    expect(res.status).toBe(403);
  });

  it("returns 400 for an invalid status value", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1", role: "ADMIN" } });
    const res = await PATCH(patchRequest({ status: "MAYBE" }), ctx);
    expect(res.status).toBe(400);
  });

  it("returns 400 when campusId does not reference an existing campus", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1", role: "ADMIN" } });
    (prisma.campus.findUnique as any).mockResolvedValue(null);
    const res = await PATCH(patchRequest({ campusId: "bogus" }), ctx);
    expect(res.status).toBe(400);
  });

  it("returns 404 when the lead is outside the caller's scope", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u2", role: "STAFF" } });
    (getCampusScope as any).mockResolvedValue({ type: "CAMPUS_LIST", campusIds: ["c1"] });
    (prisma.lead.findUnique as any).mockResolvedValue({ id: "l1", campusId: "c2" });

    const res = await PATCH(patchRequest({ status: "CONTACTED" }), ctx);
    expect(res.status).toBe(404);
    expect(prisma.lead.update).not.toHaveBeenCalled();
  });

  it("updates status for a lead within scope", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u2", role: "STAFF" } });
    (getCampusScope as any).mockResolvedValue({ type: "CAMPUS_LIST", campusIds: ["c1"] });
    (prisma.lead.findUnique as any).mockResolvedValue({ id: "l1", campusId: "c1" });
    (prisma.lead.update as any).mockResolvedValue({ id: "l1", status: "CONTACTED" });

    const res = await PATCH(patchRequest({ status: "CONTACTED" }), ctx);
    expect(res.status).toBe(200);
    expect(prisma.lead.update).toHaveBeenCalledWith({
      where: { id: "l1" },
      data: { status: "CONTACTED" },
    });
  });

  it("returns 400 when a STAFF user targets a campusId outside their scope", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u2", role: "STAFF" } });
    (getCampusScope as any).mockResolvedValue({ type: "CAMPUS_LIST", campusIds: ["c1"] });
    (prisma.lead.findUnique as any).mockResolvedValue({ id: "l1", campusId: "c1" });
    (prisma.campus.findUnique as any).mockResolvedValue({ id: "c2" });

    const res = await PATCH(patchRequest({ campusId: "c2" }), ctx);
    expect(res.status).toBe(400);
    expect(prisma.lead.update).not.toHaveBeenCalled();
  });

  it("updates campusId for an unassigned lead within scope (STAFF claiming it)", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u2", role: "STAFF" } });
    (getCampusScope as any).mockResolvedValue({ type: "CAMPUS_LIST", campusIds: ["c1"] });
    (prisma.lead.findUnique as any).mockResolvedValue({ id: "l1", campusId: null });
    (prisma.campus.findUnique as any).mockResolvedValue({ id: "c1" });
    (prisma.lead.update as any).mockResolvedValue({ id: "l1", campusId: "c1" });

    const res = await PATCH(patchRequest({ campusId: "c1" }), ctx);
    expect(res.status).toBe(200);
    expect(prisma.lead.update).toHaveBeenCalledWith({
      where: { id: "l1" },
      data: { campusId: "c1" },
    });
  });
});
