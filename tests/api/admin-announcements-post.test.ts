import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/campus-scope", () => ({ getCampusScope: vi.fn() }));
vi.mock("@/lib/announcement-scope", () => ({ resolveAnnouncementRecipients: vi.fn() }));
vi.mock("@/lib/email", () => ({ sendAnnouncementEmail: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { announcement: { create: vi.fn() } },
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
    (getCampusScope as any).mockResolvedValue({ type: "CAMPUS_LIST", campusIds: ["c1"] });
    const res = await POST(jsonRequest({ title: "t", body: "b", audience: "CAMPUS", campusId: "c2" }));
    expect(res.status).toBe(403);
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
});
