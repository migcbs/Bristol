import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/campus-scope", () => ({ assertCampusInScope: vi.fn() }));
vi.mock("@/lib/staff-permissions", () => ({ hasModuleAccess: vi.fn() }));
vi.mock("@/lib/password", () => ({ verifyPassword: vi.fn() }));
vi.mock("@/lib/notifications", () => ({ notify: vi.fn() }));
vi.mock("@/lib/validation", () => ({ isValidCurp: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    student: { findUnique: vi.fn() },
    user: { findUnique: vi.fn(), findMany: vi.fn(), delete: vi.fn() },
  },
}));

import { auth } from "@/lib/auth";
import { assertCampusInScope } from "@/lib/campus-scope";
import { hasModuleAccess } from "@/lib/staff-permissions";
import { verifyPassword } from "@/lib/password";
import { notify } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { DELETE } from "@/app/api/admin/students/[id]/route";

function req(body?: unknown) {
  return new Request("http://localhost/api/admin/students/s1", {
    method: "DELETE",
    body: body !== undefined ? JSON.stringify(body) : undefined,
    headers: { "Content-Type": "application/json" },
  });
}
function ctx(id = "s1") {
  return { params: Promise.resolve({ id }) };
}

const existingStudent = {
  id: "s1",
  campusId: "c1",
  user: { id: "u1", name: "Juan Pérez", email: "juan@example.com" },
};

describe("DELETE /api/admin/students/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 without a session", async () => {
    (auth as any).mockResolvedValue(null);
    const res = await DELETE(req(), ctx());
    expect(res.status).toBe(401);
  });

  it("returns 403 without full alta_rapida access", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1", role: "STAFF", name: "Recepción" } });
    (hasModuleAccess as any).mockResolvedValue("read");
    const res = await DELETE(req(), ctx());
    expect(res.status).toBe(403);
  });

  it("returns 404 for a student outside the caller's campus scope", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1", role: "STAFF", name: "Recepción" } });
    (hasModuleAccess as any).mockResolvedValue("full");
    (prisma.student.findUnique as any).mockResolvedValue(existingStudent);
    (assertCampusInScope as any).mockResolvedValue(false);

    const res = await DELETE(req({ adminEmail: "admin@x.com", adminPassword: "x" }), ctx());
    expect(res.status).toBe(404);
    expect(prisma.user.delete).not.toHaveBeenCalled();
  });

  it("ADMIN deletes directly without needing a password", async () => {
    (auth as any).mockResolvedValue({ user: { id: "a1", role: "ADMIN", name: "Admin Bristol" } });
    (hasModuleAccess as any).mockResolvedValue("full");
    (prisma.student.findUnique as any).mockResolvedValue(existingStudent);
    (prisma.user.delete as any).mockResolvedValue({});
    (prisma.user.findMany as any).mockResolvedValue([{ id: "a1" }]);

    const res = await DELETE(req(), ctx());
    expect(res.status).toBe(200);
    expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: "u1" } });
    expect(notify).toHaveBeenCalledWith("a1", expect.stringContaining("Juan Pérez"));
  });

  it("STAFF (non-admin) is rejected without admin credentials in the body", async () => {
    (auth as any).mockResolvedValue({ user: { id: "s1", role: "STAFF", name: "Recepción" } });
    (hasModuleAccess as any).mockResolvedValue("full");
    (prisma.student.findUnique as any).mockResolvedValue(existingStudent);
    (assertCampusInScope as any).mockResolvedValue(true);

    const res = await DELETE(req({}), ctx());
    expect(res.status).toBe(400);
    expect(prisma.user.delete).not.toHaveBeenCalled();
  });

  it("STAFF is rejected when the provided admin credentials don't verify", async () => {
    (auth as any).mockResolvedValue({ user: { id: "s1", role: "STAFF", name: "Recepción" } });
    (hasModuleAccess as any).mockResolvedValue("full");
    (prisma.student.findUnique as any).mockResolvedValue(existingStudent);
    (assertCampusInScope as any).mockResolvedValue(true);
    (prisma.user.findUnique as any).mockResolvedValue({ role: "ADMIN", passwordHash: "hash" });
    (verifyPassword as any).mockResolvedValue(false);

    const res = await DELETE(req({ adminEmail: "admin@x.com", adminPassword: "wrong" }), ctx());
    expect(res.status).toBe(403);
    expect(prisma.user.delete).not.toHaveBeenCalled();
  });

  it("STAFF is rejected when the provided email belongs to a non-ADMIN account", async () => {
    (auth as any).mockResolvedValue({ user: { id: "s1", role: "STAFF", name: "Recepción" } });
    (hasModuleAccess as any).mockResolvedValue("full");
    (prisma.student.findUnique as any).mockResolvedValue(existingStudent);
    (assertCampusInScope as any).mockResolvedValue(true);
    (prisma.user.findUnique as any).mockResolvedValue({ role: "STAFF", passwordHash: "hash" });

    const res = await DELETE(req({ adminEmail: "notadmin@x.com", adminPassword: "x" }), ctx());
    expect(res.status).toBe(403);
    expect(prisma.user.delete).not.toHaveBeenCalled();
  });

  it("STAFF succeeds with valid admin credentials, and the notification credits the approving admin", async () => {
    (auth as any).mockResolvedValue({ user: { id: "s1", role: "STAFF", name: "Recepción Coatepec" } });
    (hasModuleAccess as any).mockResolvedValue("full");
    (prisma.student.findUnique as any).mockResolvedValue(existingStudent);
    (assertCampusInScope as any).mockResolvedValue(true);
    (prisma.user.findUnique as any).mockResolvedValue({ role: "ADMIN", passwordHash: "hash", name: "Admin Bristol" });
    (verifyPassword as any).mockResolvedValue(true);
    (prisma.user.delete as any).mockResolvedValue({});
    (prisma.user.findMany as any).mockResolvedValue([{ id: "a1" }]);

    const res = await DELETE(req({ adminEmail: "admin@x.com", adminPassword: "correct" }), ctx());
    expect(res.status).toBe(200);
    expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: "u1" } });
    expect(notify).toHaveBeenCalledWith(
      "a1",
      expect.stringContaining("aprobado por Admin Bristol")
    );
  });
});
