import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { interAreaTicket: { findMany: vi.fn(), create: vi.fn() }, user: { findUnique: vi.fn() } },
}));

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { GET, POST } from "@/app/api/admin/tickets/route";

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/admin/tickets", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("GET /api/admin/tickets", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 without a session", async () => {
    (auth as any).mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns all tickets, most recent first", async () => {
    (auth as any).mockResolvedValue({ user: { id: "a1", role: "ADMIN" } });
    (prisma.interAreaTicket.findMany as any).mockResolvedValue([]);

    const res = await GET();
    expect(res.status).toBe(200);
    expect(prisma.interAreaTicket.findMany).toHaveBeenCalledWith({
      orderBy: { createdAt: "desc" },
      include: {
        createdBy: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, name: true } },
      },
    });
  });
});

describe("POST /api/admin/tickets", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 without a session", async () => {
    (auth as any).mockResolvedValue(null);
    const res = await POST(jsonRequest({ title: "t", description: "d" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 for a blank title or description", async () => {
    (auth as any).mockResolvedValue({ user: { id: "a1", role: "ADMIN" } });
    const res = await POST(jsonRequest({ title: "   ", description: "d" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for a nonexistent assignedToId", async () => {
    (auth as any).mockResolvedValue({ user: { id: "a1", role: "ADMIN" } });
    (prisma.user.findUnique as any).mockResolvedValue(null);
    const res = await POST(jsonRequest({ title: "t", description: "d", assignedToId: "u404" }));
    expect(res.status).toBe(400);
    expect(prisma.interAreaTicket.create).not.toHaveBeenCalled();
  });

  it("treats an empty-string assignedToId as null without checking existence", async () => {
    (auth as any).mockResolvedValue({ user: { id: "a1", role: "ADMIN" } });
    (prisma.interAreaTicket.create as any).mockResolvedValue({ id: "t1" });

    const res = await POST(jsonRequest({ title: "t", description: "d", assignedToId: "" }));
    expect(res.status).toBe(201);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(prisma.interAreaTicket.create).toHaveBeenCalledWith({
      data: {
        title: "t",
        description: "d",
        assignedToId: null,
        createdById: "a1",
      },
    });
  });

  it("creates the ticket on success", async () => {
    (auth as any).mockResolvedValue({ user: { id: "a1", role: "STAFF" } });
    (prisma.interAreaTicket.create as any).mockResolvedValue({ id: "t1" });

    const res = await POST(jsonRequest({ title: "Reposición de examen", description: "Alumno solicita..." }));
    expect(res.status).toBe(201);
    expect(prisma.interAreaTicket.create).toHaveBeenCalledWith({
      data: {
        title: "Reposición de examen",
        description: "Alumno solicita...",
        assignedToId: null,
        createdById: "a1",
      },
    });
  });
});
