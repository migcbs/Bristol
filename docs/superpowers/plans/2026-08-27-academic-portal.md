# Bristol Portal Académico Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Spec 3a (Portal Académico) — teachers publish a weekly schedule, link-based class materials, and grades for their own groups; students/parents see the schedule, materials, and grades for their own/their children's groups.

**Architecture:** Three new models (`ScheduleSlot`, `Material` tied to `Group`; `Grade` tied to `Enrollment`) and a new `src/lib/academic-access.ts` module with two read-scoping helpers (`getVisibleGroupIds`, `getVisibleEnrollmentIds`) shared by all three GET endpoints — a portal-side analogue to the admin-side `getCampusScope`, but keyed on group/enrollment visibility instead of campus. Writes (POST) always check `Group.teacherId === session.user.id` directly, per the pattern established in Gestión Escolar — never via a broader scope helper.

**Tech Stack:** Next.js 16 (App Router), Prisma/PostgreSQL, Vitest — established patterns from prior specs.

## Global Constraints

- Node ≥22 required — prepend node 22's bin dir to `PATH` before any npm/npx command.
- This repo lives on a network volume that spawns `._<filename>` AppleDouble junk files on write (gitignored); clean with `find . -name "._*" -not -path "./node_modules/*" -not -path "./.git/*" -delete` before build/test.
- TEACHER writes (`POST /api/portal/schedule`, `POST /api/portal/materials`, `POST /api/portal/grades`) always check `Group.teacherId === session.user.id` directly — never via `getVisibleGroupIds` or any other broader scope helper. `getVisibleGroupIds`/`getVisibleEnrollmentIds` are for READ access only (a TEACHER, STUDENT, or PARENT viewing something), and a read-scope function must never be reused to authorize a write.
- `Material`/`Grade` are immutable once created — no PATCH/PUT/DELETE route in this spec, matching `AttendanceRecord`/`Incident` from Gestión Escolar. `POST /api/portal/schedule` is the one exception: it deliberately REPLACES the full set of `ScheduleSlot` rows for a group in one transaction (delete-then-create), because a schedule is a single current state, not an append-only log — this is a documented, deliberate design choice, not an oversight.
- Every route handler must check session + role BEFORE any database query.
- All free-text/URL inputs get basic hygiene: `title` trimmed, non-empty after trim, and length-capped; `url` validated as a well-formed URL (via `new URL(url)` in a try/catch, not a regex) before persisting — this mirrors the trim/length/validation fixes the last two specs' final reviews required after merge; do it up front this time.
- Every task must leave `npm run build`, `npm test`, and `npx tsc --noEmit` passing.

---

## File Structure

```
prisma/
  schema.prisma                    # + ScheduleSlot, Material, Grade models
src/
  lib/
    academic-access.ts                 # NEW: getVisibleGroupIds, getVisibleEnrollmentIds
  app/
    api/
      portal/
        schedule/
          route.ts                        # POST, GET
        materials/
          route.ts                        # POST, GET
        grades/
          route.ts                        # POST, GET
    portal/
      horario/
        page.tsx                             # all three roles
      materiales/
        page.tsx                              # all three roles
      calificaciones/
        page.tsx                               # all three roles
  components/
    portal/
      schedule-form.tsx               # teacher: replace weekly schedule
      material-form.tsx                # teacher: add a material link
      grade-form.tsx                    # teacher: record a grade
      portal-nav.tsx                    # + Horario, Materiales, Calificaciones entries
tests/
  lib/
    academic-access.test.ts
  api/
    portal-schedule-post.test.ts
    portal-schedule-get.test.ts
    portal-materials-post.test.ts
    portal-materials-get.test.ts
    portal-grades-post.test.ts
    portal-grades-get.test.ts
```

---

### Task 1: ScheduleSlot, Material, Grade models

**Files:**
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Produces: `ScheduleSlot`, `Material`, `Grade` models, plus back-reference relations on `Group`, `User`, `Enrollment` — consumed by every later task.

- [ ] **Step 1: Add the models**

Add to `prisma/schema.prisma`:
```prisma
model ScheduleSlot {
  id        String   @id @default(cuid())
  groupId   String
  dayOfWeek Int
  startTime String
  endTime   String
  createdAt DateTime @default(now())

  group Group @relation(fields: [groupId], references: [id], onDelete: Cascade)
}

model Material {
  id           String   @id @default(cuid())
  groupId      String
  title        String
  url          String
  description  String?
  uploadedById String
  createdAt    DateTime @default(now())

  group      Group @relation(fields: [groupId], references: [id], onDelete: Cascade)
  uploadedBy User  @relation(fields: [uploadedById], references: [id], onDelete: Cascade)
}

model Grade {
  id           String   @id @default(cuid())
  enrollmentId String
  title        String
  score        Int
  maxScore     Int      @default(100)
  createdById  String
  createdAt    DateTime @default(now())

  enrollment Enrollment @relation(fields: [enrollmentId], references: [id], onDelete: Cascade)
  createdBy  User       @relation(fields: [createdById], references: [id], onDelete: Cascade)
}
```

Add the back-reference relation fields to the existing models:
- `Group`: add `scheduleSlots ScheduleSlot[]` and `materials Material[]`
- `User`: add `uploadedMaterials Material[]` and `createdGrades Grade[]`
- `Enrollment`: add `grades Grade[]`

- [ ] **Step 2: Run the migration**

Run: `npx prisma migrate dev --name add_schedule_materials_grades`
Expected: migration applies cleanly against the local `bristol` database.

- [ ] **Step 3: Verify**

Run: `npx prisma format --check` (fix with `npx prisma format` if needed), then `npx tsc --noEmit` (generate `.next/types` first via `npx next typegen` if `tsc` only complains about `LayoutProps<"/">` in `src/app/layout.tsx` — never edit that file).

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat: add ScheduleSlot, Material, and Grade models"
```

---

### Task 2: academic-access.ts — read-scoping helpers

**Files:**
- Create: `src/lib/academic-access.ts`
- Test: `tests/lib/academic-access.test.ts`

**Interfaces:**
- Produces: `getVisibleGroupIds(user)`, `getVisibleEnrollmentIds(user)` — consumed by Tasks 4, 6, 8's GET routes.

- [ ] **Step 1: Write the failing tests**

`tests/lib/academic-access.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    group: { findMany: vi.fn() },
    student: { findUnique: vi.fn() },
    enrollment: { findMany: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { getVisibleGroupIds, getVisibleEnrollmentIds } from "@/lib/academic-access";

describe("getVisibleGroupIds", () => {
  beforeEach(() => vi.clearAllMocks());

  it("TEACHER sees their own groups", async () => {
    (prisma.group.findMany as any).mockResolvedValue([{ id: "g1" }, { id: "g2" }]);
    const ids = await getVisibleGroupIds({ id: "t1", role: "TEACHER" as any });
    expect(prisma.group.findMany).toHaveBeenCalledWith({ where: { teacherId: "t1" }, select: { id: true } });
    expect(ids).toEqual(["g1", "g2"]);
  });

  it("STUDENT sees groups of their own active enrollments", async () => {
    (prisma.student.findUnique as any).mockResolvedValue({ id: "s1" });
    (prisma.enrollment.findMany as any).mockResolvedValue([{ groupId: "g1" }, { groupId: "g1" }]);
    const ids = await getVisibleGroupIds({ id: "u1", role: "STUDENT" as any });
    expect(prisma.enrollment.findMany).toHaveBeenCalledWith({
      where: { studentId: "s1", completedAt: null },
      select: { groupId: true },
    });
    expect(ids).toEqual(["g1"]);
  });

  it("STUDENT with no Student record returns an empty array", async () => {
    (prisma.student.findUnique as any).mockResolvedValue(null);
    const ids = await getVisibleGroupIds({ id: "u1", role: "STUDENT" as any });
    expect(ids).toEqual([]);
  });

  it("PARENT sees groups of all their children's active enrollments, deduplicated", async () => {
    (prisma.enrollment.findMany as any).mockResolvedValue([{ groupId: "g1" }, { groupId: "g2" }, { groupId: "g1" }]);
    const ids = await getVisibleGroupIds({ id: "p1", role: "PARENT" as any });
    expect(prisma.enrollment.findMany).toHaveBeenCalledWith({
      where: { completedAt: null, student: { parentLinks: { some: { parentUserId: "p1" } } } },
      select: { groupId: true },
    });
    expect(ids.sort()).toEqual(["g1", "g2"]);
  });

  it("ADMIN/STAFF get an empty array (not portal viewers)", async () => {
    expect(await getVisibleGroupIds({ id: "a1", role: "ADMIN" as any })).toEqual([]);
    expect(await getVisibleGroupIds({ id: "s1", role: "STAFF" as any })).toEqual([]);
  });
});

describe("getVisibleEnrollmentIds", () => {
  beforeEach(() => vi.clearAllMocks());

  it("TEACHER sees active enrollments in their own groups", async () => {
    (prisma.enrollment.findMany as any).mockResolvedValue([{ id: "e1" }]);
    const ids = await getVisibleEnrollmentIds({ id: "t1", role: "TEACHER" as any });
    expect(prisma.enrollment.findMany).toHaveBeenCalledWith({
      where: { completedAt: null, group: { teacherId: "t1" } },
      select: { id: true },
    });
    expect(ids).toEqual(["e1"]);
  });

  it("STUDENT sees their own active enrollments", async () => {
    (prisma.student.findUnique as any).mockResolvedValue({ id: "s1" });
    (prisma.enrollment.findMany as any).mockResolvedValue([{ id: "e1" }]);
    const ids = await getVisibleEnrollmentIds({ id: "u1", role: "STUDENT" as any });
    expect(prisma.enrollment.findMany).toHaveBeenCalledWith({
      where: { studentId: "s1", completedAt: null },
      select: { id: true },
    });
    expect(ids).toEqual(["e1"]);
  });

  it("PARENT sees active enrollments of all their children", async () => {
    (prisma.enrollment.findMany as any).mockResolvedValue([{ id: "e1" }, { id: "e2" }]);
    const ids = await getVisibleEnrollmentIds({ id: "p1", role: "PARENT" as any });
    expect(prisma.enrollment.findMany).toHaveBeenCalledWith({
      where: { completedAt: null, student: { parentLinks: { some: { parentUserId: "p1" } } } },
      select: { id: true },
    });
    expect(ids).toEqual(["e1", "e2"]);
  });

  it("ADMIN/STAFF get an empty array", async () => {
    expect(await getVisibleEnrollmentIds({ id: "a1", role: "ADMIN" as any })).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/lib/academic-access.test.ts`
Expected: FAIL — module doesn't exist yet.

- [ ] **Step 3: Implement**

`src/lib/academic-access.ts`:
```ts
import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";

/**
 * Group ids a portal user (TEACHER/STUDENT/PARENT) may READ from —
 * schedule and materials live at the Group level. Writes never use this:
 * a TEACHER's write authority is always checked directly against
 * Group.teacherId, per the pattern established in Gestión Escolar.
 */
export async function getVisibleGroupIds(user: { id: string; role: Role }): Promise<string[]> {
  switch (user.role) {
    case "TEACHER": {
      const rows = await prisma.group.findMany({
        where: { teacherId: user.id },
        select: { id: true },
      });
      return rows.map((r) => r.id);
    }
    case "STUDENT": {
      const student = await prisma.student.findUnique({
        where: { userId: user.id },
        select: { id: true },
      });
      if (!student) return [];
      const rows = await prisma.enrollment.findMany({
        where: { studentId: student.id, completedAt: null },
        select: { groupId: true },
      });
      return [...new Set(rows.map((r) => r.groupId))];
    }
    case "PARENT": {
      const rows = await prisma.enrollment.findMany({
        where: { completedAt: null, student: { parentLinks: { some: { parentUserId: user.id } } } },
        select: { groupId: true },
      });
      return [...new Set(rows.map((r) => r.groupId))];
    }
    default:
      return [];
  }
}

/**
 * Enrollment ids a portal user may READ grades from. Same role logic as
 * getVisibleGroupIds, but resolved directly to Enrollment ids since
 * Grade is keyed on enrollmentId, not groupId.
 */
export async function getVisibleEnrollmentIds(user: { id: string; role: Role }): Promise<string[]> {
  switch (user.role) {
    case "TEACHER": {
      const rows = await prisma.enrollment.findMany({
        where: { completedAt: null, group: { teacherId: user.id } },
        select: { id: true },
      });
      return rows.map((r) => r.id);
    }
    case "STUDENT": {
      const student = await prisma.student.findUnique({
        where: { userId: user.id },
        select: { id: true },
      });
      if (!student) return [];
      const rows = await prisma.enrollment.findMany({
        where: { studentId: student.id, completedAt: null },
        select: { id: true },
      });
      return rows.map((r) => r.id);
    }
    case "PARENT": {
      const rows = await prisma.enrollment.findMany({
        where: { completedAt: null, student: { parentLinks: { some: { parentUserId: user.id } } } },
        select: { id: true },
      });
      return rows.map((r) => r.id);
    }
    default:
      return [];
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/lib/academic-access.test.ts`
Expected: PASS (all cases)

- [ ] **Step 5: Commit**

```bash
git add src/lib/academic-access.ts tests/lib/academic-access.test.ts
git commit -m "feat: add academic-access read-scoping helpers"
```

---

### Task 3: POST /api/portal/schedule

**Files:**
- Create: `src/app/api/portal/schedule/route.ts` (POST; GET added in Task 4)
- Test: `tests/api/portal-schedule-post.test.ts`

**Interfaces:**
- Consumes: `auth`, `prisma`.
- Produces: `POST /api/portal/schedule` — consumed by Task 9's `ScheduleForm`.

- [ ] **Step 1: Write the failing tests**

`tests/api/portal-schedule-post.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    group: { findUnique: vi.fn() },
    $transaction: vi.fn(),
    scheduleSlot: { deleteMany: vi.fn(), createMany: vi.fn() },
  },
}));

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { POST } from "@/app/api/portal/schedule/route";

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/portal/schedule", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

const VALID_BODY = {
  groupId: "g1",
  slots: [{ dayOfWeek: 1, startTime: "16:00", endTime: "18:00" }],
};

describe("POST /api/portal/schedule", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 without a session", async () => {
    (auth as any).mockResolvedValue(null);
    const res = await POST(jsonRequest(VALID_BODY));
    expect(res.status).toBe(401);
  });

  it("returns 403 for a non-TEACHER role", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1", role: "STAFF" } });
    const res = await POST(jsonRequest(VALID_BODY));
    expect(res.status).toBe(403);
  });

  it("returns 403 when the group is not the caller's own", async () => {
    (auth as any).mockResolvedValue({ user: { id: "t1", role: "TEACHER" } });
    (prisma.group.findUnique as any).mockResolvedValue({ id: "g1", teacherId: "t2" });
    const res = await POST(jsonRequest(VALID_BODY));
    expect(res.status).toBe(403);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("returns 400 when a slot has an out-of-range dayOfWeek", async () => {
    (auth as any).mockResolvedValue({ user: { id: "t1", role: "TEACHER" } });
    (prisma.group.findUnique as any).mockResolvedValue({ id: "g1", teacherId: "t1" });
    const res = await POST(
      jsonRequest({ groupId: "g1", slots: [{ dayOfWeek: 7, startTime: "16:00", endTime: "18:00" }] })
    );
    expect(res.status).toBe(400);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("returns 400 when startTime is not before endTime", async () => {
    (auth as any).mockResolvedValue({ user: { id: "t1", role: "TEACHER" } });
    (prisma.group.findUnique as any).mockResolvedValue({ id: "g1", teacherId: "t1" });
    const res = await POST(
      jsonRequest({ groupId: "g1", slots: [{ dayOfWeek: 1, startTime: "18:00", endTime: "16:00" }] })
    );
    expect(res.status).toBe(400);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("replaces the group's full slot set in a transaction on success", async () => {
    (auth as any).mockResolvedValue({ user: { id: "t1", role: "TEACHER" } });
    (prisma.group.findUnique as any).mockResolvedValue({ id: "g1", teacherId: "t1" });
    (prisma.$transaction as any).mockImplementation(async (fn: any) =>
      fn({
        scheduleSlot: {
          deleteMany: vi.fn().mockResolvedValue({ count: 2 }),
          createMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
      })
    );

    const res = await POST(jsonRequest(VALID_BODY));
    expect(res.status).toBe(201);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/api/portal-schedule-post.test.ts`
Expected: FAIL — route doesn't exist yet.

- [ ] **Step 3: Implement**

`src/app/api/portal/schedule/route.ts`:
```ts
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface SlotInput {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

function isValidSlot(slot: SlotInput): boolean {
  if (typeof slot.dayOfWeek !== "number" || slot.dayOfWeek < 0 || slot.dayOfWeek > 6) return false;
  if (typeof slot.startTime !== "string" || typeof slot.endTime !== "string") return false;
  return slot.startTime < slot.endTime;
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }
  const role = (session.user as { role: string }).role;
  if (role !== "TEACHER") {
    return Response.json({ error: "No autorizado" }, { status: 403 });
  }

  let body: { groupId?: string; slots?: SlotInput[] };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Cuerpo de la solicitud inválido" }, { status: 400 });
  }

  if (!body.groupId || !Array.isArray(body.slots)) {
    return Response.json({ error: "Datos inválidos" }, { status: 400 });
  }

  if (body.slots.some((s) => !isValidSlot(s))) {
    return Response.json({ error: "Uno o más bloques de horario son inválidos" }, { status: 400 });
  }

  const group = await prisma.group.findUnique({ where: { id: body.groupId } });
  if (!group) {
    return Response.json({ error: "Grupo no encontrado" }, { status: 404 });
  }
  if (group.teacherId !== (session.user as { id: string }).id) {
    return Response.json({ error: "No autorizado" }, { status: 403 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.scheduleSlot.deleteMany({ where: { groupId: body.groupId } });
    if (body.slots!.length > 0) {
      await tx.scheduleSlot.createMany({
        data: body.slots!.map((s) => ({
          groupId: body.groupId!,
          dayOfWeek: s.dayOfWeek,
          startTime: s.startTime,
          endTime: s.endTime,
        })),
      });
    }
  });

  return Response.json({ ok: true }, { status: 201 });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/api/portal-schedule-post.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add src/app/api/portal/schedule tests/api/portal-schedule-post.test.ts
git commit -m "feat: add POST /api/portal/schedule (replace-all weekly slots)"
```

---

### Task 4: GET /api/portal/schedule

**Files:**
- Modify: `src/app/api/portal/schedule/route.ts` (add GET alongside Task 3's POST)
- Test: `tests/api/portal-schedule-get.test.ts`

**Interfaces:**
- Consumes: `auth`, `getVisibleGroupIds`, `prisma`.
- Produces: `GET /api/portal/schedule` — consumed by Task 9's `/portal/horario` page.

- [ ] **Step 1: Write the failing tests**

`tests/api/portal-schedule-get.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/academic-access", () => ({ getVisibleGroupIds: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { scheduleSlot: { findMany: vi.fn() } },
}));

import { auth } from "@/lib/auth";
import { getVisibleGroupIds } from "@/lib/academic-access";
import { prisma } from "@/lib/prisma";
import { GET } from "@/app/api/portal/schedule/route";

function getRequest(qs: string) {
  return new Request(`http://localhost/api/portal/schedule${qs}`);
}

describe("GET /api/portal/schedule", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 without a session", async () => {
    (auth as any).mockResolvedValue(null);
    const res = await GET(getRequest(""));
    expect(res.status).toBe(401);
  });

  it("returns 404 when a specific groupId is not visible to the caller", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1", role: "STUDENT" } });
    (getVisibleGroupIds as any).mockResolvedValue(["g1"]);
    const res = await GET(getRequest("?groupId=g2"));
    expect(res.status).toBe(404);
    expect(prisma.scheduleSlot.findMany).not.toHaveBeenCalled();
  });

  it("returns the slots for a visible specific groupId", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1", role: "STUDENT" } });
    (getVisibleGroupIds as any).mockResolvedValue(["g1"]);
    (prisma.scheduleSlot.findMany as any).mockResolvedValue([]);

    const res = await GET(getRequest("?groupId=g1"));
    expect(res.status).toBe(200);
    expect(prisma.scheduleSlot.findMany).toHaveBeenCalledWith({
      where: { groupId: "g1" },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    });
  });

  it("with no groupId, returns slots for every group visible to the caller", async () => {
    (auth as any).mockResolvedValue({ user: { id: "t1", role: "TEACHER" } });
    (getVisibleGroupIds as any).mockResolvedValue(["g1", "g2"]);
    (prisma.scheduleSlot.findMany as any).mockResolvedValue([]);

    const res = await GET(getRequest(""));
    expect(res.status).toBe(200);
    expect(prisma.scheduleSlot.findMany).toHaveBeenCalledWith({
      where: { groupId: { in: ["g1", "g2"] } },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/api/portal-schedule-get.test.ts`
Expected: FAIL — GET export doesn't exist yet.

- [ ] **Step 3: Implement**

Add to `src/app/api/portal/schedule/route.ts` (same file as Task 3's POST):
```ts
import { getVisibleGroupIds } from "@/lib/academic-access";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const groupId = searchParams.get("groupId");

  const visibleGroupIds = await getVisibleGroupIds(session.user as { id: string; role: any });

  if (groupId) {
    if (!visibleGroupIds.includes(groupId)) {
      return Response.json({ error: "No encontrado" }, { status: 404 });
    }
    const slots = await prisma.scheduleSlot.findMany({
      where: { groupId },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    });
    return Response.json(slots);
  }

  const slots = await prisma.scheduleSlot.findMany({
    where: { groupId: { in: visibleGroupIds } },
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
  });
  return Response.json(slots);
}
```

Note: add the `import { getVisibleGroupIds } from "@/lib/academic-access";` line near the top of the file alongside the existing `auth`/`prisma` imports.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/api/portal-schedule-get.test.ts tests/api/portal-schedule-post.test.ts`
Expected: PASS (both files)

- [ ] **Step 5: Commit**

```bash
git add src/app/api/portal/schedule tests/api/portal-schedule-get.test.ts
git commit -m "feat: add GET /api/portal/schedule"
```

---

### Task 5: POST /api/portal/materials

**Files:**
- Create: `src/app/api/portal/materials/route.ts` (POST; GET added in Task 6)
- Test: `tests/api/portal-materials-post.test.ts`

**Interfaces:**
- Consumes: `auth`, `prisma`.
- Produces: `POST /api/portal/materials` — consumed by Task 10's `MaterialForm`.

- [ ] **Step 1: Write the failing tests**

`tests/api/portal-materials-post.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { group: { findUnique: vi.fn() }, material: { create: vi.fn() } },
}));

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { POST } from "@/app/api/portal/materials/route";

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/portal/materials", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

const VALID_BODY = { groupId: "g1", title: "Guía de verbos", url: "https://drive.google.com/x" };

describe("POST /api/portal/materials", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 without a session", async () => {
    (auth as any).mockResolvedValue(null);
    const res = await POST(jsonRequest(VALID_BODY));
    expect(res.status).toBe(401);
  });

  it("returns 403 for a non-TEACHER role", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1", role: "STUDENT" } });
    const res = await POST(jsonRequest(VALID_BODY));
    expect(res.status).toBe(403);
  });

  it("returns 403 when the group is not the caller's own", async () => {
    (auth as any).mockResolvedValue({ user: { id: "t1", role: "TEACHER" } });
    (prisma.group.findUnique as any).mockResolvedValue({ id: "g1", teacherId: "t2" });
    const res = await POST(jsonRequest(VALID_BODY));
    expect(res.status).toBe(403);
    expect(prisma.material.create).not.toHaveBeenCalled();
  });

  it("returns 400 for a malformed url", async () => {
    (auth as any).mockResolvedValue({ user: { id: "t1", role: "TEACHER" } });
    (prisma.group.findUnique as any).mockResolvedValue({ id: "g1", teacherId: "t1" });
    const res = await POST(jsonRequest({ groupId: "g1", title: "x", url: "not-a-url" }));
    expect(res.status).toBe(400);
    expect(prisma.material.create).not.toHaveBeenCalled();
  });

  it("returns 400 for a blank title", async () => {
    (auth as any).mockResolvedValue({ user: { id: "t1", role: "TEACHER" } });
    (prisma.group.findUnique as any).mockResolvedValue({ id: "g1", teacherId: "t1" });
    const res = await POST(jsonRequest({ groupId: "g1", title: "   ", url: "https://x.com" }));
    expect(res.status).toBe(400);
  });

  it("creates the material on success, trimming the title", async () => {
    (auth as any).mockResolvedValue({ user: { id: "t1", role: "TEACHER" } });
    (prisma.group.findUnique as any).mockResolvedValue({ id: "g1", teacherId: "t1" });
    (prisma.material.create as any).mockResolvedValue({ id: "m1" });

    const res = await POST(jsonRequest({ ...VALID_BODY, title: "  Guía de verbos  " }));
    expect(res.status).toBe(201);
    expect(prisma.material.create).toHaveBeenCalledWith({
      data: {
        groupId: "g1",
        title: "Guía de verbos",
        url: "https://drive.google.com/x",
        description: null,
        uploadedById: "t1",
      },
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/api/portal-materials-post.test.ts`
Expected: FAIL — route doesn't exist yet.

- [ ] **Step 3: Implement**

`src/app/api/portal/materials/route.ts`:
```ts
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const MAX_TITLE_LENGTH = 200;

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }
  const role = (session.user as { role: string }).role;
  if (role !== "TEACHER") {
    return Response.json({ error: "No autorizado" }, { status: 403 });
  }

  let body: { groupId?: string; title?: string; url?: string; description?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Cuerpo de la solicitud inválido" }, { status: 400 });
  }

  if (!body.groupId || typeof body.title !== "string" || typeof body.url !== "string") {
    return Response.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const title = body.title.trim();
  if (!title || title.length > MAX_TITLE_LENGTH) {
    return Response.json({ error: "Título inválido" }, { status: 400 });
  }

  try {
    new URL(body.url);
  } catch {
    return Response.json({ error: "El enlace no es una URL válida" }, { status: 400 });
  }

  const group = await prisma.group.findUnique({ where: { id: body.groupId } });
  if (!group) {
    return Response.json({ error: "Grupo no encontrado" }, { status: 404 });
  }
  if (group.teacherId !== (session.user as { id: string }).id) {
    return Response.json({ error: "No autorizado" }, { status: 403 });
  }

  const material = await prisma.material.create({
    data: {
      groupId: body.groupId,
      title,
      url: body.url,
      description: body.description?.trim() || null,
      uploadedById: (session.user as { id: string }).id,
    },
  });

  return Response.json(material, { status: 201 });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/api/portal-materials-post.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add src/app/api/portal/materials tests/api/portal-materials-post.test.ts
git commit -m "feat: add POST /api/portal/materials"
```

---

### Task 6: GET /api/portal/materials

**Files:**
- Modify: `src/app/api/portal/materials/route.ts` (add GET alongside Task 5's POST)
- Test: `tests/api/portal-materials-get.test.ts`

**Interfaces:**
- Consumes: `auth`, `getVisibleGroupIds`, `prisma`.
- Produces: `GET /api/portal/materials` — consumed by Task 10's `/portal/materiales` page.

- [ ] **Step 1: Write the failing tests**

`tests/api/portal-materials-get.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/academic-access", () => ({ getVisibleGroupIds: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { material: { findMany: vi.fn() } },
}));

import { auth } from "@/lib/auth";
import { getVisibleGroupIds } from "@/lib/academic-access";
import { prisma } from "@/lib/prisma";
import { GET } from "@/app/api/portal/materials/route";

function getRequest(qs: string) {
  return new Request(`http://localhost/api/portal/materials${qs}`);
}

describe("GET /api/portal/materials", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 without a session", async () => {
    (auth as any).mockResolvedValue(null);
    const res = await GET(getRequest(""));
    expect(res.status).toBe(401);
  });

  it("returns 404 when a specific groupId is not visible to the caller", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1", role: "PARENT" } });
    (getVisibleGroupIds as any).mockResolvedValue(["g1"]);
    const res = await GET(getRequest("?groupId=g2"));
    expect(res.status).toBe(404);
    expect(prisma.material.findMany).not.toHaveBeenCalled();
  });

  it("returns materials for a visible specific groupId, most recent first", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1", role: "PARENT" } });
    (getVisibleGroupIds as any).mockResolvedValue(["g1"]);
    (prisma.material.findMany as any).mockResolvedValue([]);

    const res = await GET(getRequest("?groupId=g1"));
    expect(res.status).toBe(200);
    expect(prisma.material.findMany).toHaveBeenCalledWith({
      where: { groupId: "g1" },
      orderBy: { createdAt: "desc" },
      include: { uploadedBy: { select: { id: true, name: true } } },
    });
  });

  it("with no groupId, returns materials for every group visible to the caller", async () => {
    (auth as any).mockResolvedValue({ user: { id: "t1", role: "TEACHER" } });
    (getVisibleGroupIds as any).mockResolvedValue(["g1", "g2"]);
    (prisma.material.findMany as any).mockResolvedValue([]);

    const res = await GET(getRequest(""));
    expect(res.status).toBe(200);
    expect(prisma.material.findMany).toHaveBeenCalledWith({
      where: { groupId: { in: ["g1", "g2"] } },
      orderBy: { createdAt: "desc" },
      include: { uploadedBy: { select: { id: true, name: true } } },
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/api/portal-materials-get.test.ts`
Expected: FAIL — GET export doesn't exist yet.

- [ ] **Step 3: Implement**

Add to `src/app/api/portal/materials/route.ts` (same file as Task 5's POST):
```ts
import { getVisibleGroupIds } from "@/lib/academic-access";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const groupId = searchParams.get("groupId");

  const visibleGroupIds = await getVisibleGroupIds(session.user as { id: string; role: any });

  if (groupId) {
    if (!visibleGroupIds.includes(groupId)) {
      return Response.json({ error: "No encontrado" }, { status: 404 });
    }
    const materials = await prisma.material.findMany({
      where: { groupId },
      orderBy: { createdAt: "desc" },
      include: { uploadedBy: { select: { id: true, name: true } } },
    });
    return Response.json(materials);
  }

  const materials = await prisma.material.findMany({
    where: { groupId: { in: visibleGroupIds } },
    orderBy: { createdAt: "desc" },
    include: { uploadedBy: { select: { id: true, name: true } } },
  });
  return Response.json(materials);
}
```

Add the `import { getVisibleGroupIds } from "@/lib/academic-access";` line near the top of the file alongside the existing imports.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/api/portal-materials-get.test.ts tests/api/portal-materials-post.test.ts`
Expected: PASS (both files)

- [ ] **Step 5: Commit**

```bash
git add src/app/api/portal/materials tests/api/portal-materials-get.test.ts
git commit -m "feat: add GET /api/portal/materials"
```

---

### Task 7: POST /api/portal/grades

**Files:**
- Create: `src/app/api/portal/grades/route.ts` (POST; GET added in Task 8)
- Test: `tests/api/portal-grades-post.test.ts`

**Interfaces:**
- Consumes: `auth`, `prisma`.
- Produces: `POST /api/portal/grades` — consumed by Task 11's `GradeForm`.

- [ ] **Step 1: Write the failing tests**

`tests/api/portal-grades-post.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { enrollment: { findUnique: vi.fn() }, grade: { create: vi.fn() } },
}));

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { POST } from "@/app/api/portal/grades/route";

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/portal/grades", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

const VALID_BODY = { enrollmentId: "e1", title: "Examen parcial 1", score: 85, maxScore: 100 };

describe("POST /api/portal/grades", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 without a session", async () => {
    (auth as any).mockResolvedValue(null);
    const res = await POST(jsonRequest(VALID_BODY));
    expect(res.status).toBe(401);
  });

  it("returns 403 for a non-TEACHER role", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1", role: "PARENT" } });
    const res = await POST(jsonRequest(VALID_BODY));
    expect(res.status).toBe(403);
  });

  it("returns 404 when the enrollment doesn't exist", async () => {
    (auth as any).mockResolvedValue({ user: { id: "t1", role: "TEACHER" } });
    (prisma.enrollment.findUnique as any).mockResolvedValue(null);
    const res = await POST(jsonRequest(VALID_BODY));
    expect(res.status).toBe(404);
  });

  it("returns 403 when the enrollment's group is not the caller's own", async () => {
    (auth as any).mockResolvedValue({ user: { id: "t1", role: "TEACHER" } });
    (prisma.enrollment.findUnique as any).mockResolvedValue({
      id: "e1",
      completedAt: null,
      group: { teacherId: "t2" },
    });
    const res = await POST(jsonRequest(VALID_BODY));
    expect(res.status).toBe(403);
    expect(prisma.grade.create).not.toHaveBeenCalled();
  });

  it("returns 400 when the enrollment is not active", async () => {
    (auth as any).mockResolvedValue({ user: { id: "t1", role: "TEACHER" } });
    (prisma.enrollment.findUnique as any).mockResolvedValue({
      id: "e1",
      completedAt: new Date(),
      group: { teacherId: "t1" },
    });
    const res = await POST(jsonRequest(VALID_BODY));
    expect(res.status).toBe(400);
  });

  it("returns 400 when score is out of range or maxScore is not positive", async () => {
    (auth as any).mockResolvedValue({ user: { id: "t1", role: "TEACHER" } });
    (prisma.enrollment.findUnique as any).mockResolvedValue({
      id: "e1",
      completedAt: null,
      group: { teacherId: "t1" },
    });

    const tooHigh = await POST(jsonRequest({ ...VALID_BODY, score: 150 }));
    expect(tooHigh.status).toBe(400);

    const negative = await POST(jsonRequest({ ...VALID_BODY, score: -5 }));
    expect(negative.status).toBe(400);

    const zeroMax = await POST(jsonRequest({ ...VALID_BODY, maxScore: 0 }));
    expect(zeroMax.status).toBe(400);

    expect(prisma.grade.create).not.toHaveBeenCalled();
  });

  it("creates the grade on success, defaulting maxScore to 100 when omitted", async () => {
    (auth as any).mockResolvedValue({ user: { id: "t1", role: "TEACHER" } });
    (prisma.enrollment.findUnique as any).mockResolvedValue({
      id: "e1",
      completedAt: null,
      group: { teacherId: "t1" },
    });
    (prisma.grade.create as any).mockResolvedValue({ id: "gr1" });

    const res = await POST(jsonRequest({ enrollmentId: "e1", title: "Examen parcial 1", score: 85 }));
    expect(res.status).toBe(201);
    expect(prisma.grade.create).toHaveBeenCalledWith({
      data: { enrollmentId: "e1", title: "Examen parcial 1", score: 85, maxScore: 100, createdById: "t1" },
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/api/portal-grades-post.test.ts`
Expected: FAIL — route doesn't exist yet.

- [ ] **Step 3: Implement**

`src/app/api/portal/grades/route.ts`:
```ts
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const MAX_TITLE_LENGTH = 200;

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }
  const role = (session.user as { role: string }).role;
  if (role !== "TEACHER") {
    return Response.json({ error: "No autorizado" }, { status: 403 });
  }

  let body: { enrollmentId?: string; title?: string; score?: number; maxScore?: number };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Cuerpo de la solicitud inválido" }, { status: 400 });
  }

  if (
    !body.enrollmentId ||
    typeof body.title !== "string" ||
    typeof body.score !== "number" ||
    !Number.isFinite(body.score)
  ) {
    return Response.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const title = body.title.trim();
  if (!title || title.length > MAX_TITLE_LENGTH) {
    return Response.json({ error: "Título inválido" }, { status: 400 });
  }

  const maxScore = body.maxScore ?? 100;
  if (!Number.isFinite(maxScore) || maxScore <= 0) {
    return Response.json({ error: "maxScore debe ser mayor que cero" }, { status: 400 });
  }
  if (body.score < 0 || body.score > maxScore) {
    return Response.json({ error: "La calificación está fuera de rango" }, { status: 400 });
  }

  const enrollment = await prisma.enrollment.findUnique({
    where: { id: body.enrollmentId },
    include: { group: true },
  });
  if (!enrollment) {
    return Response.json({ error: "Inscripción no encontrada" }, { status: 404 });
  }
  if (enrollment.group.teacherId !== (session.user as { id: string }).id) {
    return Response.json({ error: "No autorizado" }, { status: 403 });
  }
  if (enrollment.completedAt !== null) {
    return Response.json({ error: "La inscripción ya no está activa" }, { status: 400 });
  }

  const grade = await prisma.grade.create({
    data: {
      enrollmentId: body.enrollmentId,
      title,
      score: body.score,
      maxScore,
      createdById: (session.user as { id: string }).id,
    },
  });

  return Response.json(grade, { status: 201 });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/api/portal-grades-post.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add src/app/api/portal/grades tests/api/portal-grades-post.test.ts
git commit -m "feat: add POST /api/portal/grades"
```

---

### Task 8: GET /api/portal/grades

**Files:**
- Modify: `src/app/api/portal/grades/route.ts` (add GET alongside Task 7's POST)
- Test: `tests/api/portal-grades-get.test.ts`

**Interfaces:**
- Consumes: `auth`, `getVisibleEnrollmentIds`, `prisma`.
- Produces: `GET /api/portal/grades` — consumed by Task 11's `/portal/calificaciones` page.

- [ ] **Step 1: Write the failing tests**

`tests/api/portal-grades-get.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/academic-access", () => ({ getVisibleEnrollmentIds: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { grade: { findMany: vi.fn() } },
}));

import { auth } from "@/lib/auth";
import { getVisibleEnrollmentIds } from "@/lib/academic-access";
import { prisma } from "@/lib/prisma";
import { GET } from "@/app/api/portal/grades/route";

function getRequest(qs: string) {
  return new Request(`http://localhost/api/portal/grades${qs}`);
}

describe("GET /api/portal/grades", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 without a session", async () => {
    (auth as any).mockResolvedValue(null);
    const res = await GET(getRequest(""));
    expect(res.status).toBe(401);
  });

  it("returns 404 when a specific enrollmentId is not visible to the caller", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1", role: "STUDENT" } });
    (getVisibleEnrollmentIds as any).mockResolvedValue(["e1"]);
    const res = await GET(getRequest("?enrollmentId=e2"));
    expect(res.status).toBe(404);
    expect(prisma.grade.findMany).not.toHaveBeenCalled();
  });

  it("returns grades for a visible specific enrollmentId, most recent first", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1", role: "STUDENT" } });
    (getVisibleEnrollmentIds as any).mockResolvedValue(["e1"]);
    (prisma.grade.findMany as any).mockResolvedValue([]);

    const res = await GET(getRequest("?enrollmentId=e1"));
    expect(res.status).toBe(200);
    expect(prisma.grade.findMany).toHaveBeenCalledWith({
      where: { enrollmentId: "e1" },
      orderBy: { createdAt: "desc" },
    });
  });

  it("with no enrollmentId, returns grades for every enrollment visible to the caller", async () => {
    (auth as any).mockResolvedValue({ user: { id: "p1", role: "PARENT" } });
    (getVisibleEnrollmentIds as any).mockResolvedValue(["e1", "e2"]);
    (prisma.grade.findMany as any).mockResolvedValue([]);

    const res = await GET(getRequest(""));
    expect(res.status).toBe(200);
    expect(prisma.grade.findMany).toHaveBeenCalledWith({
      where: { enrollmentId: { in: ["e1", "e2"] } },
      orderBy: { createdAt: "desc" },
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/api/portal-grades-get.test.ts`
Expected: FAIL — GET export doesn't exist yet.

- [ ] **Step 3: Implement**

Add to `src/app/api/portal/grades/route.ts` (same file as Task 7's POST):
```ts
import { getVisibleEnrollmentIds } from "@/lib/academic-access";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const enrollmentId = searchParams.get("enrollmentId");

  const visibleEnrollmentIds = await getVisibleEnrollmentIds(session.user as { id: string; role: any });

  if (enrollmentId) {
    if (!visibleEnrollmentIds.includes(enrollmentId)) {
      return Response.json({ error: "No encontrado" }, { status: 404 });
    }
    const grades = await prisma.grade.findMany({
      where: { enrollmentId },
      orderBy: { createdAt: "desc" },
    });
    return Response.json(grades);
  }

  const grades = await prisma.grade.findMany({
    where: { enrollmentId: { in: visibleEnrollmentIds } },
    orderBy: { createdAt: "desc" },
  });
  return Response.json(grades);
}
```

Add the `import { getVisibleEnrollmentIds } from "@/lib/academic-access";` line near the top of the file alongside the existing imports.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/api/portal-grades-get.test.ts tests/api/portal-grades-post.test.ts`
Expected: PASS (both files)

- [ ] **Step 5: Commit**

```bash
git add src/app/api/portal/grades tests/api/portal-grades-get.test.ts
git commit -m "feat: add GET /api/portal/grades"
```

---

### Task 9: Horario page

**Files:**
- Create: `src/components/portal/schedule-form.tsx`
- Create: `src/app/portal/horario/page.tsx`
- Modify: `src/components/portal/portal-nav.tsx`

**Interfaces:**
- Consumes: `auth`, `academic-access`, `prisma`, `POST`/`GET /api/portal/schedule` (Tasks 3-4), `Card`, `Button`.
- Produces: `/portal/horario`, plus Horario/Materiales/Calificaciones entries in `PortalNav` (all three added here in one edit, so Tasks 10-11 don't touch this file again).

- [ ] **Step 1: Add all three new entries to PortalNav in one edit**

In `src/components/portal/portal-nav.tsx`, extend the `MODULES` array to include, after the existing entries: `{ href: "/portal/horario", label: "Horario" }`, `{ href: "/portal/materiales", label: "Materiales" }`, `{ href: "/portal/calificaciones", label: "Calificaciones" }`.

- [ ] **Step 2: ScheduleForm (client component)**

Before writing this, check `src/components/ui/button.tsx` for the actual export name/props.

`src/components/portal/schedule-form.tsx`:
```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

const DAY_LABELS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

interface Slot {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

export function ScheduleForm({ groupId, initialSlots }: { groupId: string; initialSlots: Slot[] }) {
  const router = useRouter();
  const [slots, setSlots] = useState<Slot[]>(initialSlots.length > 0 ? initialSlots : [{ dayOfWeek: 1, startTime: "16:00", endTime: "18:00" }]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function updateSlot(index: number, patch: Partial<Slot>) {
    setSlots((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  function addSlot() {
    setSlots((prev) => [...prev, { dayOfWeek: 1, startTime: "16:00", endTime: "18:00" }]);
  }

  function removeSlot(index: number) {
    setSlots((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/portal/schedule", {
        method: "POST",
        body: JSON.stringify({ groupId, slots }),
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "No se pudo guardar el horario");
        return;
      }

      router.refresh();
    } catch {
      setError("No se pudo guardar el horario");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-border bg-white p-4">
      {slots.map((slot, i) => (
        <div key={i} className="flex flex-wrap items-center gap-2">
          <select
            value={slot.dayOfWeek}
            onChange={(e) => updateSlot(i, { dayOfWeek: Number(e.target.value) })}
            className="rounded-md border border-border px-2 py-1 text-sm"
          >
            {DAY_LABELS.map((label, day) => (
              <option key={day} value={day}>
                {label}
              </option>
            ))}
          </select>
          <input
            type="time"
            value={slot.startTime}
            onChange={(e) => updateSlot(i, { startTime: e.target.value })}
            className="rounded-md border border-border px-2 py-1 text-sm"
          />
          <span className="text-sm text-muted">a</span>
          <input
            type="time"
            value={slot.endTime}
            onChange={(e) => updateSlot(i, { endTime: e.target.value })}
            className="rounded-md border border-border px-2 py-1 text-sm"
          />
          <button
            type="button"
            onClick={() => removeSlot(i)}
            className="text-sm text-accent-dark"
          >
            Quitar
          </button>
        </div>
      ))}
      <button type="button" onClick={addSlot} className="text-sm text-primary underline">
        + Agregar bloque
      </button>
      {error && <p className="text-sm text-accent-dark">{error}</p>}
      <div>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Guardando..." : "Guardar horario"}
        </Button>
      </div>
    </form>
  );
}
```

- [ ] **Step 3: Horario page**

`src/app/portal/horario/page.tsx`:
```tsx
import { auth } from "@/lib/auth";
import { getVisibleGroupIds } from "@/lib/academic-access";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { ScheduleForm } from "@/components/portal/schedule-form";
import type { Role } from "@prisma/client";

const DAY_LABELS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

export default async function HorarioPage({
  searchParams,
}: {
  searchParams: Promise<{ groupId?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const role = (session.user as { role: Role }).role;
  if (role !== "TEACHER" && role !== "STUDENT" && role !== "PARENT") redirect("/admin");

  const user = { id: (session.user as { id: string }).id, role };
  const groupIds = await getVisibleGroupIds(user);

  if (groupIds.length === 0) {
    return (
      <div>
        <h1 className="text-lg font-semibold">Horario</h1>
        <p className="mt-2 text-sm text-muted">No hay grupos disponibles.</p>
      </div>
    );
  }

  const groups = await prisma.group.findMany({
    where: { id: { in: groupIds } },
    include: { level: true },
    orderBy: { name: "asc" },
  });

  const params = await searchParams;
  const selectedGroupId = groups.some((g) => g.id === params.groupId) ? params.groupId! : groups[0].id;

  const slots = await prisma.scheduleSlot.findMany({
    where: { groupId: selectedGroupId },
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
  });

  return (
    <div>
      <h1 className="text-lg font-semibold">Horario</h1>
      <form method="get" className="mt-4">
        <select name="groupId" defaultValue={selectedGroupId} className="rounded-md border border-border px-2 py-1 text-sm">
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.level.code} · {g.name}
            </option>
          ))}
        </select>
        <button type="submit" className="ml-2 rounded-md border border-border px-3 py-1 text-sm">
          Ver
        </button>
      </form>

      <div className="mt-6 space-y-3">
        {slots.length > 0 ? (
          slots.map((slot) => (
            <Card key={slot.id}>
              <p className="text-sm font-medium">
                {DAY_LABELS[slot.dayOfWeek]} · {slot.startTime}–{slot.endTime}
              </p>
            </Card>
          ))
        ) : (
          <p className="text-sm text-muted">Este grupo aún no tiene horario publicado.</p>
        )}
      </div>

      {role === "TEACHER" && (
        <div className="mt-8">
          <h2 className="text-sm font-semibold text-muted">Editar horario</h2>
          <div className="mt-3">
            <ScheduleForm
              groupId={selectedGroupId}
              initialSlots={slots.map((s) => ({
                dayOfWeek: s.dayOfWeek,
                startTime: s.startTime,
                endTime: s.endTime,
              }))}
            />
          </div>
        </div>
      )}
    </div>
  );
}
```

Note: for TEACHER, `getVisibleGroupIds` already returns only their own groups, so the edit form is always for a group they own — no additional ownership check is needed on this page (the API route re-verifies it anyway).

- [ ] **Step 4: Verify it builds**

Run: kill any running `next dev` (`pgrep -f "next dev" | xargs -r kill`), `rm -rf .next`, then `npm run build`.
Expected: `/portal/horario` compiles as a dynamic route.

- [ ] **Step 5: Commit**

```bash
git add src/components/portal/schedule-form.tsx src/app/portal/horario src/components/portal/portal-nav.tsx
git commit -m "feat: add horario (schedule) page"
```

---

### Task 10: Materiales page

**Files:**
- Create: `src/components/portal/material-form.tsx`
- Create: `src/app/portal/materiales/page.tsx`

**Interfaces:**
- Consumes: `auth`, `academic-access`, `prisma`, `POST /api/portal/materials` (Task 5), `Card`, `Button`.
- Produces: `/portal/materiales`.

- [ ] **Step 1: MaterialForm (client component)**

`src/components/portal/material-form.tsx`:
```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function MaterialForm({ groupId }: { groupId: string }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/portal/materials", {
        method: "POST",
        body: JSON.stringify({ groupId, title, url, description: description || undefined }),
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "No se pudo agregar el material");
        return;
      }

      setTitle("");
      setUrl("");
      setDescription("");
      router.refresh();
    } catch {
      setError("No se pudo agregar el material");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-border bg-white p-4">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Título"
        required
        className="w-full rounded-md border border-border px-3 py-2 text-sm"
      />
      <input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="Enlace (https://...)"
        required
        type="url"
        className="w-full rounded-md border border-border px-3 py-2 text-sm"
      />
      <input
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Descripción (opcional)"
        className="w-full rounded-md border border-border px-3 py-2 text-sm"
      />
      {error && <p className="text-sm text-accent-dark">{error}</p>}
      <Button type="submit" disabled={submitting}>
        {submitting ? "Agregando..." : "Agregar material"}
      </Button>
    </form>
  );
}
```

- [ ] **Step 2: Materiales page**

`src/app/portal/materiales/page.tsx`:
```tsx
import { auth } from "@/lib/auth";
import { getVisibleGroupIds } from "@/lib/academic-access";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { MaterialForm } from "@/components/portal/material-form";
import type { Role } from "@prisma/client";

export default async function MaterialesPage({
  searchParams,
}: {
  searchParams: Promise<{ groupId?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const role = (session.user as { role: Role }).role;
  if (role !== "TEACHER" && role !== "STUDENT" && role !== "PARENT") redirect("/admin");

  const user = { id: (session.user as { id: string }).id, role };
  const groupIds = await getVisibleGroupIds(user);

  if (groupIds.length === 0) {
    return (
      <div>
        <h1 className="text-lg font-semibold">Materiales</h1>
        <p className="mt-2 text-sm text-muted">No hay grupos disponibles.</p>
      </div>
    );
  }

  const groups = await prisma.group.findMany({
    where: { id: { in: groupIds } },
    include: { level: true },
    orderBy: { name: "asc" },
  });

  const params = await searchParams;
  const selectedGroupId = groups.some((g) => g.id === params.groupId) ? params.groupId! : groups[0].id;

  const materials = await prisma.material.findMany({
    where: { groupId: selectedGroupId },
    orderBy: { createdAt: "desc" },
    include: { uploadedBy: { select: { id: true, name: true } } },
  });

  return (
    <div>
      <h1 className="text-lg font-semibold">Materiales</h1>
      <form method="get" className="mt-4">
        <select name="groupId" defaultValue={selectedGroupId} className="rounded-md border border-border px-2 py-1 text-sm">
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.level.code} · {g.name}
            </option>
          ))}
        </select>
        <button type="submit" className="ml-2 rounded-md border border-border px-3 py-1 text-sm">
          Ver
        </button>
      </form>

      {role === "TEACHER" && (
        <div className="mt-6">
          <MaterialForm groupId={selectedGroupId} />
        </div>
      )}

      <div className="mt-6 space-y-3">
        {materials.map((m) => (
          <Card key={m.id}>
            <a href={m.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-primary underline">
              {m.title}
            </a>
            {m.description && <p className="mt-1 text-sm text-muted">{m.description}</p>}
            <p className="mt-2 text-xs text-muted">
              {m.uploadedBy.name} · {m.createdAt.toLocaleDateString("es-MX")}
            </p>
          </Card>
        ))}
        {materials.length === 0 && <p className="text-sm text-muted">Este grupo aún no tiene material publicado.</p>}
      </div>
    </div>
  );
}
```

Note: `rel="noopener noreferrer"` on the external link is required — the URL is teacher-authored, not attacker-controlled, but this is still the correct default for any `target="_blank"` link to an external, admin-editable destination.

- [ ] **Step 3: Verify it builds**

Run: `npm run build`
Expected: `/portal/materiales` compiles as a dynamic route.

- [ ] **Step 4: Commit**

```bash
git add src/components/portal/material-form.tsx src/app/portal/materiales
git commit -m "feat: add materiales (class materials) page"
```

---

### Task 11: Calificaciones page

**Files:**
- Create: `src/components/portal/grade-form.tsx`
- Create: `src/app/portal/calificaciones/page.tsx`

**Interfaces:**
- Consumes: `auth`, `academic-access`, `prisma`, `POST /api/portal/grades` (Task 7), `Card`, `Button`.
- Produces: `/portal/calificaciones`.

- [ ] **Step 1: GradeForm (client component)**

`src/components/portal/grade-form.tsx`:
```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function GradeForm({ students }: { students: { enrollmentId: string; name: string }[] }) {
  const router = useRouter();
  const [enrollmentId, setEnrollmentId] = useState(students[0]?.enrollmentId ?? "");
  const [title, setTitle] = useState("");
  const [score, setScore] = useState("");
  const [maxScore, setMaxScore] = useState("100");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/portal/grades", {
        method: "POST",
        body: JSON.stringify({
          enrollmentId,
          title,
          score: Number(score),
          maxScore: Number(maxScore),
        }),
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "No se pudo registrar la calificación");
        return;
      }

      setTitle("");
      setScore("");
      router.refresh();
    } catch {
      setError("No se pudo registrar la calificación");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-border bg-white p-4">
      <select
        value={enrollmentId}
        onChange={(e) => setEnrollmentId(e.target.value)}
        className="w-full rounded-md border border-border px-2 py-2 text-sm"
      >
        {students.map((s) => (
          <option key={s.enrollmentId} value={s.enrollmentId}>
            {s.name}
          </option>
        ))}
      </select>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Evaluación (p. ej. Examen parcial 1)"
        required
        className="w-full rounded-md border border-border px-3 py-2 text-sm"
      />
      <div className="flex items-center gap-2">
        <input
          value={score}
          onChange={(e) => setScore(e.target.value)}
          placeholder="Puntos"
          required
          type="number"
          min={0}
          className="w-24 rounded-md border border-border px-3 py-2 text-sm"
        />
        <span className="text-sm text-muted">de</span>
        <input
          value={maxScore}
          onChange={(e) => setMaxScore(e.target.value)}
          placeholder="Máximo"
          required
          type="number"
          min={1}
          className="w-24 rounded-md border border-border px-3 py-2 text-sm"
        />
      </div>
      {error && <p className="text-sm text-accent-dark">{error}</p>}
      <Button type="submit" disabled={submitting || !enrollmentId}>
        {submitting ? "Guardando..." : "Registrar calificación"}
      </Button>
    </form>
  );
}
```

- [ ] **Step 2: Calificaciones page**

`src/app/portal/calificaciones/page.tsx`:
```tsx
import { auth } from "@/lib/auth";
import { getVisibleEnrollmentIds } from "@/lib/academic-access";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { GradeForm } from "@/components/portal/grade-form";
import type { Role } from "@prisma/client";

export default async function CalificacionesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const role = (session.user as { role: Role }).role;
  if (role !== "TEACHER" && role !== "STUDENT" && role !== "PARENT") redirect("/admin");

  const user = { id: (session.user as { id: string }).id, role };
  const enrollmentIds = await getVisibleEnrollmentIds(user);

  const enrollments = await prisma.enrollment.findMany({
    where: { id: { in: enrollmentIds } },
    include: { student: { include: { user: { select: { id: true, name: true } } } }, group: true },
  });

  const grades = await prisma.grade.findMany({
    where: { enrollmentId: { in: enrollmentIds } },
    orderBy: { createdAt: "desc" },
  });

  const enrollmentById = new Map(enrollments.map((e) => [e.id, e]));

  return (
    <div>
      <h1 className="text-lg font-semibold">Calificaciones</h1>

      {role === "TEACHER" && enrollments.length > 0 && (
        <div className="mt-4">
          <GradeForm
            students={enrollments.map((e) => ({
              enrollmentId: e.id,
              name: `${e.student.user.name} (${e.group.name})`,
            }))}
          />
        </div>
      )}

      <div className="mt-6 space-y-3">
        {grades.map((grade) => {
          const enrollment = enrollmentById.get(grade.enrollmentId);
          return (
            <Card key={grade.id}>
              <p className="text-sm font-medium">{grade.title}</p>
              <p className="mt-1 text-sm text-muted">
                {enrollment ? `${enrollment.student.user.name} · ${enrollment.group.name}` : ""} — {grade.score}/{grade.maxScore}
              </p>
              <p className="mt-2 text-xs text-muted">{grade.createdAt.toLocaleDateString("es-MX")}</p>
            </Card>
          );
        })}
        {grades.length === 0 && <p className="text-sm text-muted">Aún no hay calificaciones registradas.</p>}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify it builds**

Run: `npm run build`
Expected: `/portal/calificaciones` compiles as a dynamic route.

- [ ] **Step 4: Commit**

```bash
git add src/components/portal/grade-form.tsx src/app/portal/calificaciones
git commit -m "feat: add calificaciones (grades) page"
```

---

## Post-plan checklist

- [ ] `npm test` — all suites pass
- [ ] `npx tsc --noEmit` — no type errors
- [ ] `npm run build` — production build succeeds, all new routes listed
- [ ] Manual smoke test: log in as the seeded teacher, publish a schedule and material for their group, register a grade for the seeded student; log in as the seeded student/parent and confirm all three are visible on `/portal/horario`, `/portal/materiales`, `/portal/calificaciones`
