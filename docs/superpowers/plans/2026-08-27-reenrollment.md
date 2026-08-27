# Bristol Reinscripciones Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Spec 2c (Reinscripciones) — Staff/Admin can see active enrollments and move a student from their current group into a new one, closing the old enrollment and opening a new one atomically.

**Architecture:** `Enrollment.completedAt` (nullable) added to the existing model. Routes reuse `getCampusScope` (same pattern as Admisiones/Cobranzas). The re-enroll operation uses a Prisma `$transaction` so the close-old/open-new pair never partially applies.

**Tech Stack:** Next.js 16 (App Router), Prisma/PostgreSQL, Vitest — all established patterns from prior specs.

## Global Constraints

- Node ≥22 required — `nvm use 22` before any `npm`/`npx` command.
- This repo lives on a network volume that spawns `._<filename>` AppleDouble junk files on write (already gitignored); clean with `find . -name "._*" -not -path "./node_modules/*" -not -path "./.git/*" -delete` if needed.
- Reuse `getCampusScope` from `src/lib/campus-scope.ts` — do not reimplement scoping. Fail-closed (deny) for any scope type other than `ALL`/`CAMPUS_LIST`, matching the `leadScopeWhere`/invoice pattern already established.
- The close-old/open-new enrollment pair MUST be wrapped in `prisma.$transaction(...)` — never two separate awaited calls that could partially apply on failure.
- A student may only be re-enrolled into a group at their **own** campus — reject cross-campus moves with 400.
- Every task must leave `npm run build`, `npm test`, and `npx tsc --noEmit` passing.

---

## File Structure

```
prisma/
  schema.prisma            # + Enrollment.completedAt
src/
  app/
    admin/
      reinscripciones/
        page.tsx               # list + re-enroll form
    api/
      admin/
        enrollments/
          route.ts                # GET
        reinscripciones/
          route.ts                  # POST
  components/
    admin/
      reenroll-row-actions.tsx     # client: group-select + "Reinscribir" button
tests/
  api/
    admin-enrollments.test.ts
    admin-reinscripciones.test.ts
```

---

### Task 1: Enrollment.completedAt migration

**Files:**
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Produces: `Enrollment.completedAt` (nullable `DateTime`), consumed by every later task.

- [ ] **Step 1: Add the field**

In `prisma/schema.prisma`'s existing `Enrollment` model, add:
```prisma
  completedAt DateTime?
```
(alongside the existing `enrolledAt DateTime @default(now())` field — add it right after that line).

- [ ] **Step 2: Run the migration**

Run: `npx prisma migrate dev --name add_enrollment_completed_at`
Expected: migration applies cleanly; existing enrollments get `completedAt = NULL` (active) by default, since the column is nullable with no default value.

- [ ] **Step 3: Verify build**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat: add Enrollment.completedAt for tracking re-enrollment"
```

---

### Task 2: GET /api/admin/enrollments

**Files:**
- Create: `src/app/api/admin/enrollments/route.ts`
- Test: `tests/api/admin-enrollments.test.ts`

**Interfaces:**
- Consumes: `auth`, `getCampusScope`, `prisma`.
- Produces: `GET /api/admin/enrollments` — active enrollments (`completedAt: null`) visible to the caller, consumed by Task 4's admin page.

- [ ] **Step 1: Write the failing tests**

`tests/api/admin-enrollments.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/campus-scope", () => ({ getCampusScope: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { enrollment: { findMany: vi.fn() } },
}));

import { auth } from "@/lib/auth";
import { getCampusScope } from "@/lib/campus-scope";
import { prisma } from "@/lib/prisma";
import { GET } from "@/app/api/admin/enrollments/route";

describe("GET /api/admin/enrollments", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 without a session", async () => {
    (auth as any).mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns 403 for a STUDENT", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1", role: "STUDENT" } });
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("lists all active enrollments for ADMIN", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1", role: "ADMIN" } });
    (getCampusScope as any).mockResolvedValue({ type: "ALL" });
    (prisma.enrollment.findMany as any).mockResolvedValue([]);

    const res = await GET();
    expect(res.status).toBe(200);
    expect(prisma.enrollment.findMany).toHaveBeenCalledWith({
      where: { completedAt: null },
      orderBy: { enrolledAt: "asc" },
      include: {
        student: { include: { user: true, campus: true } },
        group: { include: { level: true } },
      },
    });
  });

  it("scopes to the caller's campus for STAFF", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u2", role: "STAFF" } });
    (getCampusScope as any).mockResolvedValue({ type: "CAMPUS_LIST", campusIds: ["c1"] });
    (prisma.enrollment.findMany as any).mockResolvedValue([]);

    await GET();
    expect(prisma.enrollment.findMany).toHaveBeenCalledWith({
      where: { completedAt: null, student: { campusId: { in: ["c1"] } } },
      orderBy: { enrolledAt: "asc" },
      include: {
        student: { include: { user: true, campus: true } },
        group: { include: { level: true } },
      },
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/api/admin-enrollments.test.ts`
Expected: FAIL — route doesn't exist yet.

- [ ] **Step 3: Implement**

`src/app/api/admin/enrollments/route.ts`:
```ts
import { auth } from "@/lib/auth";
import { getCampusScope } from "@/lib/campus-scope";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }
  const role = (session.user as { role: string }).role;
  if (role !== "ADMIN" && role !== "STAFF") {
    return Response.json({ error: "No autorizado" }, { status: 403 });
  }

  const scope = await getCampusScope(session.user as { id: string; role: any });
  const where: Prisma.EnrollmentWhereInput =
    scope.type === "ALL"
      ? { completedAt: null }
      : scope.type === "CAMPUS_LIST"
        ? { completedAt: null, student: { campusId: { in: scope.campusIds } } }
        : { id: { in: [] } };

  const enrollments = await prisma.enrollment.findMany({
    where,
    orderBy: { enrolledAt: "asc" },
    include: {
      student: { include: { user: true, campus: true } },
      group: { include: { level: true } },
    },
  });

  return Response.json(enrollments);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/api/admin-enrollments.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/app/api/admin/enrollments tests/api/admin-enrollments.test.ts
git commit -m "feat: add GET /api/admin/enrollments listing active enrollments"
```

---

### Task 3: POST /api/admin/reinscripciones

**Files:**
- Create: `src/app/api/admin/reinscripciones/route.ts`
- Test: `tests/api/admin-reinscripciones.test.ts`

**Interfaces:**
- Consumes: `auth`, `getCampusScope`, `prisma`.
- Produces: `POST /api/admin/reinscripciones` — `{ enrollmentId, newGroupId }` in, closes old + creates new enrollment atomically, consumed by Task 5's `ReenrollRowActions` component.

- [ ] **Step 1: Write the failing tests**

`tests/api/admin-reinscripciones.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/campus-scope", () => ({ getCampusScope: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    enrollment: { findUnique: vi.fn(), update: vi.fn(), create: vi.fn() },
    group: { findUnique: vi.fn() },
    $transaction: vi.fn((fn: any) => fn({
      enrollment: { update: vi.fn(), create: vi.fn().mockResolvedValue({ id: "e2" }) },
    })),
  },
}));

import { auth } from "@/lib/auth";
import { getCampusScope } from "@/lib/campus-scope";
import { prisma } from "@/lib/prisma";
import { POST } from "@/app/api/admin/reinscripciones/route";

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/admin/reinscripciones", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/admin/reinscripciones", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 without a session", async () => {
    (auth as any).mockResolvedValue(null);
    const res = await POST(jsonRequest({ enrollmentId: "e1", newGroupId: "g2" }));
    expect(res.status).toBe(401);
  });

  it("returns 403 for a STUDENT", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1", role: "STUDENT" } });
    const res = await POST(jsonRequest({ enrollmentId: "e1", newGroupId: "g2" }));
    expect(res.status).toBe(403);
  });

  it("returns 404 when the enrollment is outside the caller's scope", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u2", role: "STAFF" } });
    (getCampusScope as any).mockResolvedValue({ type: "CAMPUS_LIST", campusIds: ["c1"] });
    (prisma.enrollment.findUnique as any).mockResolvedValue({
      id: "e1",
      completedAt: null,
      student: { campusId: "c2" },
    });

    const res = await POST(jsonRequest({ enrollmentId: "e1", newGroupId: "g2" }));
    expect(res.status).toBe(404);
  });

  it("returns 400 when the enrollment is already completed", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1", role: "ADMIN" } });
    (getCampusScope as any).mockResolvedValue({ type: "ALL" });
    (prisma.enrollment.findUnique as any).mockResolvedValue({
      id: "e1",
      completedAt: new Date(),
      studentId: "s1",
      student: { campusId: "c1" },
    });

    const res = await POST(jsonRequest({ enrollmentId: "e1", newGroupId: "g2" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when the destination group is at a different campus", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1", role: "ADMIN" } });
    (getCampusScope as any).mockResolvedValue({ type: "ALL" });
    (prisma.enrollment.findUnique as any).mockResolvedValue({
      id: "e1",
      completedAt: null,
      studentId: "s1",
      student: { campusId: "c1" },
    });
    (prisma.group.findUnique as any).mockResolvedValue({ id: "g2", campusId: "c2" });

    const res = await POST(jsonRequest({ enrollmentId: "e1", newGroupId: "g2" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when the destination group does not exist", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1", role: "ADMIN" } });
    (getCampusScope as any).mockResolvedValue({ type: "ALL" });
    (prisma.enrollment.findUnique as any).mockResolvedValue({
      id: "e1",
      completedAt: null,
      studentId: "s1",
      student: { campusId: "c1" },
    });
    (prisma.group.findUnique as any).mockResolvedValue(null);

    const res = await POST(jsonRequest({ enrollmentId: "e1", newGroupId: "g2" }));
    expect(res.status).toBe(400);
  });

  it("re-enrolls successfully within a transaction", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1", role: "ADMIN" } });
    (getCampusScope as any).mockResolvedValue({ type: "ALL" });
    (prisma.enrollment.findUnique as any).mockResolvedValue({
      id: "e1",
      completedAt: null,
      studentId: "s1",
      student: { campusId: "c1" },
    });
    (prisma.group.findUnique as any).mockResolvedValue({ id: "g2", campusId: "c1" });

    const res = await POST(jsonRequest({ enrollmentId: "e1", newGroupId: "g2" }));
    expect(res.status).toBe(200);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/api/admin-reinscripciones.test.ts`
Expected: FAIL — route doesn't exist yet.

- [ ] **Step 3: Implement**

`src/app/api/admin/reinscripciones/route.ts`:
```ts
import { auth } from "@/lib/auth";
import { getCampusScope } from "@/lib/campus-scope";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }
  const role = (session.user as { role: string }).role;
  if (role !== "ADMIN" && role !== "STAFF") {
    return Response.json({ error: "No autorizado" }, { status: 403 });
  }

  let body: { enrollmentId?: string; newGroupId?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Cuerpo de la solicitud inválido" }, { status: 400 });
  }

  if (!body.enrollmentId || !body.newGroupId) {
    return Response.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const enrollment = await prisma.enrollment.findUnique({
    where: { id: body.enrollmentId },
    include: { student: true },
  });
  if (!enrollment) {
    return Response.json({ error: "No encontrado" }, { status: 404 });
  }

  const scope = await getCampusScope(session.user as { id: string; role: any });
  const inScope =
    scope.type === "ALL" ||
    (scope.type === "CAMPUS_LIST" && scope.campusIds.includes(enrollment.student.campusId));
  if (!inScope) {
    return Response.json({ error: "No encontrado" }, { status: 404 });
  }

  if (enrollment.completedAt !== null) {
    return Response.json({ error: "Esta inscripción ya fue completada" }, { status: 400 });
  }

  const newGroup = await prisma.group.findUnique({ where: { id: body.newGroupId } });
  if (!newGroup) {
    return Response.json({ error: "Grupo destino inválido" }, { status: 400 });
  }
  if (newGroup.campusId !== enrollment.student.campusId) {
    return Response.json({ error: "El grupo destino debe ser del mismo plantel" }, { status: 400 });
  }

  const newEnrollment = await prisma.$transaction(async (tx) => {
    await tx.enrollment.update({
      where: { id: enrollment.id },
      data: { completedAt: new Date() },
    });
    return tx.enrollment.create({
      data: { studentId: enrollment.studentId, groupId: newGroup.id },
    });
  });

  return Response.json(newEnrollment);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/api/admin-reinscripciones.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add src/app/api/admin/reinscripciones tests/api/admin-reinscripciones.test.ts
git commit -m "feat: add transactional re-enrollment endpoint"
```

---

### Task 4: ReenrollRowActions component

**Files:**
- Create: `src/components/admin/reenroll-row-actions.tsx`

**Interfaces:**
- Consumes: `POST /api/admin/reinscripciones` (Task 3).
- Produces: `ReenrollRowActions` component consumed by Task 5's page — takes `enrollmentId: string`, `groups: { id: string; label: string }[]` (candidate destination groups at the student's own campus).

- [ ] **Step 1: Implement**

`src/components/admin/reenroll-row-actions.tsx`:
```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function ReenrollRowActions({
  enrollmentId,
  groups,
}: {
  enrollmentId: string;
  groups: { id: string; label: string }[];
}) {
  const router = useRouter();
  const [groupId, setGroupId] = useState(groups[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleReenroll() {
    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/admin/reinscripciones", {
      method: "POST",
      body: JSON.stringify({ enrollmentId, newGroupId: groupId }),
      headers: { "Content-Type": "application/json" },
    });

    setSubmitting(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "No se pudo reinscribir");
      return;
    }

    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={groupId}
        onChange={(e) => setGroupId(e.target.value)}
        className="rounded-md border border-border px-2 py-1 text-xs"
        aria-label="Grupo destino"
      >
        {groups.map((g) => (
          <option key={g.id} value={g.id}>
            {g.label}
          </option>
        ))}
      </select>
      <Button type="button" onClick={handleReenroll} disabled={submitting || !groupId}>
        {submitting ? "Reinscribiendo..." : "Reinscribir"}
      </Button>
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
git add src/components/admin/reenroll-row-actions.tsx
git commit -m "feat: add ReenrollRowActions component"
```

---

### Task 5: Reinscripciones page and AdminNav entry

**Files:**
- Create: `src/app/admin/reinscripciones/page.tsx`
- Modify: `src/components/admin/admin-nav.tsx`

**Interfaces:**
- Consumes: `auth`, `getCampusScope`, `prisma`, `Table`/`TableRow`/`TableCell`/`TableHead`, `ReenrollRowActions` (Task 4).
- Produces: the `/admin/reinscripciones` route.

- [ ] **Step 1: Add Reinscripciones to AdminNav**

In `src/components/admin/admin-nav.tsx`, add `{ href: "/admin/reinscripciones", label: "Reinscripciones" }` to the `MODULES` array (after Cobranzas).

- [ ] **Step 2: Reinscripciones page**

`src/app/admin/reinscripciones/page.tsx`:
```tsx
import { auth } from "@/lib/auth";
import { getCampusScope } from "@/lib/campus-scope";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { Table, TableRow, TableCell, TableHead } from "@/components/ui/table";
import { ReenrollRowActions } from "@/components/admin/reenroll-row-actions";

export default async function ReinscripcionesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const role = (session.user as { role: string }).role;
  if (role !== "ADMIN" && role !== "STAFF") redirect("/portal");

  const scope = await getCampusScope(session.user as { id: string; role: any });

  const enrollmentWhere: Prisma.EnrollmentWhereInput =
    scope.type === "ALL"
      ? { completedAt: null }
      : scope.type === "CAMPUS_LIST"
        ? { completedAt: null, student: { campusId: { in: scope.campusIds } } }
        : { id: { in: [] } };

  const enrollments = await prisma.enrollment.findMany({
    where: enrollmentWhere,
    orderBy: { enrolledAt: "asc" },
    include: {
      student: { include: { user: true, campus: true } },
      group: { include: { level: true } },
    },
  });

  const campusIds = [...new Set(enrollments.map((e) => e.student.campusId))];
  const groups = campusIds.length
    ? await prisma.group.findMany({
        where: { campusId: { in: campusIds } },
        include: { level: true },
      })
    : [];

  return (
    <div>
      <h1 className="text-lg font-semibold">Reinscripciones</h1>
      <p className="mt-1 text-sm text-muted">
        Alumnos con inscripción activa. Selecciona el grupo destino y reinscribe.
      </p>
      <div className="mt-6 overflow-x-auto">
        <Table>
          <thead>
            <TableRow>
              <TableHead>Alumno</TableHead>
              <TableHead>Plantel</TableHead>
              <TableHead>Grupo actual</TableHead>
              <TableHead>Reinscribir a</TableHead>
            </TableRow>
          </thead>
          <tbody>
            {enrollments.map((enrollment) => {
              const campusGroups = groups
                .filter((g) => g.campusId === enrollment.student.campusId && g.id !== enrollment.groupId)
                .map((g) => ({ id: g.id, label: `${g.level.code} · ${g.name}` }));

              return (
                <TableRow key={enrollment.id}>
                  <TableCell>{enrollment.student.user.name}</TableCell>
                  <TableCell>{enrollment.student.campus.name}</TableCell>
                  <TableCell>
                    {enrollment.group.level.code} · {enrollment.group.name}
                  </TableCell>
                  <TableCell>
                    {campusGroups.length > 0 ? (
                      <ReenrollRowActions enrollmentId={enrollment.id} groups={campusGroups} />
                    ) : (
                      <span className="text-xs text-muted">Sin otros grupos disponibles</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </tbody>
        </Table>
        {enrollments.length === 0 && (
          <p className="mt-6 text-center text-sm text-muted">
            No hay inscripciones activas que mostrar.
          </p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify it builds**

Run: kill any running `next dev` (`pgrep -f "next dev" | xargs -r kill`), then `npm run build`.
Expected: `/admin/reinscripciones` compiles as a dynamic route.

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/reinscripciones src/components/admin/admin-nav.tsx
git commit -m "feat: add Reinscripciones page"
```

---

## Post-plan checklist

- [ ] `npm test` — all suites pass
- [ ] `npx tsc --noEmit` — no type errors
- [ ] `npm run build` — production build succeeds, `/admin/reinscripciones` listed
- [ ] Manual smoke test: as admin, re-enroll the seeded student from A1 into a different group; confirm the old enrollment shows `completedAt` set and a new active enrollment exists
