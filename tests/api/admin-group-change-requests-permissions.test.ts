import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/campus-scope", () => ({ getCampusScope: vi.fn(), assertCampusInScope: vi.fn() }));
vi.mock("@/lib/staff-permissions", () => ({ hasModuleAccess: vi.fn() }));
vi.mock("@/lib/notifications", () => ({ notify: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { groupChangeRequest: { findUnique: vi.fn(), update: vi.fn() } },
}));

import { auth } from "@/lib/auth";
import { hasModuleAccess } from "@/lib/staff-permissions";
import { PATCH } from "@/app/api/admin/group-change-requests/[id]/route";

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/admin/group-change-requests/gcr1", {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("PATCH /api/admin/group-change-requests/[id] — module access", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 403 for a puesto without solicitudes approval access (e.g. RECEPCION, which can only initiate)", async () => {
    (auth as any).mockResolvedValue({ user: { id: "s1", role: "STAFF" } });
    (hasModuleAccess as any).mockResolvedValue("initiate");

    const res = await PATCH(jsonRequest({ decision: "APROBADA" }), makeParams("gcr1"));
    expect(res.status).toBe(403);
  });

  it("returns 403 when the puesto has no access at all", async () => {
    (auth as any).mockResolvedValue({ user: { id: "s1", role: "STAFF" } });
    (hasModuleAccess as any).mockResolvedValue("none");

    const res = await PATCH(jsonRequest({ decision: "APROBADA" }), makeParams("gcr1"));
    expect(res.status).toBe(403);
  });
});
