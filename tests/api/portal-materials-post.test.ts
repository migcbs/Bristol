import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { group: { findUnique: vi.fn() }, material: { create: vi.fn() } },
}));

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { POST } from "@/app/api/portal/materials/route";

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/portal/materials", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

const VALID_BODY = { groupId: "g1", title: "Guía de verbos", url: "https://drive.google.com/x" };

describe("POST /api/portal/materials", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 without a session", async () => {
    (auth as any).mockResolvedValue(null);
    const res = await POST(jsonRequest(VALID_BODY));
    expect(res.status).toBe(401);
  });

  it("returns 403 for a non-TEACHER role", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1", role: "STUDENT" } });
    const res = await POST(jsonRequest(VALID_BODY));
    expect(res.status).toBe(403);
  });

  it("returns 403 when the group is not the caller's own", async () => {
    (auth as any).mockResolvedValue({ user: { id: "t1", role: "TEACHER" } });
    (prisma.group.findUnique as any).mockResolvedValue({ id: "g1", teacherId: "t2" });
    const res = await POST(jsonRequest(VALID_BODY));
    expect(res.status).toBe(403);
    expect(prisma.material.create).not.toHaveBeenCalled();
  });

  it("returns 400 for a malformed url", async () => {
    (auth as any).mockResolvedValue({ user: { id: "t1", role: "TEACHER" } });
    (prisma.group.findUnique as any).mockResolvedValue({ id: "g1", teacherId: "t1" });
    const res = await POST(jsonRequest({ groupId: "g1", title: "x", url: "not-a-url" }));
    expect(res.status).toBe(400);
    expect(prisma.material.create).not.toHaveBeenCalled();
  });

  it("returns 400 for a blank title", async () => {
    (auth as any).mockResolvedValue({ user: { id: "t1", role: "TEACHER" } });
    (prisma.group.findUnique as any).mockResolvedValue({ id: "g1", teacherId: "t1" });
    const res = await POST(jsonRequest({ groupId: "g1", title: "   ", url: "https://x.com" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when the description exceeds the length cap", async () => {
    (auth as any).mockResolvedValue({ user: { id: "t1", role: "TEACHER" } });
    (prisma.group.findUnique as any).mockResolvedValue({ id: "g1", teacherId: "t1" });
    const res = await POST(jsonRequest({ ...VALID_BODY, description: "x".repeat(2001) }));
    expect(res.status).toBe(400);
    expect(prisma.material.create).not.toHaveBeenCalled();
  });

  it("returns 400 when the url exceeds the length cap", async () => {
    (auth as any).mockResolvedValue({ user: { id: "t1", role: "TEACHER" } });
    (prisma.group.findUnique as any).mockResolvedValue({ id: "g1", teacherId: "t1" });
    const longUrl = "https://drive.google.com/" + "x".repeat(2048);
    const res = await POST(jsonRequest({ ...VALID_BODY, url: longUrl }));
    expect(res.status).toBe(400);
    expect(prisma.material.create).not.toHaveBeenCalled();
  });

  it("creates the material on success, trimming the title", async () => {
    (auth as any).mockResolvedValue({ user: { id: "t1", role: "TEACHER" } });
    (prisma.group.findUnique as any).mockResolvedValue({ id: "g1", teacherId: "t1" });
    (prisma.material.create as any).mockResolvedValue({ id: "m1" });

    const res = await POST(jsonRequest({ ...VALID_BODY, title: "  Guía de verbos  " }));
    expect(res.status).toBe(201);
    expect(prisma.material.create).toHaveBeenCalledWith({
      data: {
        groupId: "g1",
        title: "Guía de verbos",
        url: "https://drive.google.com/x",
        description: null,
        uploadedById: "t1",
      },
    });
  });
});
