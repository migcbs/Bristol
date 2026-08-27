import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/campus-scope", () => ({ getCampusScope: vi.fn() }));
vi.mock("@/lib/announcement-scope", () => ({ resolveAnnouncementRecipients: vi.fn() }));
vi.mock("@/lib/email", () => ({ sendAnnouncementEmail: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { announcement: { create: vi.fn() }, campus: { findUnique: vi.fn() } },
}));

import { auth } from "@/lib/auth";
import { getCampusScope } from "@/lib/campus-scope";
import { resolveAnnouncementRecipients } from "@/lib/announcement-scope";
import { sendAnnouncementEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";
import { POST } from "@/app/api/admin/announcements/route";

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/admin/announcements", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/admin/announcements", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 without a session", async () => {
    (auth as any).mockResolvedValue(null);
    const res = await POST(jsonRequest({ title: "t", body: "b", audience: "ALL" }));
    expect(res.status).toBe(401);
  });

  it("returns 403 for a TEACHER", async () => {
    (auth as any).mockResolvedValue({ user: { id: "t1", role: "TEACHER" } });
    const res = await POST(jsonRequest({ title: "t", body: "b", audience: "ALL" }));
    expect(res.status).toBe(403);
  });

  it("returns 400 for an inconsistent audience/campusId/role combination", async () => {
    (auth as any).mockResolvedValue({ user: { id: "a1", role: "ADMIN" } });
    const res = await POST(jsonRequest({ title: "t", body: "b", audience: "CAMPUS" })); // missing campusId
    expect(res.status).toBe(400);
  });

  it("returns 403 when STAFF tries audience ALL", async () => {
    (auth as any).mockResolvedValue({ user: { id: "s1", role: "STAFF" } });
    const res = await POST(jsonRequest({ title: "t", body: "b", audience: "ALL" }));
    expect(res.status).toBe(403);
    expect(prisma.announcement.create).not.toHaveBeenCalled();
  });

  it("returns 403 when STAFF targets a campus outside their scope", async () => {
    (auth as any).mockResolvedValue({ user: { id: "s1", role: "STAFF" } });
    (prisma.campus.findUnique as any).mockResolvedValue({ id: "c2" });
    (getCampusScope as any).mockResolvedValue({ type: "CAMPUS_LIST", campusIds: ["c1"] });
    const res = await POST(jsonRequest({ title: "t", body: "b", audience: "CAMPUS", campusId: "c2" }));
    expect(res.status).toBe(403);
    expect(prisma.announcement.create).not.toHaveBeenCalled();
  });

  it("returns 404 when the campusId doesn't exist (ADMIN)", async () => {
    (auth as any).mockResolvedValue({ user: { id: "a1", role: "ADMIN" } });
    (prisma.campus.findUnique as any).mockResolvedValue(null);
    const res = await POST(jsonRequest({ title: "t", body: "b", audience: "CAMPUS", campusId: "nope" }));
    expect(res.status).toBe(404);
    expect(prisma.announcement.create).not.toHaveBeenCalled();
  });

  it("returns 400 when title is only whitespace", async () => {
    (auth as any).mockResolvedValue({ user: { id: "a1", role: "ADMIN" } });
    const res = await POST(jsonRequest({ title: "   ", body: "b", audience: "ALL" }));
    expect(res.status).toBe(400);
    expect(prisma.announcement.create).not.toHaveBeenCalled();
  });

  it("returns 400 when body is only whitespace", async () => {
    (auth as any).mockResolvedValue({ user: { id: "a1", role: "ADMIN" } });
    const res = await POST(jsonRequest({ title: "t", body: "   ", audience: "ALL" }));
    expect(res.status).toBe(400);
    expect(prisma.announcement.create).not.toHaveBeenCalled();
  });

  it("returns 400 when title exceeds the max length", async () => {
    (auth as any).mockResolvedValue({ user: { id: "a1", role: "ADMIN" } });
    const res = await POST(jsonRequest({ title: "a".repeat(201), body: "b", audience: "ALL" }));
    expect(res.status).toBe(400);
    expect(prisma.announcement.create).not.toHaveBeenCalled();
  });

  it("returns 400 when body exceeds the max length", async () => {
    (auth as any).mockResolvedValue({ user: { id: "a1", role: "ADMIN" } });
    const res = await POST(jsonRequest({ title: "t", body: "a".repeat(5001), audience: "ALL" }));
    expect(res.status).toBe(400);
    expect(prisma.announcement.create).not.toHaveBeenCalled();
  });

  it("returns 400 when title is not a string", async () => {
    (auth as any).mockResolvedValue({ user: { id: "a1", role: "ADMIN" } });
    const res = await POST(jsonRequest({ title: 123, body: "b", audience: "ALL" }));
    expect(res.status).toBe(400);
    expect(prisma.announcement.create).not.toHaveBeenCalled();
  });

  it("trims title and body before creating the announcement", async () => {
    (auth as any).mockResolvedValue({ user: { id: "a1", role: "ADMIN" } });
    (prisma.announcement.create as any).mockResolvedValue({ id: "an1" });
    const res = await POST(jsonRequest({ title: "  t  ", body: "  b  ", audience: "ALL" }));
    expect(res.status).toBe(201);
    expect(prisma.announcement.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ title: "t", body: "b" }) })
    );
  });

  it("returns 400 for audience ROLE with role STAFF (STAFF/ADMIN aren't valid announcement targets)", async () => {
    (auth as any).mockResolvedValue({ user: { id: "a1", role: "ADMIN" } });
    const res = await POST(jsonRequest({ title: "t", body: "b", audience: "ROLE", role: "STAFF" }));
    expect(res.status).toBe(400);
    expect(prisma.announcement.create).not.toHaveBeenCalled();
  });

  it("returns 400 for audience ROLE with role ADMIN", async () => {
    (auth as any).mockResolvedValue({ user: { id: "a1", role: "ADMIN" } });
    const res = await POST(jsonRequest({ title: "t", body: "b", audience: "ROLE", role: "ADMIN" }));
    expect(res.status).toBe(400);
    expect(prisma.announcement.create).not.toHaveBeenCalled();
  });

  it("creates the announcement on success for ADMIN with audience ROLE, without sending email when sendEmail is false", async () => {
    (auth as any).mockResolvedValue({ user: { id: "a1", role: "ADMIN" } });
    (prisma.announcement.create as any).mockResolvedValue({ id: "an1" });

    const res = await POST(
      jsonRequest({ title: "t", body: "b", audience: "ROLE", role: "TEACHER", sendEmail: false })
    );

    expect(res.status).toBe(201);
    expect(prisma.announcement.create).toHaveBeenCalledWith({
      data: {
        title: "t",
        body: "b",
        audience: "ROLE",
        campusId: null,
        role: "TEACHER",
        sendEmail: false,
        createdById: "a1",
      },
    });
    expect(sendAnnouncementEmail).not.toHaveBeenCalled();
  });

  it("sends email to every resolved recipient when sendEmail is true, and still returns 201 if a send fails", async () => {
    (auth as any).mockResolvedValue({ user: { id: "a1", role: "ADMIN" } });
    (prisma.announcement.create as any).mockResolvedValue({ id: "an1", title: "t", body: "b" });
    (resolveAnnouncementRecipients as any).mockResolvedValue([
      { id: "u1", email: "u1@x.com" },
      { id: "u2", email: "u2@x.com" },
    ]);
    (sendAnnouncementEmail as any)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("resend down"));

    const res = await POST(jsonRequest({ title: "t", body: "b", audience: "ALL", sendEmail: true }));

    expect(res.status).toBe(201);
    expect(sendAnnouncementEmail).toHaveBeenCalledTimes(2);
  });

  it("still returns 201 when resolveAnnouncementRecipients throws", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    (auth as any).mockResolvedValue({ user: { id: "a1", role: "ADMIN" } });
    (prisma.announcement.create as any).mockResolvedValue({ id: "an1", title: "t", body: "b" });
    (resolveAnnouncementRecipients as any).mockRejectedValue(new Error("db down"));

    const res = await POST(jsonRequest({ title: "t", body: "b", audience: "ALL", sendEmail: true }));

    expect(res.status).toBe(201);
    const created = await res.json();
    expect(created).toEqual({ id: "an1", title: "t", body: "b" });
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
