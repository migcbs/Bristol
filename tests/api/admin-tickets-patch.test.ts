import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { interAreaTicket: { findUnique: vi.fn(), update: vi.fn() }, user: { findUnique: vi.fn() } },
}));

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PATCH } from "@/app/api/admin/tickets/[id]/route";

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/admin/tickets/t1", {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("PATCH /api/admin/tickets/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 without a session", async () => {
    (auth as any).mockResolvedValue(null);
    const res = await PATCH(jsonRequest({ status: "EN_PROCESO" }), makeParams("t1"));
    expect(res.status).toBe(401);
  });

  it("returns 400 for an invalid status value", async () => {
    (auth as any).mockResolvedValue({ user: { id: "a1", role: "ADMIN" } });
    const res = await PATCH(jsonRequest({ status: "BOGUS" }), makeParams("t1"));
    expect(res.status).toBe(400);
  });

  it("returns 404 for a nonexistent ticket", async () => {
    (auth as any).mockResolvedValue({ user: { id: "a1", role: "ADMIN" } });
    (prisma.interAreaTicket.findUnique as any).mockResolvedValue(null);
    const res = await PATCH(jsonRequest({ status: "EN_PROCESO" }), makeParams("t1"));
    expect(res.status).toBe(404);
  });

  it("sets resolvedAt when transitioning to RESUELTO, clears it otherwise", async () => {
    (auth as any).mockResolvedValue({ user: { id: "a1", role: "ADMIN" } });
    (prisma.interAreaTicket.findUnique as any).mockResolvedValue({ id: "t1", status: "EN_PROCESO" });
    (prisma.interAreaTicket.update as any).mockResolvedValue({ id: "t1", status: "RESUELTO" });

    const res = await PATCH(jsonRequest({ status: "RESUELTO" }), makeParams("t1"));
    expect(res.status).toBe(200);
    expect(prisma.interAreaTicket.update).toHaveBeenCalledWith({
      where: { id: "t1" },
      data: { status: "RESUELTO", resolvedAt: expect.any(Date) },
    });
  });

  it("treats an empty-string assignedToId as null without checking existence", async () => {
    (auth as any).mockResolvedValue({ user: { id: "a1", role: "ADMIN" } });
    (prisma.interAreaTicket.findUnique as any).mockResolvedValue({ id: "t1", status: "ABIERTO" });
    (prisma.interAreaTicket.update as any).mockResolvedValue({ id: "t1", assignedToId: null });

    const res = await PATCH(jsonRequest({ assignedToId: "" }), makeParams("t1"));
    expect(res.status).toBe(200);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(prisma.interAreaTicket.update).toHaveBeenCalledWith({
      where: { id: "t1" },
      data: { assignedToId: null },
    });
  });

  it("allows reassignment via assignedToId", async () => {
    (auth as any).mockResolvedValue({ user: { id: "a1", role: "ADMIN" } });
    (prisma.interAreaTicket.findUnique as any).mockResolvedValue({ id: "t1", status: "ABIERTO" });
    (prisma.user.findUnique as any).mockResolvedValue({ id: "u2" });
    (prisma.interAreaTicket.update as any).mockResolvedValue({ id: "t1", assignedToId: "u2" });

    const res = await PATCH(jsonRequest({ assignedToId: "u2" }), makeParams("t1"));
    expect(res.status).toBe(200);
    expect(prisma.interAreaTicket.update).toHaveBeenCalledWith({
      where: { id: "t1" },
      data: { assignedToId: "u2" },
    });
  });
});
