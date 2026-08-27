# Bristol Mercadotecnia Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Spec 2f (Mercadotecnia) — a `LeadSource` enum captured on the public contact form, and a read-only conversion-funnel/source-breakdown summary for Staff/Admin, reusing the existing campus-scoping already built for Admisiones.

**Architecture:** One new enum (`LeadSource`) and one new field (`Lead.source`, defaulted so existing rows and any external caller of `POST /api/leads` that doesn't send it keep working). One new read-only endpoint (`GET /api/admin/marketing/summary`) that reuses `getCampusScope`/`leadScopeWhere` from `src/lib/campus-scope.ts` verbatim — no new scoping concept.

**Tech Stack:** Next.js 16 (App Router), Prisma/PostgreSQL, Vitest.

## Global Constraints

- Node ≥22 required — prepend node 22's bin dir to `PATH` before any npm/npx command.
- This repo lives on a network volume that spawns `._<filename>` AppleDouble junk files on write (gitignored); clean with `find . -name "._*" -not -path "./node_modules/*" -not -path "./.git/*" -delete` before build/test.
- `POST /api/leads` must remain backward compatible: omitting `source` must still succeed (defaults to `OTRO` at the database level), since this is a public, unauthenticated endpoint that may already have external callers (the landing page itself, updated in this plan, but treat the contract as public).
- `GET /api/admin/marketing/summary` reuses `getCampusScope`/`leadScopeWhere` exactly as `/admin/admisiones` already does — do not invent a new scoping helper for this.
- Every task must leave `npm run build`, `npm test`, and `npx tsc --noEmit` passing.

---

## File Structure

```
prisma/
  schema.prisma                    # + LeadSource enum, Lead.source field
src/
  app/
    api/
      leads/
        route.ts                       # MODIFY: accept/validate source
      admin/
        marketing/
          summary/
            route.ts                       # NEW: GET
    admin/
      mercadotecnia/
        page.tsx                             # NEW
  components/
    landing/
      lead-form.tsx                  # MODIFY: add source select
    admin/
      admin-nav.tsx                   # MODIFY: + Mercadotecnia entry
  lib/
    lead-source.ts                    # NEW: LEAD_SOURCE_LABELS (mirrors lead-status.ts)
tests/
  api/
    leads-post-source.test.ts
    admin-marketing-summary.test.ts
```

---

### Task 1: LeadSource enum and Lead.source field

**Files:**
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Produces: `LeadSource` enum, `Lead.source` field — consumed by every later task.

- [ ] **Step 1: Add the enum and field**

Add to `prisma/schema.prisma`, near the existing `LeadStatus` enum:
```prisma
enum LeadSource {
  WEB
  REDES_SOCIALES
  REFERIDO
  VISITA_PRESENCIAL
  OTRO
}
```

Add one field to the existing `Lead` model (do not otherwise modify the model):
```prisma
model Lead {
  id        String     @id @default(cuid())
  name      String
  email     String
  phone     String?
  message   String?
  campusId  String?
  status    LeadStatus @default(NEW)
  source    LeadSource @default(OTRO)
  createdAt DateTime   @default(now())

  campus Campus? @relation(fields: [campusId], references: [id])
}
```

- [ ] **Step 2: Run the migration**

Run: `npx prisma migrate dev --name add_lead_source`
Expected: migration applies cleanly; existing `Lead` rows get `source = 'OTRO'` via the column default.

- [ ] **Step 3: Verify**

Run: `npx prisma format --check` (fix with `npx prisma format` if needed), then `npx tsc --noEmit` (generate `.next/types` first via `npx next typegen` if `tsc` only complains about `LayoutProps<"/">` in `src/app/layout.tsx` — never edit that file).

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat: add LeadSource enum and Lead.source field"
```

---

### Task 2: lead-source.ts labels helper

**Files:**
- Create: `src/lib/lead-source.ts`

**Interfaces:**
- Produces: `LEAD_SOURCE_LABELS` — consumed by Task 4 (landing form) and Task 6 (admin page).

- [ ] **Step 1: Implement**

`src/lib/lead-source.ts` (mirrors the existing `src/lib/lead-status.ts` pattern exactly — read that file first for the exact style):
```ts
import type { LeadSource } from "@prisma/client";

export const LEAD_SOURCE_LABELS: Record<LeadSource, string> = {
  WEB: "Sitio web",
  REDES_SOCIALES: "Redes sociales",
  REFERIDO: "Referido",
  VISITA_PRESENCIAL: "Visita presencial",
  OTRO: "Otro",
};
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/lib/lead-source.ts
git commit -m "feat: add LEAD_SOURCE_LABELS helper"
```

---

### Task 3: POST /api/leads accepts and validates source

**Files:**
- Modify: `src/app/api/leads/route.ts`
- Test: `tests/api/leads-post-source.test.ts`

**Interfaces:**
- Consumes: `prisma`.
- Produces: updated `POST /api/leads` — consumed by Task 4's updated `LeadForm`.

- [ ] **Step 1: Read the existing route first**

Read `src/app/api/leads/route.ts` in full before editing — it already validates `name`/`email`/`phone`/`message`/`campusId`. Your change adds one more optional field to that same validation block; do not restructure anything else in the file.

- [ ] **Step 2: Write the failing tests**

`tests/api/leads-post-source.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { lead: { create: vi.fn() } },
}));

import { prisma } from "@/lib/prisma";
import { POST } from "@/app/api/leads/route";

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/leads", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

const BASE_BODY = { name: "Ana Torres", email: "ana@example.com" };

describe("POST /api/leads — source field", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 when source is not a valid LeadSource value", async () => {
    (prisma.lead.create as any).mockResolvedValue({ id: "l1" });
    const res = await POST(jsonRequest({ ...BASE_BODY, source: "TIKTOK" }));
    expect(res.status).toBe(400);
    expect(prisma.lead.create).not.toHaveBeenCalled();
  });

  it("creates the lead without a source field in the payload when source is omitted (defaults at the DB level)", async () => {
    (prisma.lead.create as any).mockResolvedValue({ id: "l1" });
    const res = await POST(jsonRequest(BASE_BODY));
    expect(res.status).toBe(201);
    const callArg = (prisma.lead.create as any).mock.calls[0][0];
    expect(callArg.data.source).toBeUndefined();
  });

  it("passes a valid source through to the create call", async () => {
    (prisma.lead.create as any).mockResolvedValue({ id: "l1" });
    const res = await POST(jsonRequest({ ...BASE_BODY, source: "REFERIDO" }));
    expect(res.status).toBe(201);
    expect(prisma.lead.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ source: "REFERIDO" }),
    });
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test -- tests/api/leads-post-source.test.ts`
Expected: FAIL — `source` isn't validated/passed through yet.

- [ ] **Step 4: Implement**

In `src/app/api/leads/route.ts`, add `source` to the destructured/typed body, validate it against the enum's valid values, and pass it through to `prisma.lead.create`'s `data` only when provided (so an omitted `source` lets Prisma's column default apply — do NOT pass `source: undefined` explicitly if that would change behavior; passing `source: undefined` in a Prisma `data` object is equivalent to omitting the key, so either approach is fine, but the test above asserts `callArg.data.source` is `undefined` when omitted, which both approaches satisfy). Example diff shape:
```ts
const VALID_SOURCES = ["WEB", "REDES_SOCIALES", "REFERIDO", "VISITA_PRESENCIAL", "OTRO"];

// ...inside the existing body type, add: source?: string;

// ...inside the existing validation block, add:
if (body.source !== undefined && !VALID_SOURCES.includes(body.source)) {
  return Response.json({ error: "Origen de lead inválido" }, { status: 400 });
}

// ...inside prisma.lead.create's data object, add:
source: body.source as any,
```
Keep every existing validation/behavior in the file exactly as-is — this is an additive change only.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- tests/api/leads-post-source.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 6: Run the full existing leads test suite to confirm no regression**

Run: `npm test -- tests/api` (or whatever existing test file covers `/api/leads` today — check for one first with `ls tests/api/ | grep -i lead`)
Expected: PASS, no regressions in existing lead-creation tests.

- [ ] **Step 7: Commit**

```bash
git add src/app/api/leads/route.ts tests/api/leads-post-source.test.ts
git commit -m "feat: accept and validate Lead.source in POST /api/leads"
```

---

### Task 4: Landing lead form captures source

**Files:**
- Modify: `src/components/landing/lead-form.tsx`

**Interfaces:**
- Consumes: `LEAD_SOURCE_LABELS` (Task 2), `POST /api/leads` (Task 3).
- Produces: an updated public contact form.

- [ ] **Step 1: Read the existing form first**

Read `src/components/landing/lead-form.tsx` in full before editing — note its existing `name`/`email`/`phone` state and its `fetch("/api/leads", ...)` call body.

- [ ] **Step 2: Add a source select**

Add a `source` state (default `"OTRO"`, matching the DB default) and a `<select>` with the label "¿Cómo te enteraste de nosotros?", options built from `LEAD_SOURCE_LABELS` (import from `@/lib/lead-source`). Add `source` to the JSON body sent in the existing `fetch` call, alongside `name`/`email`/`phone`. Match the existing form's exact styling conventions (look at how the existing `phone` input is styled and mirror it for the new `<select>`).

- [ ] **Step 3: Verify it builds**

Run: kill any running `next dev` (`pgrep -f "next dev" | xargs -r kill`), `rm -rf .next`, then `npm run build`.
Expected: clean build, landing page (`/`) still compiles.

- [ ] **Step 4: Commit**

```bash
git add src/components/landing/lead-form.tsx
git commit -m "feat: capture lead source on the landing contact form"
```

---

### Task 5: GET /api/admin/marketing/summary

**Files:**
- Create: `src/app/api/admin/marketing/summary/route.ts`
- Test: `tests/api/admin-marketing-summary.test.ts`

**Interfaces:**
- Consumes: `auth`, `getCampusScope`, `leadScopeWhere`, `prisma`.
- Produces: `GET /api/admin/marketing/summary` — consumed by Task 6's admin page.

- [ ] **Step 1: Write the failing tests**

`tests/api/admin-marketing-summary.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/campus-scope", () => ({ getCampusScope: vi.fn(), leadScopeWhere: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { lead: { groupBy: vi.fn() } },
}));

import { auth } from "@/lib/auth";
import { getCampusScope, leadScopeWhere } from "@/lib/campus-scope";
import { prisma } from "@/lib/prisma";
import { GET } from "@/app/api/admin/marketing/summary/route";

describe("GET /api/admin/marketing/summary", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 without a session", async () => {
    (auth as any).mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns 403 for a TEACHER", async () => {
    (auth as any).mockResolvedValue({ user: { id: "t1", role: "TEACHER" } });
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("returns counts grouped by status and by source, scoped via leadScopeWhere", async () => {
    (auth as any).mockResolvedValue({ user: { id: "s1", role: "STAFF" } });
    (getCampusScope as any).mockResolvedValue({ type: "CAMPUS_LIST", campusIds: ["c1"] });
    (leadScopeWhere as any).mockReturnValue({ campusId: { in: ["c1"] } });
    (prisma.lead.groupBy as any)
      .mockResolvedValueOnce([{ status: "NEW", _count: { _all: 3 } }])
      .mockResolvedValueOnce([{ source: "WEB", _count: { _all: 2 } }]);

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      byStatus: [{ status: "NEW", count: 3 }],
      bySource: [{ source: "WEB", count: 2 }],
    });
    expect(prisma.lead.groupBy).toHaveBeenCalledWith({
      by: ["status"],
      where: { campusId: { in: ["c1"] } },
      _count: { _all: true },
    });
    expect(prisma.lead.groupBy).toHaveBeenCalledWith({
      by: ["source"],
      where: { campusId: { in: ["c1"] } },
      _count: { _all: true },
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/api/admin-marketing-summary.test.ts`
Expected: FAIL — route doesn't exist yet.

- [ ] **Step 3: Implement**

`src/app/api/admin/marketing/summary/route.ts`:
```ts
import { auth } from "@/lib/auth";
import { getCampusScope, leadScopeWhere } from "@/lib/campus-scope";
import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }
  const role = (session.user as { role: Role }).role;
  if (role !== "ADMIN" && role !== "STAFF") {
    return Response.json({ error: "No autorizado" }, { status: 403 });
  }

  const scope = await getCampusScope(session.user as { id: string; role: Role });
  const where = leadScopeWhere(scope);

  const [statusGroups, sourceGroups] = await Promise.all([
    prisma.lead.groupBy({ by: ["status"], where, _count: { _all: true } }),
    prisma.lead.groupBy({ by: ["source"], where, _count: { _all: true } }),
  ]);

  return Response.json({
    byStatus: statusGroups.map((g) => ({ status: g.status, count: g._count._all })),
    bySource: sourceGroups.map((g) => ({ source: g.source, count: g._count._all })),
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/api/admin-marketing-summary.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/app/api/admin/marketing tests/api/admin-marketing-summary.test.ts
git commit -m "feat: add GET /api/admin/marketing/summary"
```

---

### Task 6: Mercadotecnia admin page

**Files:**
- Create: `src/app/admin/mercadotecnia/page.tsx`
- Modify: `src/components/admin/admin-nav.tsx`

**Interfaces:**
- Consumes: `auth`, `getCampusScope`, `leadScopeWhere`, `prisma`, `LEAD_STATUS_LABELS`, `LEAD_SOURCE_LABELS`, `Card`.
- Produces: `/admin/mercadotecnia`, plus a "Mercadotecnia" entry in `AdminNav`.

- [ ] **Step 1: Add Mercadotecnia to AdminNav**

In `src/components/admin/admin-nav.tsx`, add `{ href: "/admin/mercadotecnia", label: "Mercadotecnia" }` to the end of the `MODULES` array.

- [ ] **Step 2: Mercadotecnia page**

This page queries Prisma directly (server component), the same pattern used by every other admin page in this codebase (it does not call its own API route) — mirror `src/app/admin/admisiones/page.tsx`'s structure for the redirect/scope logic.

`src/app/admin/mercadotecnia/page.tsx`:
```tsx
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getCampusScope, leadScopeWhere } from "@/lib/campus-scope";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { LEAD_STATUS_LABELS } from "@/lib/lead-status";
import { LEAD_SOURCE_LABELS } from "@/lib/lead-source";
import type { Role } from "@prisma/client";

export default async function MercadotecniaPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const role = (session.user as { role: Role }).role;
  if (role !== "ADMIN" && role !== "STAFF") redirect("/portal");

  const scope = await getCampusScope(session.user as { id: string; role: Role });
  const where = leadScopeWhere(scope);

  const [statusGroups, sourceGroups] = await Promise.all([
    prisma.lead.groupBy({ by: ["status"], where, _count: { _all: true } }),
    prisma.lead.groupBy({ by: ["source"], where, _count: { _all: true } }),
  ]);

  const total = statusGroups.reduce((sum, g) => sum + g._count._all, 0);
  const enrolled = statusGroups.find((g) => g.status === "ENROLLED")?._count._all ?? 0;
  const conversionRate = total > 0 ? Math.round((enrolled / total) * 100) : 0;

  return (
    <div>
      <h1 className="text-lg font-semibold">Mercadotecnia</h1>
      <p className="mt-1 text-sm text-muted">
        Origen y conversión de leads capturados desde la landing.
      </p>

      <div className="mt-6 grid gap-6 md:grid-cols-3">
        <Card>
          <p className="text-sm text-muted">Total de leads</p>
          <p className="mt-1 text-3xl font-bold text-primary">{total}</p>
        </Card>
        <Card>
          <p className="text-sm text-muted">Inscritos</p>
          <p className="mt-1 text-3xl font-bold text-primary">{enrolled}</p>
        </Card>
        <Card>
          <p className="text-sm text-muted">Tasa de conversión</p>
          <p className="mt-1 text-3xl font-bold text-primary">{conversionRate}%</p>
        </Card>
      </div>

      <div className="mt-8 grid gap-8 md:grid-cols-2">
        <div>
          <h2 className="text-sm font-semibold text-muted">Por estatus</h2>
          <div className="mt-3 space-y-2">
            {statusGroups.map((g) => (
              <div key={g.status} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                <span>{LEAD_STATUS_LABELS[g.status]}</span>
                <span className="font-semibold">{g._count._all}</span>
              </div>
            ))}
            {statusGroups.length === 0 && <p className="text-sm text-muted">Sin datos.</p>}
          </div>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-muted">Por origen</h2>
          <div className="mt-3 space-y-2">
            {sourceGroups.map((g) => (
              <div key={g.source} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                <span>{LEAD_SOURCE_LABELS[g.source]}</span>
                <span className="font-semibold">{g._count._all}</span>
              </div>
            ))}
            {sourceGroups.length === 0 && <p className="text-sm text-muted">Sin datos.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify it builds**

Run: kill any running `next dev` (`pgrep -f "next dev" | xargs -r kill`), `rm -rf .next`, then `npm run build`.
Expected: `/admin/mercadotecnia` compiles as a dynamic route.

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/mercadotecnia src/components/admin/admin-nav.tsx
git commit -m "feat: add mercadotecnia admin page"
```

---

## Post-plan checklist

- [ ] `npm test` — all suites pass
- [ ] `npx tsc --noEmit` — no type errors
- [ ] `npm run build` — production build succeeds, all new routes listed
- [ ] Manual smoke test: submit the landing contact form with a chosen source, confirm it appears correctly in `/admin/mercadotecnia`'s "Por origen" breakdown and in `/admin/admisiones`'s existing lead list
