# Bristol Roles y Permisos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce `StaffPosition` (Recepción/Caja/Control Escolar/Comercial/Calidad y Control/Dirección de Campus) as a second permission layer on top of the existing `Role` enum, filter the admin nav accordingly, enforce it on the three highest-risk write paths (Cobranzas, Reinscripciones, group-change-request approval), fix the minor-student payment gap, and reseed one demo account per puesto.

**Architecture:** `Role` (ADMIN/STAFF/TEACHER/STUDENT/PARENT) is unchanged — it still gates `/admin` vs `/portal` and drives `getCampusScope`. `StaffPosition` is a new, nullable field on `User`, populated only for `STAFF` accounts, consumed by a new `hasModuleAccess(user, module)` helper that mirrors the fail-closed pattern already established by `getCampusScope`/`leadScopeWhere`/`assertCampusInScope`. See `docs/superpowers/specs/2026-08-29-roles-permissions-design.md` for the full matrix and the confirmed decisions (matrix approved as-is; missing birthdate = treated as minor).

**Tech Stack:** Next.js 16 (App Router), Prisma/PostgreSQL, Vitest.

## Global Constraints

- Node ≥22 required — prepend node 22's bin dir to `PATH` before any npm/npx command.
- This repo lives on a network volume that spawns `._<filename>` AppleDouble junk files on write (gitignored); clean with `find . -name "._*" -not -path "./node_modules/*" -not -path "./.git/*" -delete` before build/test.
- Any schema migration that requires a destructive `prisma migrate reset` MUST get the human's explicit, real-time consent first — if `prisma migrate dev` refuses to run non-interactively, STOP and report `NEEDS_CONTEXT`; the controller session obtains consent and runs the reset, never the implementer. This plan's migration (one new enum, one new nullable column) is expected to be purely additive and should not require this.
- `hasModuleAccess` does NOT touch `session`/JWT — it takes `{ id, role }` and queries `staffPosition` from Prisma directly (mirroring `getCampusScope`'s own pattern), to avoid any change to the authentication/session plumbing reviewed carefully in the Foundation spec.
- `ADMIN` always gets `"full"` on every module, regardless of `staffPosition` (which `ADMIN` never has). A `STAFF` user with `staffPosition: null` gets `"none"` on every module (fail-closed — matches this project's established default for every other scoping helper).
- Every task must leave `npm run build`, `npm test`, and `npx tsc --noEmit` passing.

---

## File Structure

```
prisma/
  schema.prisma                       # + StaffPosition enum, User.staffPosition
prisma/seed.ts                        # MODIFY: one account per puesto, menor/adulto students
README.md                             # MODIFY: seeded account table
src/
  lib/
    staff-permissions.ts                  # NEW: hasModuleAccess()
  components/
    admin/
      admin-nav.tsx                       # MODIFY: filter MODULES by hasModuleAccess
  app/
    admin/
      layout.tsx                          # MODIFY: pass staffPosition-derived access to AdminNav, gate QuickCreateDrawer
      cobranzas/
        page.tsx                          # MODIFY: redirect if module access is "none"
      reinscripciones/
        page.tsx                          # MODIFY: redirect if module access is "none"
    api/
      admin/
        invoices/
          route.ts                        # MODIFY: gate POST by module access
        reinscripciones/
          route.ts                        # MODIFY: gate POST by module access
        group-change-requests/
          [id]/
            route.ts                      # MODIFY: gate approval by module access
      invoices/
        [id]/
          checkout/
            route.ts                      # MODIFY: block minor STUDENT payment
    portal/
      cobranzas/
        page.tsx                          # MODIFY: hide PayButton for minor STUDENT
tests/
  lib/
    staff-permissions.test.ts
  api/
    admin-invoices-permissions.test.ts
    admin-reinscripciones-permissions.test.ts
    admin-group-change-requests-permissions.test.ts
    invoices-checkout-age.test.ts
```

---

### Task 1: Schema — StaffPosition enum and User.staffPosition

**Files:**
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Produces: `StaffPosition` enum, `User.staffPosition` — consumed by every later task.

- [ ] **Step 1: Add the enum and field**

```prisma
enum StaffPosition {
  RECEPCION
  CAJA
  CONTROL_ESCOLAR
  COMERCIAL
  CALIDAD_CONTROL
  DIRECCION_CAMPUS
}
```

Add to the existing `User` model: `staffPosition StaffPosition?` (nullable — only meaningful when `role = STAFF`; `ADMIN`/`TEACHER`/`STUDENT`/`PARENT` never set it).

- [ ] **Step 2: Run the migration**

Run: `npx prisma migrate dev --name add_staff_position`. This is purely additive (new enum, new nullable column) and should not require a reset. If it does, STOP and report `NEEDS_CONTEXT` per Global Constraints.

- [ ] **Step 3: Verify**

Run: `npx prisma format --check` (fix with `npx prisma format` if needed), `npx prisma migrate status` (no drift), then `npx tsc --noEmit` (generate `.next/types` via `npx next typegen` first if `tsc` only complains about `LayoutProps<"/">` — never edit that file).

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat: add StaffPosition enum and User.staffPosition field"
```

---

### Task 2: hasModuleAccess() helper

**Files:**
- Create: `src/lib/staff-permissions.ts`
- Test: `tests/lib/staff-permissions.test.ts`

**Interfaces:**
- Produces: `Module` type, `AccessLevel` type, `hasModuleAccess(user, module): Promise<AccessLevel>` — consumed by every later task.

- [ ] **Step 1: Write the failing tests**

`tests/lib/staff-permissions.test.ts`:
```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/lib/staff-permissions.test.ts`
Expected: FAIL — module doesn't exist yet.

- [ ] **Step 3: Implement**

`src/lib/staff-permissions.ts`:
```ts
import { prisma } from "@/lib/prisma";
import type { Role, StaffPosition } from "@prisma/client";

export type Module =
  | "busqueda"
  | "alta_rapida"
  | "lista_espera"
  | "agenda"
  | "bitacora"
  | "admisiones"
  | "mercadotecnia"
  | "cobranzas"
  | "disponibilidad"
  | "reinscripciones"
  | "solicitudes"
  | "incidencias"
  | "calificaciones_bloque"
  | "comunicaciones"
  | "tickets";

export type AccessLevel = "full" | "read" | "initiate" | "none";

/**
 * The full matrix from docs/superpowers/specs/2026-08-29-roles-permissions-design.md,
 * confirmed with the user on 2026-08-29. ADMIN and a STAFF user with no
 * staffPosition are handled separately in hasModuleAccess() below — this
 * table only covers the six real puestos.
 */
const MODULE_ACCESS: Record<StaffPosition, Record<Module, AccessLevel>> = {
  RECEPCION: {
    busqueda: "full",
    alta_rapida: "full",
    lista_espera: "full",
    agenda: "full",
    bitacora: "full",
    admisiones: "read",
    mercadotecnia: "none",
    cobranzas: "initiate",
    disponibilidad: "full",
    reinscripciones: "none",
    solicitudes: "initiate",
    incidencias: "read",
    calificaciones_bloque: "none",
    comunicaciones: "read",
    tickets: "full",
  },
  CAJA: {
    busqueda: "full",
    alta_rapida: "none",
    lista_espera: "none",
    agenda: "none",
    bitacora: "none",
    admisiones: "none",
    mercadotecnia: "none",
    cobranzas: "full",
    disponibilidad: "none",
    reinscripciones: "none",
    solicitudes: "none",
    incidencias: "none",
    calificaciones_bloque: "none",
    comunicaciones: "none",
    tickets: "full",
  },
  CONTROL_ESCOLAR: {
    busqueda: "full",
    alta_rapida: "none",
    lista_espera: "none",
    agenda: "none",
    bitacora: "none",
    admisiones: "none",
    mercadotecnia: "none",
    cobranzas: "none",
    disponibilidad: "full",
    reinscripciones: "full",
    solicitudes: "full",
    incidencias: "read",
    calificaciones_bloque: "full",
    comunicaciones: "none",
    tickets: "full",
  },
  COMERCIAL: {
    busqueda: "full",
    alta_rapida: "none",
    lista_espera: "full",
    agenda: "full",
    bitacora: "none",
    admisiones: "full",
    mercadotecnia: "full",
    cobranzas: "none",
    disponibilidad: "read",
    reinscripciones: "none",
    solicitudes: "none",
    incidencias: "none",
    calificaciones_bloque: "none",
    comunicaciones: "full",
    tickets: "full",
  },
  CALIDAD_CONTROL: {
    busqueda: "full",
    alta_rapida: "none",
    lista_espera: "none",
    agenda: "none",
    bitacora: "read",
    admisiones: "read",
    mercadotecnia: "read",
    cobranzas: "read",
    disponibilidad: "none",
    reinscripciones: "read",
    solicitudes: "full",
    incidencias: "full",
    calificaciones_bloque: "read",
    comunicaciones: "full",
    tickets: "full",
  },
  DIRECCION_CAMPUS: {
    busqueda: "full",
    alta_rapida: "full",
    lista_espera: "read",
    agenda: "read",
    bitacora: "full",
    admisiones: "full",
    mercadotecnia: "full",
    cobranzas: "read",
    disponibilidad: "read",
    reinscripciones: "read",
    solicitudes: "full",
    incidencias: "read",
    calificaciones_bloque: "read",
    comunicaciones: "full",
    tickets: "full",
  },
};

/**
 * Fail-closed module access check for the admin panel. ADMIN always gets
 * "full" without a DB round-trip. Any other role (TEACHER/STUDENT/PARENT)
 * gets "none" — this function is only meaningful for the admin panel.
 * A STAFF user with no staffPosition assigned gets "none" on everything,
 * same fail-closed default as getCampusScope/leadScopeWhere elsewhere in
 * this codebase, until Dirección de Campus assigns them a puesto.
 */
export async function hasModuleAccess(
  user: { id: string; role: Role },
  module: Module
): Promise<AccessLevel> {
  if (user.role === "ADMIN") return "full";
  if (user.role !== "STAFF") return "none";

  const staffUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { staffPosition: true },
  });
  if (!staffUser?.staffPosition) return "none";

  return MODULE_ACCESS[staffUser.staffPosition][module];
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/lib/staff-permissions.test.ts`
Expected: PASS (all cases)

- [ ] **Step 5: Commit**

```bash
git add src/lib/staff-permissions.ts tests/lib/staff-permissions.test.ts
git commit -m "feat: add hasModuleAccess() staff-position permission helper"
```

---

### Task 3: Filter AdminNav and QuickCreateDrawer by module access

**Files:**
- Modify: `src/components/admin/admin-nav.tsx`
- Modify: `src/app/admin/layout.tsx`

**Interfaces:**
- Consumes: `hasModuleAccess` (Task 2).
- Produces: an `AdminNav` that only renders links a STAFF user's puesto actually grants; the "+ Nuevo alumno" drawer only rendered when `alta_rapida !== "none"`.

- [ ] **Step 1: Read the current files in full**

Read `src/components/admin/admin-nav.tsx` and `src/app/admin/layout.tsx` (both shown in full in this conversation's context) before editing.

- [ ] **Step 2: Make AdminNav accept a visibility set**

Modify `src/components/admin/admin-nav.tsx` to accept a prop and filter:
```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";

const MODULES = [
  { href: "/admin/admisiones", label: "Admisiones", module: "admisiones" },
  { href: "/admin/cobranzas", label: "Cobranzas", module: "cobranzas" },
  { href: "/admin/reinscripciones", label: "Reinscripciones", module: "reinscripciones" },
  { href: "/admin/incidencias", label: "Incidencias", module: "incidencias" },
  { href: "/admin/comunicaciones", label: "Comunicaciones", module: "comunicaciones" },
  { href: "/admin/mercadotecnia", label: "Mercadotecnia", module: "mercadotecnia" },
  { href: "/admin/recepcion/lista-espera", label: "Lista de Espera", module: "lista_espera" },
  { href: "/admin/recepcion/agenda", label: "Agenda", module: "agenda" },
  { href: "/admin/recepcion/bitacora", label: "Bitácora", module: "bitacora" },
  { href: "/admin/recepcion/grupos-disponibilidad", label: "Disponibilidad", module: "disponibilidad" },
  { href: "/admin/control-escolar/solicitudes", label: "Solicitudes", module: "solicitudes" },
  { href: "/admin/tickets", label: "Tickets", module: "tickets" },
] as const;

export function AdminNav({ visibleModules }: { visibleModules: Set<string> }) {
  const pathname = usePathname();
  const visible = MODULES.filter((mod) => visibleModules.has(mod.module));

  return (
    <nav className="flex gap-4 border-b border-border px-6 py-2 text-sm font-medium">
      {visible.map((mod) => (
        <Link
          key={mod.href}
          href={mod.href}
          className={clsx(
            "rounded-md px-3 py-1.5 transition-colors",
            pathname.startsWith(mod.href)
              ? "bg-primary text-primary-foreground"
              : "text-muted hover:bg-surface hover:text-primary"
          )}
        >
          {mod.label}
        </Link>
      ))}
    </nav>
  );
}
```

- [ ] **Step 3: Compute `visibleModules` in the layout and gate the drawer**

Modify `src/app/admin/layout.tsx` to compute, alongside the existing `scope`/`campuses` fetch:
```tsx
import { hasModuleAccess, type Module } from "@/lib/staff-permissions";

// ...inside AdminLayout, after `const scope = ...`:

const ALL_MODULES: Module[] = [
  "admisiones", "cobranzas", "reinscripciones", "incidencias", "comunicaciones",
  "mercadotecnia", "lista_espera", "agenda", "bitacora", "disponibilidad",
  "solicitudes", "tickets", "alta_rapida",
];

const accessEntries = session?.user
  ? await Promise.all(
      ALL_MODULES.map(async (m) => [m, await hasModuleAccess(session.user as { id: string; role: any }, m)] as const)
    )
  : [];
const accessMap = new Map(accessEntries);
const visibleModules = new Set(
  [...accessMap.entries()].filter(([, level]) => level !== "none").map(([m]) => m)
);
const canQuickCreate = accessMap.get("alta_rapida") !== "none";
```
Pass `<AdminNav visibleModules={visibleModules} />` (replacing the old bare `<AdminNav />`), and wrap `<QuickCreateDrawer campuses={campuses} />` in `{canQuickCreate && (...)}`.

Note: `Promise.all` over 13 sequential-looking `hasModuleAccess` calls each does its own `prisma.user.findUnique` — for `ADMIN` this is free (short-circuits before any query per Task 2's implementation), and for a `STAFF` user it's 13 identical queries fired in parallel via `Promise.all`, not 13 sequential round-trips, so this is acceptable for a first version; do not attempt to optimize this into a single query in this task — that's a reasonable future refinement, not required now.

- [ ] **Step 4: Verify it builds**

Run: kill any running `next dev` (`pgrep -f "next dev" | xargs -r kill`), `rm -rf .next`, then `npm run build`. Confirm every existing `/admin/*` page still compiles (this layout change affects all of them).

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/admin-nav.tsx src/app/admin/layout.tsx
git commit -m "feat: filter admin nav and quick-create drawer by staff position"
```

---

### Task 4: Gate Cobranzas by module access

**Files:**
- Modify: `src/app/admin/cobranzas/page.tsx`
- Modify: `src/app/api/admin/invoices/route.ts`
- Test: `tests/api/admin-invoices-permissions.test.ts`

**Interfaces:**
- Consumes: `hasModuleAccess` (Task 2).
- Produces: Cobranzas becomes unreachable (page redirects, POST/GET 403) for `CONTROL_ESCOLAR`/`COMERCIAL`, and `RECEPCION` can `POST` but the page still renders for them (since `"initiate"` isn't `"none"`) — this task does NOT restrict `RECEPCION` to only the existing `from-reception` endpoint; it only blocks the two puestos with `"none"`. Restricting `RECEPCION`'s access to the general `/admin/cobranzas` page (vs. only `POST /api/admin/invoices/from-reception`) is a UX refinement left for a future pass — the design spec's matrix cell for Recepción/Cobranzas is `"initiate"`, and this task treats `"initiate"` the same as `"full"` for read/page-access purposes (RECEPCION can still see and use the general invoice-creation form), differing from `CAJA`/`ADMIN`'s `"full"` only in intent, not in enforced behavior — document this explicitly as a known simplification, not a silent gap.

- [ ] **Step 1: Write the failing tests**

`tests/api/admin-invoices-permissions.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/campus-scope", () => ({ getCampusScope: vi.fn() }));
vi.mock("@/lib/staff-permissions", () => ({ hasModuleAccess: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { student: { findUnique: vi.fn() }, invoice: { create: vi.fn(), findMany: vi.fn() } },
}));

import { auth } from "@/lib/auth";
import { hasModuleAccess } from "@/lib/staff-permissions";
import { POST, GET } from "@/app/api/admin/invoices/route";

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/admin/invoices", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/admin/invoices — module access", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 403 when the caller's puesto has no cobranzas access", async () => {
    (auth as any).mockResolvedValue({ user: { id: "s1", role: "STAFF" } });
    (hasModuleAccess as any).mockResolvedValue("none");

    const res = await POST(jsonRequest({ studentId: "st1", description: "x", amountCents: 1000, dueDate: "2026-09-01" }));
    expect(res.status).toBe(403);
  });

  it("allows a puesto with initiate access to create an invoice", async () => {
    (auth as any).mockResolvedValue({ user: { id: "s1", role: "STAFF" } });
    (hasModuleAccess as any).mockResolvedValue("initiate");
    const { prisma } = await import("@/lib/prisma");
    (prisma.student.findUnique as any).mockResolvedValue({ id: "st1", campusId: "c1" });
    const { getCampusScope } = await import("@/lib/campus-scope");
    (getCampusScope as any).mockResolvedValue({ type: "ALL" });
    (prisma.invoice.create as any).mockResolvedValue({ id: "inv1" });

    const res = await POST(jsonRequest({ studentId: "st1", description: "x", amountCents: 1000, dueDate: "2026-09-01" }));
    expect(res.status).toBe(201);
  });
});

describe("GET /api/admin/invoices — module access", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 403 when the caller's puesto has no cobranzas access (not even read)", async () => {
    (auth as any).mockResolvedValue({ user: { id: "s1", role: "STAFF" } });
    (hasModuleAccess as any).mockResolvedValue("none");

    const res = await GET(new Request("http://localhost"));
    expect(res.status).toBe(403);
  });

  it("allows read-only access", async () => {
    (auth as any).mockResolvedValue({ user: { id: "s1", role: "STAFF" } });
    (hasModuleAccess as any).mockResolvedValue("read");
    const { prisma } = await import("@/lib/prisma");
    (prisma.invoice.findMany as any).mockResolvedValue([]);
    const { getCampusScope } = await import("@/lib/campus-scope");
    (getCampusScope as any).mockResolvedValue({ type: "ALL" });

    const res = await GET(new Request("http://localhost"));
    expect(res.status).toBe(200);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/api/admin-invoices-permissions.test.ts`
Expected: FAIL — `hasModuleAccess` not yet wired into this route.

- [ ] **Step 3: Implement — API route**

In `src/app/api/admin/invoices/route.ts`, import `hasModuleAccess` from `@/lib/staff-permissions`. In both `POST` and `GET`, after the existing `assertAdminOrStaff` check, add:
```ts
const access = await hasModuleAccess(session.user as { id: string; role: any }, "cobranzas");
if (access === "none") {
  return Response.json({ error: "No autorizado" }, { status: 403 });
}
```
(`GET`'s existing `assertAdminOrStaff` check already covers the "must be ADMIN or STAFF" gate — this new check is layered on top, specific to the puesto.)

- [ ] **Step 4: Implement — admin page**

In `src/app/admin/cobranzas/page.tsx`, after the existing `role !== "ADMIN" && role !== "STAFF"` redirect, add:
```tsx
const access = await hasModuleAccess(session.user as { id: string; role: any }, "cobranzas");
if (access === "none") redirect("/admin");
```
(Import `hasModuleAccess` from `@/lib/staff-permissions`. Redirecting to `/admin` rather than `/portal` since the caller IS admin-panel-eligible, just not for this specific module — check whether `/admin` as a bare route renders anything sensible in this codebase first; if it doesn't exist or redirects elsewhere, use `/admin/tickets` instead, since Tickets is the one module every puesto has full access to.)

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- tests/api/admin-invoices-permissions.test.ts`
Expected: PASS (4 tests). Also run the full suite to confirm the pre-existing `tests/api/admin-invoices*.test.ts` (if any) still pass, since you're modifying an existing route — they likely don't mock `hasModuleAccess`, so it needs to be added to their mocks too if they break; if so, add exactly the one `vi.mock("@/lib/staff-permissions", () => ({ hasModuleAccess: vi.fn().mockResolvedValue("full") }))` line to any pre-existing test file for this route that breaks, defaulting the mock to `"full"` so existing test cases keep their original meaning.

- [ ] **Step 6: Commit**

```bash
git add src/app/admin/cobranzas src/app/api/admin/invoices tests/api/admin-invoices-permissions.test.ts
git commit -m "feat: gate Cobranzas by staff-position module access"
```

---

### Task 5: Gate Reinscripciones and group-change-request approval by module access

**Files:**
- Modify: `src/app/admin/reinscripciones/page.tsx`
- Modify: `src/app/api/admin/reinscripciones/route.ts`
- Modify: `src/app/api/admin/group-change-requests/[id]/route.ts`
- Test: `tests/api/admin-reinscripciones-permissions.test.ts`
- Test: `tests/api/admin-group-change-requests-permissions.test.ts`

**Interfaces:**
- Consumes: `hasModuleAccess` (Task 2).
- Produces: Reinscripciones restricted to `CONTROL_ESCOLAR` (and `ADMIN`); group-change-request approval restricted to `CONTROL_ESCOLAR`/`CALIDAD_CONTROL`/`DIRECCION_CAMPUS` (and `ADMIN`).

- [ ] **Step 1: Write the failing tests**

`tests/api/admin-reinscripciones-permissions.test.ts`:
```ts
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
```

`tests/api/admin-group-change-requests-permissions.test.ts`:
```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/api/admin-reinscripciones-permissions.test.ts tests/api/admin-group-change-requests-permissions.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement — Reinscripciones**

In `src/app/api/admin/reinscripciones/route.ts`, after the existing role check, add the same `hasModuleAccess(..., "reinscripciones")` guard pattern as Task 4 (403 if `"none"`; here, only `"full"` should proceed since no cell in the matrix grants a lesser level for reinscripciones's WRITE action specifically — treat both `"none"` and `"read"` as insufficient for this POST, returning 403 unless the access level is `"full"`). In `src/app/admin/reinscripciones/page.tsx`, after the existing redirect, add: `if (access === "none") redirect("/admin/tickets")` (page-level gate only needs to hide the page from puestos with zero access — a `"read"` puesto, per the matrix, is allowed to at least see the page even though they can't submit the re-enrollment form; do not redirect on `"read"`).

- [ ] **Step 4: Implement — group-change-request approval**

Read `src/app/api/admin/group-change-requests/[id]/route.ts` in full (already merged, exports `reviewGroupChangeRequest`) before editing. Add the `hasModuleAccess(..., "solicitudes")` check inside `reviewGroupChangeRequest`, requiring `"full"` (both `RECEPCION`'s `"initiate"` and any `"none"`/`"read"` puesto must be rejected with 403), placed after the existing campus-scope check (Task 8 of Spec 4b) and before the `status !== "PENDIENTE"` check — so a caller without approval rights is rejected before any business-logic branching, consistent with this function's existing check ordering.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- tests/api/admin-reinscripciones-permissions.test.ts tests/api/admin-group-change-requests-permissions.test.ts`. Then run the FULL suite — this task modifies `reviewGroupChangeRequest`, which is covered by an extensive pre-existing test file (`tests/api/admin-group-change-requests-patch.test.ts`); add `vi.mock("@/lib/staff-permissions", () => ({ hasModuleAccess: vi.fn().mockResolvedValue("full") }))` to that file's existing mocks if it breaks, so its existing test cases keep passing with the new check defaulted to "allowed."

- [ ] **Step 6: Commit**

```bash
git add src/app/admin/reinscripciones src/app/api/admin/reinscripciones src/app/api/admin/group-change-requests tests/api/admin-reinscripciones-permissions.test.ts tests/api/admin-group-change-requests-permissions.test.ts
git commit -m "feat: gate Reinscripciones and group-change-request approval by staff-position access"
```

---

### Task 6: Block payment for a minor STUDENT (no verified tutor payment)

**Files:**
- Modify: `src/app/api/invoices/[id]/checkout/route.ts`
- Modify: `src/app/portal/cobranzas/page.tsx`
- Test: `tests/api/invoices-checkout-age.test.ts`

**Interfaces:**
- Consumes: `computeAgeBracket` (already exists, Spec 4a).
- Produces: `POST /api/invoices/[id]/checkout` rejects a `STUDENT` caller who is not a verified adult; the "Pagar" button is hidden for that same case on the portal page (defense in depth: UI hides it, API independently enforces it).

- [ ] **Step 1: Write the failing tests**

`tests/api/invoices-checkout-age.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/invoice-scope", () => ({ getVisibleStudentIds: vi.fn() }));
vi.mock("@/lib/stripe", () => ({ stripe: { checkout: { sessions: { create: vi.fn() } } } }));
vi.mock("@/lib/prisma", () => ({
  prisma: { invoice: { findUnique: vi.fn(), update: vi.fn() }, student: { findUnique: vi.fn() } },
}));

import { auth } from "@/lib/auth";
import { getVisibleStudentIds } from "@/lib/invoice-scope";
import { prisma } from "@/lib/prisma";
import { POST } from "@/app/api/invoices/[id]/checkout/route";

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("POST /api/invoices/[id]/checkout — age restriction", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 403 when a minor STUDENT (fechaNacimiento makes them under 18) tries to pay", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1", role: "STUDENT" } });
    (prisma.invoice.findUnique as any).mockResolvedValue({
      id: "inv1",
      studentId: "st1",
      status: "PENDING",
      description: "x",
      amountCents: 1000,
    });
    (getVisibleStudentIds as any).mockResolvedValue(["st1"]);
    (prisma.student.findUnique as any).mockResolvedValue({
      id: "st1",
      fechaNacimiento: new Date("2015-01-01"), // clearly a minor
    });

    const res = await POST(new Request("http://localhost", { method: "POST" }), makeParams("inv1"));
    expect(res.status).toBe(403);
  });

  it("returns 403 when a STUDENT's fechaNacimiento is null (cannot verify adulthood, treated as minor)", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1", role: "STUDENT" } });
    (prisma.invoice.findUnique as any).mockResolvedValue({
      id: "inv1",
      studentId: "st1",
      status: "PENDING",
      description: "x",
      amountCents: 1000,
    });
    (getVisibleStudentIds as any).mockResolvedValue(["st1"]);
    (prisma.student.findUnique as any).mockResolvedValue({ id: "st1", fechaNacimiento: null });

    const res = await POST(new Request("http://localhost", { method: "POST" }), makeParams("inv1"));
    expect(res.status).toBe(403);
  });

  it("allows an adult STUDENT to pay", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1", role: "STUDENT" } });
    (prisma.invoice.findUnique as any).mockResolvedValue({
      id: "inv1",
      studentId: "st1",
      status: "PENDING",
      description: "x",
      amountCents: 1000,
    });
    (getVisibleStudentIds as any).mockResolvedValue(["st1"]);
    (prisma.student.findUnique as any).mockResolvedValue({
      id: "st1",
      fechaNacimiento: new Date("1990-01-01"),
    });
    const { stripe } = await import("@/lib/stripe");
    (stripe.checkout.sessions.create as any).mockResolvedValue({ id: "cs1", url: "https://stripe.example/pay" });

    const res = await POST(new Request("http://localhost", { method: "POST" }), makeParams("inv1"));
    expect(res.status).toBe(200);
  });

  it("always allows a PARENT to pay, regardless of the linked student's age", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1", role: "PARENT" } });
    (prisma.invoice.findUnique as any).mockResolvedValue({
      id: "inv1",
      studentId: "st1",
      status: "PENDING",
      description: "x",
      amountCents: 1000,
    });
    (getVisibleStudentIds as any).mockResolvedValue(["st1"]);
    const { stripe } = await import("@/lib/stripe");
    (stripe.checkout.sessions.create as any).mockResolvedValue({ id: "cs1", url: "https://stripe.example/pay" });

    const res = await POST(new Request("http://localhost", { method: "POST" }), makeParams("inv1"));
    expect(res.status).toBe(200);
    expect(prisma.student.findUnique).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/api/invoices-checkout-age.test.ts`
Expected: FAIL — the route doesn't yet check age.

- [ ] **Step 3: Implement — checkout route**

In `src/app/api/invoices/[id]/checkout/route.ts`, after the existing `studentIds.includes(invoice.studentId)` scope check and before the `invoice.status === "PAID" || "CANCELED"` check, add:
```ts
if ((session.user as { role: string }).role === "STUDENT") {
  const student = await prisma.student.findUnique({ where: { id: invoice.studentId } });
  const isAdult = student?.fechaNacimiento
    ? computeAgeBracket(student.fechaNacimiento) === "ADULTO"
    : false; // missing birthdate = treated as minor, per the confirmed decision
  if (!isAdult) {
    return Response.json(
      { error: "Un alumno menor de edad no puede pagar directamente; el pago debe hacerlo su padre o tutor." },
      { status: 403 }
    );
  }
}
```
Import `computeAgeBracket` from `@/lib/age-bracket`. `PARENT` callers skip this block entirely (the `if` only triggers for `role === "STUDENT"`), matching the design decision that a tutor can always pay regardless of the child's age.

- [ ] **Step 4: Implement — portal page (defense in depth, hide the button)**

In `src/app/portal/cobranzas/page.tsx`, after computing `studentIds`, add a lookup: if `(session.user as { role: string }).role === "STUDENT"`, fetch the caller's own `Student.fechaNacimiento` and compute `canPay = fechaNacimiento ? computeAgeBracket(fechaNacimiento) === "ADULTO" : false`; for `PARENT`, `canPay = true` unconditionally. Wrap the existing `<PayButton invoiceId={invoice.id} />` render in `{canPay && (...)}` — when `!canPay`, show a small note instead (e.g. "El pago debe realizarlo tu padre o tutor.").

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- tests/api/invoices-checkout-age.test.ts`
Expected: PASS (4 tests). Run the full suite too, since `tests/api/invoices-checkout.test.ts` (if it exists from Spec 2b) may need `prisma.student.findUnique` added to its mocks for its PARENT-role test cases to keep passing unaffected (PARENT skips the new block entirely, so existing PARENT-path assertions should be unaffected, but STUDENT-path pre-existing tests, if any, may need a `student.findUnique` mock added — add the minimal mock, do not change any existing assertion).

- [ ] **Step 6: Commit**

```bash
git add src/app/api/invoices src/app/portal/cobranzas tests/api/invoices-checkout-age.test.ts
git commit -m "feat: block invoice payment for a minor STUDENT without a verified adult age"
```

---

### Task 7: Seed accounts per puesto, menor/adulto student demos

**Files:**
- Modify: `prisma/seed.ts`
- Modify: `README.md`

**Interfaces:**
- Produces: one seeded `STAFF` account per `StaffPosition`, one minor `STUDENT` (with a linked `PARENT`), one adult `STUDENT` (no linked parent, pays for themselves) — matching the table in `docs/superpowers/specs/2026-08-29-roles-permissions-design.md`.

- [ ] **Step 1: Read the current seed file in full**

Read `prisma/seed.ts` (shown in full in this conversation's context) before editing — you are extending it, not rewriting its existing accounts/groups/enrollments.

- [ ] **Step 2: Add one STAFF account per puesto**

After the existing `staffXalapa` creation, add six more `STAFF` users, each with a `staffPosition` and a `staffCampuses` link (Recepción/Caja/Control Escolar → Coatepec; Comercial/Calidad y Control/Dirección de Campus → both campuses, matching the org chart's cross-campus roles):
```ts
const staffRecepcion = await prisma.user.create({
  data: {
    email: "recepcion.coatepec@bristol-ingles.com",
    name: "Recepción Coatepec",
    role: "STAFF",
    staffPosition: "RECEPCION",
    passwordHash,
    emailVerifiedAt: new Date(),
    staffCampuses: { create: { campusId: campusCoatepec.id } },
  },
});

const staffCaja = await prisma.user.create({
  data: {
    email: "caja.xalapa@bristol-ingles.com",
    name: "Caja Xalapa",
    role: "STAFF",
    staffPosition: "CAJA",
    passwordHash,
    emailVerifiedAt: new Date(),
    staffCampuses: { create: { campusId: campusXalapa.id } },
  },
});

const staffControlEscolar = await prisma.user.create({
  data: {
    email: "controlescolar.coatepec@bristol-ingles.com",
    name: "Control Escolar Coatepec",
    role: "STAFF",
    staffPosition: "CONTROL_ESCOLAR",
    passwordHash,
    emailVerifiedAt: new Date(),
    staffCampuses: { create: { campusId: campusCoatepec.id } },
  },
});

const staffComercial = await prisma.user.create({
  data: {
    email: "comercial@bristol-ingles.com",
    name: "Comercial Bristol",
    role: "STAFF",
    staffPosition: "COMERCIAL",
    passwordHash,
    emailVerifiedAt: new Date(),
    staffCampuses: {
      create: [{ campusId: campusCoatepec.id }, { campusId: campusXalapa.id }],
    },
  },
});

const staffCalidadControl = await prisma.user.create({
  data: {
    email: "calidadycontrol@bristol-ingles.com",
    name: "Calidad y Control",
    role: "STAFF",
    staffPosition: "CALIDAD_CONTROL",
    passwordHash,
    emailVerifiedAt: new Date(),
    staffCampuses: {
      create: [{ campusId: campusCoatepec.id }, { campusId: campusXalapa.id }],
    },
  },
});

const staffDireccion = await prisma.user.create({
  data: {
    email: "direccion.xalapa@bristol-ingles.com",
    name: "Dirección Xalapa",
    role: "STAFF",
    staffPosition: "DIRECCION_CAMPUS",
    passwordHash,
    emailVerifiedAt: new Date(),
    staffCampuses: { create: { campusId: campusXalapa.id } },
  },
});
```

- [ ] **Step 3: Add a matrícula-bearing adult student who pays for themselves**

After the existing `studentUser`/`parentUser` creation, add:
```ts
const adultStudentUser = await prisma.user.create({
  data: {
    email: "alumno.adulto.demo@bristol-ingles.com",
    name: "Alumno Adulto Demo",
    role: "STUDENT",
    passwordHash,
    emailVerifiedAt: new Date(),
    student: {
      create: {
        campusId: campusCoatepec.id,
        matricula: "BRI-2026-00002",
        fechaNacimiento: new Date("1995-05-20"),
      },
    },
  },
  include: { student: true },
});

await prisma.enrollment.create({
  data: { studentId: adultStudentUser.student!.id, groupId: groupA1Coatepec.id },
});
```
Also update the ORIGINAL `studentUser` creation (the existing minor demo student, `alumno.demo@bristol-ingles.com`) to include a `fechaNacimiento` that makes them a minor, e.g. add `fechaNacimiento: new Date("2012-03-10")` to its `student: { create: { ... } }` block — this is necessary for the payment-restriction demo (Task 6) to be observable with the existing seeded accounts, since today that student has no birthdate at all (defaults to "treated as minor" either way per the confirmed decision, but an explicit birthdate makes the demo scenario clearer and intentional rather than accidental).

- [ ] **Step 4: Update the console.log summary and README**

Extend the `console.log({...})` object at the end of `main()` with the six new staff emails and `adultStudent: adultStudentUser.email`. Update `README.md`'s seeded-accounts table to list all six new STAFF/puesto accounts and the second student account, matching the table in `docs/superpowers/specs/2026-08-29-roles-permissions-design.md`.

- [ ] **Step 5: Verify the seed runs cleanly**

Run: `npm run db:seed` against the local database — since this ADDS new `prisma.user.create` calls with new emails (no unique-constraint collision with existing seeded rows, since the migration in Task 1 was additive and this is a fresh set of emails), this should NOT require a `migrate reset`. If it does fail due to already-existing data from a prior seed run, that's expected on a database that already has the OLD seed applied — report this in your task report as `DONE_WITH_CONCERNS` rather than attempting a reset yourself; the controller will decide whether a consented reset is needed to get a fully clean demo database.

- [ ] **Step 6: Commit**

```bash
git add prisma/seed.ts README.md
git commit -m "feat: seed one staff account per puesto and a self-paying adult student"
```

---

## Post-plan checklist

- [ ] `npm test` — all suites pass
- [ ] `npx tsc --noEmit` — no type errors
- [ ] `npm run build` — production build succeeds
- [ ] Manual smoke test: log in as each new puesto account and confirm the nav only shows the modules the matrix grants; log in as the minor student and confirm no "Pagar" button appears on Cobranzas; log in as the adult student and confirm it does; approve a group-change-request as Control Escolar (works) and as Recepción (403/blocked)
