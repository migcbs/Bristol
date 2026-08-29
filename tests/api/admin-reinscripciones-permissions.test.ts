import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/campus-scope", () => ({ getCampusScope: vi.fn() }));
vi.mock("@/lib/staff-permissions", () => ({ hasModuleAccess: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { enrollment: { findUnique: vi.fn() }, group: { findUnique: vi.fn() } },
}));

import { auth } from "@/lib/auth";
import { hasModuleAccess } from "@/lib/staff-permissions";
import { POST } from "@/app/api/admin/reinscripciones/route";

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/admin/reinscripciones", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/admin/reinscripciones — module access", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 403 for a puesto without reinscripciones access", async () => {
    (auth as any).mockResolvedValue({ user: { id: "s1", role: "STAFF" } });
    (hasModuleAccess as any).mockResolvedValue("none");

    const res = await POST(jsonRequest({ enrollmentId: "e1", newGroupId: "g2" }));
    expect(res.status).toBe(403);
  });
});
