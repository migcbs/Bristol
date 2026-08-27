# Bristol Admisiones Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the first real module of the Admin Panel (Spec 2a) — a campus-scoped Admisiones screen where Staff/Admin can see leads captured by the landing page and move them through a status pipeline.

**Architecture:** A `LeadStatus` enum added to the existing `Lead` model. Two API routes (`GET`/`PATCH`) reuse Foundation's `getCampusScope` helper for authorization, following the exact pattern already established by `/api/students`. The `/admin/admisiones` page is a Server Component (same pattern as `/programas`/`/planteles`) that fetches data directly via Prisma; a small Client Component handles the per-row status/campus dropdowns.

**Tech Stack:** Next.js 16 (App Router), Prisma/PostgreSQL, Vitest — all already established by Foundation.

## Global Constraints

- Node ≥22 required — run `nvm use 22` before any `npm`/`npx` command (`.nvmrc` already committed).
- This repo lives on a network volume that spawns `._<filename>` AppleDouble junk files on write (already gitignored); if a build/lint error mentions "Invalid character", run `find . -name "._*" -not -path "./node_modules/*" -not -path "./.git/*" -delete`.
- Reuse `getCampusScope` from `src/lib/campus-scope.ts` verbatim — do not reimplement campus-scoping logic.
- Reuse `Table`/`TableRow`/`TableCell`/`TableHead` from `src/components/ui/table.tsx` and `Badge` from `src/components/ui/badge.tsx` for the leads table — do not build new table primitives.
- `STAFF` sees leads in their assigned campus(es) **plus** leads with `campusId: null` (unassigned pool); `ADMIN` sees everything. `TEACHER`/`STUDENT`/`PARENT` never reach `/admin` (already blocked by Foundation's `proxy.ts`).
- Every task must leave `npm run build`, `npm test`, and `npx tsc --noEmit` passing.

---

## File Structure

```
prisma/
  schema.prisma          # + LeadStatus enum, Lead.status field
src/
  lib/
    campus-scope.ts       # unchanged, reused
  components/
    admin/
      admin-nav.tsx        # minimal nav for /admin/* pages
      lead-row-actions.tsx  # client component: status/campus selects
  app/
    admin/
      layout.tsx            # modified: renders AdminNav
      page.tsx               # modified: links to Admisiones instead of placeholder text
      admisiones/
        page.tsx              # new: leads table
    api/
      admin/
        leads/
          route.ts             # GET
          [id]/
            route.ts             # PATCH
tests/
  api/
    admin-leads.test.ts
    admin-leads-id.test.ts
```

---

### Task 1: LeadStatus enum and migration

**Files:**
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Produces: `LeadStatus` enum (`NEW | CONTACTED | ENROLLED | LOST`) and `Lead.status` field (default `NEW`), consumed by Tasks 2-5.

- [ ] **Step 1: Add the enum and field**

In `prisma/schema.prisma`, add above the `Lead` model:
```prisma
enum LeadStatus {
  NEW
  CONTACTED
  ENROLLED
  LOST
}
```

Add to the existing `Lead` model (after `campusId`, before `createdAt`):
```prisma
  status    LeadStatus @default(NEW)
```

- [ ] **Step 2: Run the migration**

Run: `npx prisma migrate dev --name add_lead_status`
Expected: migration applies cleanly against the local `bristol` database (existing leads get `status = NEW` via the default), Prisma Client regenerates.

- [ ] **Step 3: Verify build**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat: add LeadStatus enum and status field to Lead"
```

---

### Task 2: GET /api/admin/leads

**Files:**
- Create: `src/app/api/admin/leads/route.ts`
- Test: `tests/api/admin-leads.test.ts`

**Interfaces:**
- Consumes: `auth` from `src/lib/auth.ts`, `getCampusScope` from `src/lib/campus-scope.ts`, `prisma`.
- Produces: `GET /api/admin/leads?status=<LeadStatus>` — array of leads (401/403/200), consumed by Task 5's admin page (as the reference query shape — the page itself queries Prisma directly, but this route's `where` construction is the one to copy) and directly testable as the module's public contract.

- [ ] **Step 1: Write the failing tests**

`tests/api/admin-leads.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/campus-scope", () => ({ getCampusScope: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { lead: { findMany: vi.fn() } },
}));

import { auth } from "@/lib/auth";
import { getCampusScope } from "@/lib/campus-scope";
import { prisma } from "@/lib/prisma";
import { GET } from "@/app/api/admin/leads/route";

function requestWithStatus(status?: string) {
  const url = status
    ? `http://localhost/api/admin/leads?status=${status}`
    : "http://localhost/api/admin/leads";
  return new Request(url);
}

describe("GET /api/admin/leads", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when there is no session", async () => {
    (auth as any).mockResolvedValue(null);
    const res = await GET(requestWithStatus());
    expect(res.status).toBe(401);
  });

  it("returns 403 for a non-admin, non-staff role", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1", role: "STUDENT" } });
    const res = await GET(requestWithStatus());
    expect(res.status).toBe(403);
  });

  it("queries all leads for ADMIN with no campus filter", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1", role: "ADMIN" } });
    (getCampusScope as any).mockResolvedValue({ type: "ALL" });
    (prisma.lead.findMany as any).mockResolvedValue([]);

    const res = await GET(requestWithStatus());
    expect(res.status).toBe(200);
    expect(prisma.lead.findMany).toHaveBeenCalledWith({
      where: {},
      orderBy: { createdAt: "desc" },
    });
  });

  it("queries campus-or-unassigned leads for STAFF", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u2", role: "STAFF" } });
    (getCampusScope as any).mockResolvedValue({ type: "CAMPUS_LIST", campusIds: ["c1", "c2"] });
    (prisma.lead.findMany as any).mockResolvedValue([]);

    await GET(requestWithStatus());
    expect(prisma.lead.findMany).toHaveBeenCalledWith({
      where: { OR: [{ campusId: { in: ["c1", "c2"] } }, { campusId: null }] },
      orderBy: { createdAt: "desc" },
    });
  });

  it("adds a status filter when provided", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1", role: "ADMIN" } });
    (getCampusScope as any).mockResolvedValue({ type: "ALL" });
    (prisma.lead.findMany as any).mockResolvedValue([]);

    await GET(requestWithStatus("CONTACTED"));
    expect(prisma.lead.findMany).toHaveBeenCalledWith({
      where: { status: "CONTACTED" },
      orderBy: { createdAt: "desc" },
    });
  });

  it("ignores an invalid status filter value", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1", role: "ADMIN" } });
    (getCampusScope as any).mockResolvedValue({ type: "ALL" });
    (prisma.lead.findMany as any).mockResolvedValue([]);

    await GET(requestWithStatus("NOT_A_STATUS"));
    expect(prisma.lead.findMany).toHaveBeenCalledWith({
      where: {},
      orderBy: { createdAt: "desc" },
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/api/admin-leads.test.ts`
Expected: FAIL — route doesn't exist yet.

- [ ] **Step 3: Implement**

`src/app/api/admin/leads/route.ts`:
```ts
import { auth } from "@/lib/auth";
import { getCampusScope } from "@/lib/campus-scope";
import { prisma } from "@/lib/prisma";
import type { Prisma, LeadStatus } from "@prisma/client";

const VALID_STATUSES: LeadStatus[] = ["NEW", "CONTACTED", "ENROLLED", "LOST"];

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }

  const role = (session.user as { role: string }).role;
  if (role !== "ADMIN" && role !== "STAFF") {
    return Response.json({ error: "No autorizado" }, { status: 403 });
  }

  const scope = await getCampusScope(session.user as { id: string; role: any });

  const where: Prisma.LeadWhereInput =
    scope.type === "ALL"
      ? {}
      : scope.type === "CAMPUS_LIST"
        ? { OR: [{ campusId: { in: scope.campusIds } }, { campusId: null }] }
        : {};

  const statusParam = new URL(request.url).searchParams.get("status");
  if (statusParam && VALID_STATUSES.includes(statusParam as LeadStatus)) {
    where.status = statusParam as LeadStatus;
  }

  const leads = await prisma.lead.findMany({ where, orderBy: { createdAt: "desc" } });
  return Response.json(leads);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/api/admin-leads.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add src/app/api/admin/leads/route.ts tests/api/admin-leads.test.ts
git commit -m "feat: add GET /api/admin/leads with campus-scoped visibility"
```

---

### Task 3: PATCH /api/admin/leads/[id]

**Files:**
- Create: `src/app/api/admin/leads/[id]/route.ts`
- Test: `tests/api/admin-leads-id.test.ts`

**Interfaces:**
- Consumes: `auth`, `getCampusScope`, `prisma`.
- Produces: `PATCH /api/admin/leads/[id]` — 200 with updated lead, 400 for invalid `status`/`campusId`, 401/403 same as Task 2, 404 if the lead is outside the caller's scope. Consumed by Task 4's `LeadRowActions` client component.

- [ ] **Step 1: Write the failing tests**

`tests/api/admin-leads-id.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/campus-scope", () => ({ getCampusScope: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    lead: { findUnique: vi.fn(), update: vi.fn() },
    campus: { findUnique: vi.fn() },
  },
}));

import { auth } from "@/lib/auth";
import { getCampusScope } from "@/lib/campus-scope";
import { prisma } from "@/lib/prisma";
import { PATCH } from "@/app/api/admin/leads/[id]/route";

function patchRequest(body: unknown) {
  return new Request("http://localhost/api/admin/leads/l1", {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

const ctx = { params: Promise.resolve({ id: "l1" }) };

describe("PATCH /api/admin/leads/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when there is no session", async () => {
    (auth as any).mockResolvedValue(null);
    const res = await PATCH(patchRequest({ status: "CONTACTED" }), ctx);
    expect(res.status).toBe(401);
  });

  it("returns 403 for a non-admin, non-staff role", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1", role: "PARENT" } });
    const res = await PATCH(patchRequest({ status: "CONTACTED" }), ctx);
    expect(res.status).toBe(403);
  });

  it("returns 400 for an invalid status value", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1", role: "ADMIN" } });
    const res = await PATCH(patchRequest({ status: "MAYBE" }), ctx);
    expect(res.status).toBe(400);
  });

  it("returns 400 when campusId does not reference an existing campus", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1", role: "ADMIN" } });
    (prisma.campus.findUnique as any).mockResolvedValue(null);
    const res = await PATCH(patchRequest({ campusId: "bogus" }), ctx);
    expect(res.status).toBe(400);
  });

  it("returns 404 when the lead is outside the caller's scope", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u2", role: "STAFF" } });
    (getCampusScope as any).mockResolvedValue({ type: "CAMPUS_LIST", campusIds: ["c1"] });
    (prisma.lead.findUnique as any).mockResolvedValue({ id: "l1", campusId: "c2" });

    const res = await PATCH(patchRequest({ status: "CONTACTED" }), ctx);
    expect(res.status).toBe(404);
    expect(prisma.lead.update).not.toHaveBeenCalled();
  });

  it("updates status for a lead within scope", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u2", role: "STAFF" } });
    (getCampusScope as any).mockResolvedValue({ type: "CAMPUS_LIST", campusIds: ["c1"] });
    (prisma.lead.findUnique as any).mockResolvedValue({ id: "l1", campusId: "c1" });
    (prisma.lead.update as any).mockResolvedValue({ id: "l1", status: "CONTACTED" });

    const res = await PATCH(patchRequest({ status: "CONTACTED" }), ctx);
    expect(res.status).toBe(200);
    expect(prisma.lead.update).toHaveBeenCalledWith({
      where: { id: "l1" },
      data: { status: "CONTACTED" },
    });
  });

  it("updates campusId for an unassigned lead within scope (STAFF claiming it)", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u2", role: "STAFF" } });
    (getCampusScope as any).mockResolvedValue({ type: "CAMPUS_LIST", campusIds: ["c1"] });
    (prisma.lead.findUnique as any).mockResolvedValue({ id: "l1", campusId: null });
    (prisma.campus.findUnique as any).mockResolvedValue({ id: "c1" });
    (prisma.lead.update as any).mockResolvedValue({ id: "l1", campusId: "c1" });

    const res = await PATCH(patchRequest({ campusId: "c1" }), ctx);
    expect(res.status).toBe(200);
    expect(prisma.lead.update).toHaveBeenCalledWith({
      where: { id: "l1" },
      data: { campusId: "c1" },
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/api/admin-leads-id.test.ts`
Expected: FAIL — route doesn't exist yet.

- [ ] **Step 3: Implement**

`src/app/api/admin/leads/[id]/route.ts`:
```ts
import { auth } from "@/lib/auth";
import { getCampusScope } from "@/lib/campus-scope";
import { prisma } from "@/lib/prisma";
import type { LeadStatus } from "@prisma/client";

const VALID_STATUSES: LeadStatus[] = ["NEW", "CONTACTED", "ENROLLED", "LOST"];

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }

  const role = (session.user as { role: string }).role;
  if (role !== "ADMIN" && role !== "STAFF") {
    return Response.json({ error: "No autorizado" }, { status: 403 });
  }

  let body: { status?: string; campusId?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Cuerpo de la solicitud inválido" }, { status: 400 });
  }

  if (body.status !== undefined && !VALID_STATUSES.includes(body.status as LeadStatus)) {
    return Response.json({ error: "Estatus inválido" }, { status: 400 });
  }

  if (body.campusId !== undefined) {
    const campus = await prisma.campus.findUnique({ where: { id: body.campusId } });
    if (!campus) {
      return Response.json({ error: "Plantel inválido" }, { status: 400 });
    }
  }

  const { id } = await context.params;
  const lead = await prisma.lead.findUnique({ where: { id } });
  if (!lead) {
    return Response.json({ error: "No encontrado" }, { status: 404 });
  }

  const scope = await getCampusScope(session.user as { id: string; role: any });
  const inScope =
    scope.type === "ALL" ||
    (scope.type === "CAMPUS_LIST" &&
      (lead.campusId === null || scope.campusIds.includes(lead.campusId)));

  if (!inScope) {
    return Response.json({ error: "No encontrado" }, { status: 404 });
  }

  if (
    body.campusId !== undefined &&
    scope.type === "CAMPUS_LIST" &&
    !scope.campusIds.includes(body.campusId)
  ) {
    return Response.json({ error: "Plantel fuera de tu alcance" }, { status: 400 });
  }

  const data: { status?: LeadStatus; campusId?: string } = {};
  if (body.status !== undefined) data.status = body.status as LeadStatus;
  if (body.campusId !== undefined) data.campusId = body.campusId;

  const updated = await prisma.lead.update({ where: { id }, data });
  return Response.json(updated);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/api/admin-leads-id.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add src/app/api/admin/leads tests/api/admin-leads-id.test.ts
git commit -m "feat: add PATCH /api/admin/leads/[id] for status and campus updates"
```

---

### Task 4: LeadRowActions client component

**Files:**
- Create: `src/components/admin/lead-row-actions.tsx`

**Interfaces:**
- Consumes: `PATCH /api/admin/leads/[id]` (Task 3), `Campus`/`LeadStatus` types from `@prisma/client`.
- Produces: `LeadRowActions` component consumed by Task 5's admisiones page — takes `leadId: string`, `initialStatus: LeadStatus`, `initialCampusId: string | null`, `campuses: { id: string; name: string }[]`.

- [ ] **Step 1: Implement**

`src/components/admin/lead-row-actions.tsx`:
```tsx
"use client";

import { useState } from "react";
import type { LeadStatus } from "@prisma/client";

const STATUS_LABELS: Record<LeadStatus, string> = {
  NEW: "Nuevo",
  CONTACTED: "Contactado",
  ENROLLED: "Inscrito",
  LOST: "Perdido",
};

export function LeadRowActions({
  leadId,
  initialStatus,
  initialCampusId,
  campuses,
}: {
  leadId: string;
  initialStatus: LeadStatus;
  initialCampusId: string | null;
  campuses: { id: string; name: string }[];
}) {
  const [status, setStatus] = useState(initialStatus);
  const [campusId, setCampusId] = useState(initialCampusId ?? "");
  const [error, setError] = useState<string | null>(null);

  async function update(data: { status?: LeadStatus; campusId?: string }) {
    setError(null);
    const res = await fetch(`/api/admin/leads/${leadId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "No se pudo actualizar");
      return false;
    }
    return true;
  }

  async function handleStatusChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value as LeadStatus;
    const previous = status;
    setStatus(next);
    const ok = await update({ status: next });
    if (!ok) setStatus(previous);
  }

  async function handleCampusChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value;
    const previous = campusId;
    setCampusId(next);
    const ok = await update({ campusId: next });
    if (!ok) setCampusId(previous);
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex gap-2">
        <select
          value={status}
          onChange={handleStatusChange}
          className="rounded-md border border-border px-2 py-1 text-xs"
        >
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select
          value={campusId}
          onChange={handleCampusChange}
          className="rounded-md border border-border px-2 py-1 text-xs"
        >
          <option value="">Sin asignar</option>
          {campuses.map((campus) => (
            <option key={campus.id} value={campus.id}>
              {campus.name}
            </option>
          ))}
        </select>
      </div>
      {error && <p className="text-xs text-accent-dark">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/lead-row-actions.tsx
git commit -m "feat: add LeadRowActions component for inline status/campus updates"
```

---

### Task 5: Admisiones page and AdminNav

**Files:**
- Create: `src/components/admin/admin-nav.tsx`
- Create: `src/app/admin/admisiones/page.tsx`
- Modify: `src/app/admin/layout.tsx`
- Modify: `src/app/admin/page.tsx`

**Interfaces:**
- Consumes: `auth`, `getCampusScope`, `prisma`, `Table`/`TableRow`/`TableCell`/`TableHead` (Foundation), `LeadRowActions` (Task 4).
- Produces: the `/admin/admisiones` route and a minimal admin-wide nav.

- [ ] **Step 1: AdminNav**

`src/components/admin/admin-nav.tsx`:
```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";

const MODULES = [{ href: "/admin/admisiones", label: "Admisiones" }];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-4 border-b border-border px-6 py-2 text-sm font-medium">
      {MODULES.map((mod) => (
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

- [ ] **Step 2: Wire AdminNav into the admin layout**

In `src/app/admin/layout.tsx`, import `AdminNav` from `@/components/admin/admin-nav` and render it directly below the existing `<header>` element (as a sibling, before `<main>`).

- [ ] **Step 3: Update the admin home page**

Replace the body of `src/app/admin/page.tsx` (keep it a simple server component) with:
```tsx
import Link from "next/link";

export default function AdminHomePage() {
  return (
    <div>
      <h1 className="text-lg font-semibold">Panel administrativo</h1>
      <p className="mt-2 text-sm text-muted">
        <Link href="/admin/admisiones" className="font-medium text-primary hover:underline">
          Ir a Admisiones
        </Link>{" "}
        para dar seguimiento a los leads capturados desde la landing.
        Cobranzas, reinscripciones, comunicaciones y gestión escolar se
        agregarán en las siguientes iteraciones de Spec 2.
      </p>
    </div>
  );
}
```

- [ ] **Step 4: Admisiones page**

`src/app/admin/admisiones/page.tsx`:
```tsx
import { auth } from "@/lib/auth";
import { getCampusScope } from "@/lib/campus-scope";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { Table, TableRow, TableCell, TableHead } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { LeadRowActions } from "@/components/admin/lead-row-actions";

const STATUS_LABELS: Record<string, string> = {
  NEW: "Nuevo",
  CONTACTED: "Contactado",
  ENROLLED: "Inscrito",
  LOST: "Perdido",
};

export default async function AdmisionesPage() {
  const session = await auth();
  const scope = await getCampusScope(session!.user as { id: string; role: any });

  const where: Prisma.LeadWhereInput =
    scope.type === "ALL"
      ? {}
      : scope.type === "CAMPUS_LIST"
        ? { OR: [{ campusId: { in: scope.campusIds } }, { campusId: null }] }
        : {};

  const [leads, campuses] = await Promise.all([
    prisma.lead.findMany({ where, orderBy: { createdAt: "desc" }, include: { campus: true } }),
    prisma.campus.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div>
      <h1 className="text-lg font-semibold">Admisiones</h1>
      <p className="mt-1 text-sm text-muted">
        Leads capturados desde la landing, más recientes primero.
      </p>
      <div className="mt-6 overflow-x-auto">
        <Table>
          <thead>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Contacto</TableHead>
              <TableHead>Plantel</TableHead>
              <TableHead>Estatus</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Acciones</TableHead>
            </TableRow>
          </thead>
          <tbody>
            {leads.map((lead) => (
              <TableRow key={lead.id}>
                <TableCell>{lead.name}</TableCell>
                <TableCell>
                  <div className="text-sm">{lead.email}</div>
                  {lead.phone && <div className="text-xs text-muted">{lead.phone}</div>}
                </TableCell>
                <TableCell>{lead.campus?.name ?? "Sin asignar"}</TableCell>
                <TableCell>
                  <Badge tone="primary">{STATUS_LABELS[lead.status]}</Badge>
                </TableCell>
                <TableCell>{lead.createdAt.toLocaleDateString("es-MX")}</TableCell>
                <TableCell>
                  <LeadRowActions
                    leadId={lead.id}
                    initialStatus={lead.status}
                    initialCampusId={lead.campusId}
                    campuses={campuses}
                  />
                </TableCell>
              </TableRow>
            ))}
          </tbody>
        </Table>
        {leads.length === 0 && (
          <p className="mt-6 text-center text-sm text-muted">
            No hay leads que mostrar todavía.
          </p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Verify it builds**

Run: `npm run build`
Expected: `/admin/admisiones` compiles and is listed as a dynamic route (it reads the session).

- [ ] **Step 6: Commit**

```bash
git add src/components/admin/admin-nav.tsx src/app/admin
git commit -m "feat: add Admisiones page and minimal admin navigation"
```

---

## Post-plan checklist

- [ ] `npm test` — all suites pass
- [ ] `npx tsc --noEmit` — no type errors
- [ ] `npm run build` — production build succeeds, `/admin/admisiones` listed
- [ ] Manual smoke test: log in as `admin@bristol-ingles.com`, confirm all leads visible; log in as `staff.norte@bristol-ingles.com`, confirm only Norte + unassigned leads visible; change a lead's status and campus, confirm it persists on reload
