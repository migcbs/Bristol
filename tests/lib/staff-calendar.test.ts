import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { user: { findUnique: vi.fn() } },
}));

import { prisma } from "@/lib/prisma";
import { getCalendarAccess, canWriteArea, CALENDAR_AREAS } from "@/lib/staff-calendar";

describe("getCalendarAccess", () => {
  beforeEach(() => vi.clearAllMocks());

  it("ADMIN sees and manages every área without a staffPosition query", async () => {
    const a = await getCalendarAccess({ id: "a1", role: "ADMIN" as any });
    expect(a.areas).toEqual(CALENDAR_AREAS);
    expect(a.canManageAll).toBe(true);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("a non-STAFF, non-ADMIN role gets no calendar access", async () => {
    const a = await getCalendarAccess({ id: "t1", role: "TEACHER" as any });
    expect(a.areas).toEqual([]);
    expect(a.canManageAll).toBe(false);
  });

  it("STAFF with no puesto gets nothing (fail-closed)", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({ staffPosition: null });
    const a = await getCalendarAccess({ id: "s1", role: "STAFF" as any });
    expect(a.areas).toEqual([]);
  });

  it("a regular puesto only sees and writes its own área", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({ staffPosition: "RECEPCION" });
    const a = await getCalendarAccess({ id: "s1", role: "STAFF" as any });
    expect(a.areas).toEqual(["RECEPCION"]);
    expect(a.canManageAll).toBe(false);
    expect(a.ownArea).toBe("RECEPCION");
    expect(canWriteArea(a, "RECEPCION")).toBe(true);
    expect(canWriteArea(a, "CAJA")).toBe(false);
  });

  it("Dirección de Campus oversees every área", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({ staffPosition: "DIRECCION_CAMPUS" });
    const a = await getCalendarAccess({ id: "d1", role: "STAFF" as any });
    expect(a.areas).toEqual(CALENDAR_AREAS);
    expect(a.canManageAll).toBe(true);
    expect(canWriteArea(a, "COMERCIAL")).toBe(true);
  });
});
