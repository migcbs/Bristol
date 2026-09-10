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
    (prisma.user.findUnique as any).mockResolvedValue({ staffPosition: null, extraModuleAccess: [] });
    const access = await hasModuleAccess({ id: "s1", role: "STAFF" as any }, "cobranzas");
    expect(access).toBe("none");
  });

  // 2026-09-09: Cobranzas is Caja's — Recepción only consults payment
  // status (downgraded from "initiate" to "read"). Lista de Espera is
  // Comercial's — Recepción lost it entirely (was "full").
  it("RECEPCION gets read on cobranzas, none on lista_espera and reinscripciones", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({ staffPosition: "RECEPCION", extraModuleAccess: [] });
    expect(await hasModuleAccess({ id: "s1", role: "STAFF" as any }, "cobranzas")).toBe("read");
    expect(await hasModuleAccess({ id: "s1", role: "STAFF" as any }, "lista_espera")).toBe("none");
    expect(await hasModuleAccess({ id: "s1", role: "STAFF" as any }, "reinscripciones")).toBe("none");
  });

  it("CAJA gets full on cobranzas, none on almost everything else", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({ staffPosition: "CAJA", extraModuleAccess: [] });
    expect(await hasModuleAccess({ id: "s1", role: "STAFF" as any }, "cobranzas")).toBe("full");
    expect(await hasModuleAccess({ id: "s1", role: "STAFF" as any }, "admisiones")).toBe("none");
    expect(await hasModuleAccess({ id: "s1", role: "STAFF" as any }, "tickets")).toBe("full");
  });

  it("CONTROL_ESCOLAR gets full on reinscripciones and solicitudes, none on cobranzas", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({ staffPosition: "CONTROL_ESCOLAR", extraModuleAccess: [] });
    expect(await hasModuleAccess({ id: "s1", role: "STAFF" as any }, "reinscripciones")).toBe("full");
    expect(await hasModuleAccess({ id: "s1", role: "STAFF" as any }, "solicitudes")).toBe("full");
    expect(await hasModuleAccess({ id: "s1", role: "STAFF" as any }, "cobranzas")).toBe("none");
  });

  it("COMERCIAL gets full on admisiones/mercadotecnia/comunicaciones, none on cobranzas/reinscripciones", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({ staffPosition: "COMERCIAL", extraModuleAccess: [] });
    expect(await hasModuleAccess({ id: "s1", role: "STAFF" as any }, "admisiones")).toBe("full");
    expect(await hasModuleAccess({ id: "s1", role: "STAFF" as any }, "mercadotecnia")).toBe("full");
    expect(await hasModuleAccess({ id: "s1", role: "STAFF" as any }, "cobranzas")).toBe("none");
  });

  // 2026-09-09: Cobranzas was downgraded to "none" for CALIDAD_CONTROL and
  // DIRECCION_CAMPUS — the user reported the "Cobranzas" nav pill still
  // showing on their screens, and the nav's visibility rule shows any
  // module with access != "none" (their prior "read" still counted).
  it("CALIDAD_CONTROL gets full on solicitudes/incidencias/comunicaciones, none on cobranzas", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({ staffPosition: "CALIDAD_CONTROL", extraModuleAccess: [] });
    expect(await hasModuleAccess({ id: "s1", role: "STAFF" as any }, "solicitudes")).toBe("full");
    expect(await hasModuleAccess({ id: "s1", role: "STAFF" as any }, "incidencias")).toBe("full");
    expect(await hasModuleAccess({ id: "s1", role: "STAFF" as any }, "cobranzas")).toBe("none");
  });

  it("DIRECCION_CAMPUS gets full on solicitudes/comunicaciones/alta_rapida, read on most other modules", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({ staffPosition: "DIRECCION_CAMPUS", extraModuleAccess: [] });
    expect(await hasModuleAccess({ id: "s1", role: "STAFF" as any }, "solicitudes")).toBe("full");
    expect(await hasModuleAccess({ id: "s1", role: "STAFF" as any }, "comunicaciones")).toBe("full");
    expect(await hasModuleAccess({ id: "s1", role: "STAFF" as any }, "alta_rapida")).toBe("full");
    expect(await hasModuleAccess({ id: "s1", role: "STAFF" as any }, "reinscripciones")).toBe("read");
    expect(await hasModuleAccess({ id: "s1", role: "STAFF" as any }, "cobranzas")).toBe("none");
  });

  // 2026-09-09: new "grupos" module for group creation and teacher/student
  // assignment — Dirección creates groups, Recepción only adds students.
  // 2026-09-09: Disponibilidad was removed (it duplicated Grupos' cupo
  // view) — COMERCIAL's "read" there was carried over to "grupos" so they
  // don't lose the ability to consult cupo.
  it("grupos: DIRECCION_CAMPUS full, RECEPCION initiate, COMERCIAL read, CAJA none", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({ staffPosition: "DIRECCION_CAMPUS", extraModuleAccess: [] });
    expect(await hasModuleAccess({ id: "s1", role: "STAFF" as any }, "grupos")).toBe("full");

    (prisma.user.findUnique as any).mockResolvedValue({ staffPosition: "RECEPCION", extraModuleAccess: [] });
    expect(await hasModuleAccess({ id: "s1", role: "STAFF" as any }, "grupos")).toBe("initiate");

    (prisma.user.findUnique as any).mockResolvedValue({ staffPosition: "CAJA", extraModuleAccess: [] });
    expect(await hasModuleAccess({ id: "s1", role: "STAFF" as any }, "grupos")).toBe("none");

    (prisma.user.findUnique as any).mockResolvedValue({ staffPosition: "COMERCIAL", extraModuleAccess: [] });
    expect(await hasModuleAccess({ id: "s1", role: "STAFF" as any }, "grupos")).toBe("read");
  });

  // 2026-09-09: recursos_caja/biblioteca_material/comercial_directorio were
  // split off from cobranzas/solicitudes/admisiones respectively, because
  // those shared gates were leaking cross-department visibility (e.g.
  // Recepción's "initiate" on cobranzas also surfacing Caja's inventory
  // tools). Each new module must NOT inherit the old module's access.
  it("RECEPCION has none on recursos_caja/biblioteca_material/comercial_directorio despite read/initiate on their old shared gates", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({ staffPosition: "RECEPCION", extraModuleAccess: [] });
    expect(await hasModuleAccess({ id: "s1", role: "STAFF" as any }, "recursos_caja")).toBe("none");
    expect(await hasModuleAccess({ id: "s1", role: "STAFF" as any }, "biblioteca_material")).toBe("none");
    expect(await hasModuleAccess({ id: "s1", role: "STAFF" as any }, "comercial_directorio")).toBe("none");
  });

  it("CAJA gets full on recursos_caja", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({ staffPosition: "CAJA", extraModuleAccess: [] });
    expect(await hasModuleAccess({ id: "s1", role: "STAFF" as any }, "recursos_caja")).toBe("full");
  });

  it("CONTROL_ESCOLAR gets full on biblioteca_material", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({ staffPosition: "CONTROL_ESCOLAR", extraModuleAccess: [] });
    expect(await hasModuleAccess({ id: "s1", role: "STAFF" as any }, "biblioteca_material")).toBe("full");
  });

  it("COMERCIAL gets full on comercial_directorio", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({ staffPosition: "COMERCIAL", extraModuleAccess: [] });
    expect(await hasModuleAccess({ id: "s1", role: "STAFF" as any }, "comercial_directorio")).toBe("full");
  });

  it("no puesto gets resenas by default, even ones with full comunicaciones", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({ staffPosition: "COMERCIAL", extraModuleAccess: [] });
    expect(await hasModuleAccess({ id: "s1", role: "STAFF" as any }, "resenas")).toBe("none");
  });

  it("extraModuleAccess grants full access to a module regardless of puesto", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({ staffPosition: "RECEPCION", extraModuleAccess: ["resenas"] });
    expect(await hasModuleAccess({ id: "s1", role: "STAFF" as any }, "resenas")).toBe("full");
    // unaffected modules still resolve from the puesto matrix
    expect(await hasModuleAccess({ id: "s1", role: "STAFF" as any }, "cobranzas")).toBe("read");
  });

  it("extraModuleAccess grants apply even with no staffPosition assigned", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({ staffPosition: null, extraModuleAccess: ["resenas"] });
    expect(await hasModuleAccess({ id: "s1", role: "STAFF" as any }, "resenas")).toBe("full");
  });
});
