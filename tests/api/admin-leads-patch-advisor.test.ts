import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/campus-scope", () => ({ getCampusScope: vi.fn() }));
vi.mock("@/lib/notifications", () => ({ notify: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    campus: { findUnique: vi.fn() },
    lead: { findUnique: vi.fn(), update: vi.fn() },
    user: { findUnique: vi.fn() },
  },
}));

import { auth } from "@/lib/auth";
import { getCampusScope } from "@/lib/campus-scope";
import { notify } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { PATCH } from "@/app/api/admin/leads/[id]/route";

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/admin/leads/l1", {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("PATCH /api/admin/leads/[id] — advisor assignment", () => {
  beforeEach(() => vi.clearAllMocks());

  it("accepts the new PLACEMENT_SCHEDULED status (regression test for the pre-existing VALID_STATUSES gap)", async () => {
    (auth as any).mockResolvedValue({ user: { id: "a1", role: "ADMIN" } });
    (prisma.lead.findUnique as any).mockResolvedValue({ id: "l1", campusId: "c1" });
    (getCampusScope as any).mockResolvedValue({ type: "ALL" });
    (prisma.lead.update as any).mockResolvedValue({ id: "l1", status: "PLACEMENT_SCHEDULED" });

    const res = await PATCH(jsonRequest({ status: "PLACEMENT_SCHEDULED" }), makeParams("l1"));
    expect(res.status).toBe(200);
  });

  it("returns 400 for a nonexistent asesorAsignadoId", async () => {
    (auth as any).mockResolvedValue({ user: { id: "a1", role: "ADMIN" } });
    (prisma.lead.findUnique as any).mockResolvedValue({ id: "l1", campusId: "c1" });
    (getCampusScope as any).mockResolvedValue({ type: "ALL" });
    (prisma.user.findUnique as any).mockResolvedValue(null);

    const res = await PATCH(jsonRequest({ asesorAsignadoId: "u404" }), makeParams("l1"));
    expect(res.status).toBe(400);
    expect(prisma.lead.update).not.toHaveBeenCalled();
  });

  it("assigns the advisor and notifies them on success", async () => {
    (auth as any).mockResolvedValue({ user: { id: "a1", role: "ADMIN" } });
    (prisma.lead.findUnique as any).mockResolvedValue({ id: "l1", campusId: "c1", name: "Ana Torres" });
    (getCampusScope as any).mockResolvedValue({ type: "ALL" });
    (prisma.user.findUnique as any).mockResolvedValue({ id: "advisor1" });
    (prisma.lead.update as any).mockResolvedValue({ id: "l1", asesorAsignadoId: "advisor1" });

    const res = await PATCH(jsonRequest({ asesorAsignadoId: "advisor1" }), makeParams("l1"));
    expect(res.status).toBe(200);
    expect(prisma.lead.update).toHaveBeenCalledWith({
      where: { id: "l1" },
      data: { asesorAsignadoId: "advisor1" },
    });
    expect(notify).toHaveBeenCalledWith(
      "advisor1",
      expect.stringContaining("Ana Torres"),
      expect.any(String)
    );
  });

  it("allows clearing the advisor assignment with null, without notifying anyone", async () => {
    (auth as any).mockResolvedValue({ user: { id: "a1", role: "ADMIN" } });
    (prisma.lead.findUnique as any).mockResolvedValue({ id: "l1", campusId: "c1" });
    (getCampusScope as any).mockResolvedValue({ type: "ALL" });
    (prisma.lead.update as any).mockResolvedValue({ id: "l1", asesorAsignadoId: null });

    const res = await PATCH(jsonRequest({ asesorAsignadoId: null }), makeParams("l1"));
    expect(res.status).toBe(200);
    expect(prisma.lead.update).toHaveBeenCalledWith({
      where: { id: "l1" },
      data: { asesorAsignadoId: null },
    });
    expect(notify).not.toHaveBeenCalled();
  });
});
