import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { user: { findUnique: vi.fn() } },
}));

import { prisma } from "@/lib/prisma";
import { hasModuleAccess } from "@/lib/staff-permissions";

describe("hasModuleAccess", () => {
  beforeEach(() => vi.clearAllMocks());

  it("ADMIN always gets full access, without querying staffPosition", async () => {
    const access = await hasModuleAccess({ id: "a1", role: "ADMIN" as any }, "cobranzas");
    expect(access).toBe("full");
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("a non-STAFF, non-ADMIN role always gets none", async () => {
    const access = await hasModuleAccess({ id: "t1", role: "TEACHER" as any }, "cobranzas");
    expect(access).toBe("none");
  });

  it("STAFF with no staffPosition gets none on every module (fail-closed)", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({ staffPosition: null });
    const access = await hasModuleAccess({ id: "s1", role: "STAFF" as any }, "cobranzas");
    expect(access).toBe("none");
  });

  it("RECEPCION gets initiate on cobranzas, full on lista_espera, none on reinscripciones", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({ staffPosition: "RECEPCION" });
    expect(await hasModuleAccess({ id: "s1", role: "STAFF" as any }, "cobranzas")).toBe("initiate");
    expect(await hasModuleAccess({ id: "s1", role: "STAFF" as any }, "lista_espera")).toBe("full");
    expect(await hasModuleAccess({ id: "s1", role: "STAFF" as any }, "reinscripciones")).toBe("none");
  });

  it("CAJA gets full on cobranzas, none on almost everything else", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({ staffPosition: "CAJA" });
    expect(await hasModuleAccess({ id: "s1", role: "STAFF" as any }, "cobranzas")).toBe("full");
    expect(await hasModuleAccess({ id: "s1", role: "STAFF" as any }, "admisiones")).toBe("none");
    expect(await hasModuleAccess({ id: "s1", role: "STAFF" as any }, "tickets")).toBe("full");
  });

  it("CONTROL_ESCOLAR gets full on reinscripciones and solicitudes, none on cobranzas", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({ staffPosition: "CONTROL_ESCOLAR" });
    expect(await hasModuleAccess({ id: "s1", role: "STAFF" as any }, "reinscripciones")).toBe("full");
    expect(await hasModuleAccess({ id: "s1", role: "STAFF" as any }, "solicitudes")).toBe("full");
    expect(await hasModuleAccess({ id: "s1", role: "STAFF" as any }, "cobranzas")).toBe("none");
  });

  it("COMERCIAL gets full on admisiones/mercadotecnia/comunicaciones, none on cobranzas/reinscripciones", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({ staffPosition: "COMERCIAL" });
    expect(await hasModuleAccess({ id: "s1", role: "STAFF" as any }, "admisiones")).toBe("full");
    expect(await hasModuleAccess({ id: "s1", role: "STAFF" as any }, "mercadotecnia")).toBe("full");
    expect(await hasModuleAccess({ id: "s1", role: "STAFF" as any }, "cobranzas")).toBe("none");
  });

  it("CALIDAD_CONTROL gets full on solicitudes/incidencias/comunicaciones, read on cobranzas", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({ staffPosition: "CALIDAD_CONTROL" });
    expect(await hasModuleAccess({ id: "s1", role: "STAFF" as any }, "solicitudes")).toBe("full");
    expect(await hasModuleAccess({ id: "s1", role: "STAFF" as any }, "incidencias")).toBe("full");
    expect(await hasModuleAccess({ id: "s1", role: "STAFF" as any }, "cobranzas")).toBe("read");
  });

  it("DIRECCION_CAMPUS gets full on solicitudes/comunicaciones/alta_rapida, read on most other modules", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({ staffPosition: "DIRECCION_CAMPUS" });
    expect(await hasModuleAccess({ id: "s1", role: "STAFF" as any }, "solicitudes")).toBe("full");
    expect(await hasModuleAccess({ id: "s1", role: "STAFF" as any }, "comunicaciones")).toBe("full");
    expect(await hasModuleAccess({ id: "s1", role: "STAFF" as any }, "alta_rapida")).toBe("full");
    expect(await hasModuleAccess({ id: "s1", role: "STAFF" as any }, "reinscripciones")).toBe("read");
  });
});
