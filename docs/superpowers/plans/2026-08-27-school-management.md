# Bristol Gestión Escolar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Spec 2d (Gestión Escolar) — a TEACHER can take attendance and log incidents for groups they teach; STAFF/ADMIN get read-only views scoped by campus.

**Architecture:** New `AttendanceRecord` (tied to `Enrollment`) and `Incident` models. Teacher-facing routes verify `Group.teacherId === session.user.id` directly (a new, narrower scoping rule than `getCampusScope`, since a teacher's authority is per-group, not per-campus). Staff/admin routes reuse the existing `getCampusScope` pattern via `student.campusId`.

**Tech Stack:** Next.js 16 (App Router), Prisma/PostgreSQL, Vitest — established patterns from prior specs.

## Global Constraints

- Node ≥22 required — `nvm use 22` before any `npm`/`npx` command.
- This repo lives on a network volume that spawns `._<filename>` AppleDouble junk files on write (already gitignored); clean with `find . -name "._*" -not -path "./node_modules/*" -not -path "./.git/*" -delete` if needed.
- Reuse `getCampusScope` from `src/lib/campus-scope.ts` for STAFF/ADMIN routes — fail-closed for any scope type other than `ALL`/`CAMPUS_LIST`.
- A TEACHER's authority is checked directly against `Group.teacherId === session.user.id` — do NOT reuse `getCampusScope` for teacher-facing writes, since a teacher's campus list is broader than the specific groups they're allowed to act on.
- Attendance records are immutable once created (no PATCH/PUT/DELETE route in this spec) — enforce "all or nothing" on the bulk-create endpoint via a Prisma `createMany` (which fails atomically on any unique-constraint violation) rather than looping individual `create` calls.
- Every route handler must check session + role BEFORE any database query.
- Every task must leave `npm run build`, `npm test`, and `npx tsc --noEmit` passing.

---

## File Structure

```
prisma/
  schema.prisma              # + AttendanceStatus enum, AttendanceRecord, Incident models
src/
  app/
    admin/
      incidencias/
        page.tsx                 # staff/admin read-only incident list
    portal/
      asistencia/
        page.tsx                   # teacher attendance UI
      incidencias/
        page.tsx                    # teacher incident form + own-incident list
    api/
      portal/
        groups/
          route.ts                    # GET
        attendance/
          route.ts                     # POST
        incidents/
          route.ts                      # POST
      admin/
        incidents/
          route.ts                       # GET
  components/
    portal/
      attendance-form.tsx           # client: roster + status selects + save
      incident-form.tsx              # client: student picker + description + submit
tests/
  api/
    portal-groups.test.ts
    portal-attendance.test.ts
    portal-incidents.test.ts
    admin-incidents.test.ts
```

---

### Task 1: AttendanceRecord and Incident models

**Files:**
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Produces: `AttendanceStatus` enum, `AttendanceRecord` model, `Incident` model, plus back-reference relations on `Enrollment`/`Student`/`Group`/`User` — consumed by every later task.

- [ ] **Step 1: Add the enum and models**

Add to `prisma/schema.prisma`:
```prisma
enum AttendanceStatus {
  PRESENT
  ABSENT
  LATE
  EXCUSED
}

model AttendanceRecord {
  id           String           @id @default(cuid())
  enrollmentId String
  date         DateTime         @db.Date
  status       AttendanceStatus
  createdAt    DateTime         @default(now())

  enrollment Enrollment @relation(fields: [enrollmentId], references: [id], onDelete: Cascade)

  @@unique([enrollmentId, date])
}

model Incident {
  id           String   @id @default(cuid())
  studentId    String
  groupId      String?
  reportedById String
  description  String
  createdAt    DateTime @default(now())

  student    Student @relation(fields: [studentId], references: [id], onDelete: Cascade)
  group      Group?  @relation(fields: [groupId], references: [id], onDelete: SetNull)
  reportedBy User    @relation(fields: [reportedById], references: [id], onDelete: Cascade)
}
```

Add the back-reference relation fields to the existing models (find each model and add one line to its relation list):
- `Enrollment`: add `attendanceRecords AttendanceRecord[]`
- `Student`: add `incidents Incident[]`
- `Group`: add `incidents Incident[]`
- `User`: add `reportedIncidents Incident[]`

- [ ] **Step 2: Run the migration**

Run: `npx prisma migrate dev --name add_attendance_and_incidents`
Expected: migration applies cleanly against the local `bristol` database.

- [ ] **Step 3: Verify build**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat: add AttendanceRecord and Incident models"
```

---

### Task 2: GET /api/portal/groups

**Files:**
- Create: `src/app/api/portal/groups/route.ts`
- Test: `tests/api/portal-groups.test.ts`

**Interfaces:**
- Consumes: `auth`, `prisma`.
- Produces: `GET /api/portal/groups` — the groups where `teacherId === session.user.id`, consumed by Task 6/7's pages as the group picker data source.

- [ ] **Step 1: Write the failing tests**

`tests/api/portal-groups.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { group: { findMany: vi.fn() } },
}));

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { GET } from "@/app/api/portal/groups/route";

describe("GET /api/portal/groups", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 without a session", async () => {
    (auth as any).mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns 403 for a non-TEACHER role", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1", role: "STAFF" } });
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("returns only the caller's own groups", async () => {
    (auth as any).mockResolvedValue({ user: { id: "t1", role: "TEACHER" } });
    (prisma.group.findMany as any).mockResolvedValue([]);

    const res = await GET();
    expect(res.status).toBe(200);
    expect(prisma.group.findMany).toHaveBeenCalledWith({
      where: { teacherId: "t1" },
      include: { level: true, campus: true },
      orderBy: { name: "asc" },
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/api/portal-groups.test.ts`
Expected: FAIL — route doesn't exist yet.

- [ ] **Step 3: Implement**

`src/app/api/portal/groups/route.ts`:
```ts
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }
  const role = (session.user as { role: string }).role;
  if (role !== "TEACHER") {
    return Response.json({ error: "No autorizado" }, { status: 403 });
  }

  const groups = await prisma.group.findMany({
    where: { teacherId: (session.user as { id: string }).id },
    include: { level: true, campus: true },
    orderBy: { name: "asc" },
  });

  return Response.json(groups);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/api/portal-groups.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/app/api/portal/groups tests/api/portal-groups.test.ts
git commit -m "feat: add GET /api/portal/groups for teacher's own groups"
```

---

### Task 3: POST /api/portal/attendance

**Files:**
- Create: `src/app/api/portal/attendance/route.ts`
- Test: `tests/api/portal-attendance.test.ts`

**Interfaces:**
- Consumes: `auth`, `prisma`.
- Produces: `POST /api/portal/attendance` — bulk-creates immutable attendance records for a teacher's own group, consumed by Task 6's `AttendanceForm`.

- [ ] **Step 1: Write the failing tests**

`tests/api/portal-attendance.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    group: { findUnique: vi.fn() },
    enrollment: { findMany: vi.fn() },
    attendanceRecord: { createMany: vi.fn() },
  },
}));

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { POST } from "@/app/api/portal/attendance/route";

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/portal/attendance", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

const VALID_BODY = {
  groupId: "g1",
  date: "2026-09-01",
  records: [{ enrollmentId: "e1", status: "PRESENT" }],
};

describe("POST /api/portal/attendance", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 without a session", async () => {
    (auth as any).mockResolvedValue(null);
    const res = await POST(jsonRequest(VALID_BODY));
    expect(res.status).toBe(401);
  });

  it("returns 403 when the group is not the caller's own", async () => {
    (auth as any).mockResolvedValue({ user: { id: "t1", role: "TEACHER" } });
    (prisma.group.findUnique as any).mockResolvedValue({ id: "g1", teacherId: "t2" });

    const res = await POST(jsonRequest(VALID_BODY));
    expect(res.status).toBe(403);
    expect(prisma.attendanceRecord.createMany).not.toHaveBeenCalled();
  });

  it("returns 400 when an enrollmentId is not an active enrollment in that group", async () => {
    (auth as any).mockResolvedValue({ user: { id: "t1", role: "TEACHER" } });
    (prisma.group.findUnique as any).mockResolvedValue({ id: "g1", teacherId: "t1" });
    (prisma.enrollment.findMany as any).mockResolvedValue([]);

    const res = await POST(jsonRequest(VALID_BODY));
    expect(res.status).toBe(400);
    expect(prisma.attendanceRecord.createMany).not.toHaveBeenCalled();
  });

  it("returns 400 when attendance for that date already exists (unique violation)", async () => {
    (auth as any).mockResolvedValue({ user: { id: "t1", role: "TEACHER" } });
    (prisma.group.findUnique as any).mockResolvedValue({ id: "g1", teacherId: "t1" });
    (prisma.enrollment.findMany as any).mockResolvedValue([{ id: "e1" }]);
    (prisma.attendanceRecord.createMany as any).mockRejectedValue(
      Object.assign(new Error("Unique constraint failed"), { code: "P2002" })
    );

    const res = await POST(jsonRequest(VALID_BODY));
    expect(res.status).toBe(400);
  });

  it("creates all records in one createMany call on success", async () => {
    (auth as any).mockResolvedValue({ user: { id: "t1", role: "TEACHER" } });
    (prisma.group.findUnique as any).mockResolvedValue({ id: "g1", teacherId: "t1" });
    (prisma.enrollment.findMany as any).mockResolvedValue([{ id: "e1" }]);
    (prisma.attendanceRecord.createMany as any).mockResolvedValue({ count: 1 });

    const res = await POST(jsonRequest(VALID_BODY));
    expect(res.status).toBe(201);
    expect(prisma.attendanceRecord.createMany).toHaveBeenCalledWith({
      data: [{ enrollmentId: "e1", date: new Date("2026-09-01"), status: "PRESENT" }],
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/api/portal-attendance.test.ts`
Expected: FAIL — route doesn't exist yet.

- [ ] **Step 3: Implement**

`src/app/api/portal/attendance/route.ts`:
```ts
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const VALID_STATUSES = ["PRESENT", "ABSENT", "LATE", "EXCUSED"];

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }
  const role = (session.user as { role: string }).role;
  if (role !== "TEACHER") {
    return Response.json({ error: "No autorizado" }, { status: 403 });
  }

  let body: {
    groupId?: string;
    date?: string;
    records?: { enrollmentId: string; status: string }[];
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Cuerpo de la solicitud inválido" }, { status: 400 });
  }

  if (!body.groupId || !body.date || !Array.isArray(body.records) || body.records.length === 0) {
    return Response.json({ error: "Datos inválidos" }, { status: 400 });
  }

  if (body.records.some((r) => !VALID_STATUSES.includes(r.status))) {
    return Response.json({ error: "Estatus de asistencia inválido" }, { status: 400 });
  }

  const group = await prisma.group.findUnique({ where: { id: body.groupId } });
  if (!group) {
    return Response.json({ error: "Grupo no encontrado" }, { status: 404 });
  }
  if (group.teacherId !== (session.user as { id: string }).id) {
    return Response.json({ error: "No autorizado" }, { status: 403 });
  }

  const activeEnrollments = await prisma.enrollment.findMany({
    where: {
      groupId: body.groupId,
      completedAt: null,
      id: { in: body.records.map((r) => r.enrollmentId) },
    },
  });
  if (activeEnrollments.length !== body.records.length) {
    return Response.json(
      { error: "Uno o más alumnos no tienen una inscripción activa en este grupo" },
      { status: 400 }
    );
  }

  const date = new Date(body.date);

  try {
    await prisma.attendanceRecord.createMany({
      data: body.records.map((r) => ({
        enrollmentId: r.enrollmentId,
        date,
        status: r.status as any,
      })),
    });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      return Response.json(
        { error: "Ya existe asistencia registrada para esta fecha" },
        { status: 400 }
      );
    }
    console.error("Error al guardar asistencia:", error);
    return Response.json({ error: "No se pudo guardar la asistencia" }, { status: 500 });
  }

  return Response.json({ ok: true }, { status: 201 });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/api/portal-attendance.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/app/api/portal/attendance tests/api/portal-attendance.test.ts
git commit -m "feat: add bulk attendance-taking endpoint for teachers"
```

---

### Task 4: POST /api/portal/incidents

**Files:**
- Create: `src/app/api/portal/incidents/route.ts`
- Test: `tests/api/portal-incidents.test.ts`

**Interfaces:**
- Consumes: `auth`, `getCampusScope`, `prisma`.
- Produces: `POST /api/portal/incidents` — consumed by Task 7's `IncidentForm`.

- [ ] **Step 1: Write the failing tests**

`tests/api/portal-incidents.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/campus-scope", () => ({ getCampusScope: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    group: { findUnique: vi.fn() },
    student: { findUnique: vi.fn() },
    enrollment: { findFirst: vi.fn() },
    incident: { create: vi.fn() },
  },
}));

import { auth } from "@/lib/auth";
import { getCampusScope } from "@/lib/campus-scope";
import { prisma } from "@/lib/prisma";
import { POST } from "@/app/api/portal/incidents/route";

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/portal/incidents", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/portal/incidents", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 without a session", async () => {
    (auth as any).mockResolvedValue(null);
    const res = await POST(jsonRequest({ studentId: "s1", description: "x" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 for a missing description", async () => {
    (auth as any).mockResolvedValue({ user: { id: "t1", role: "TEACHER" } });
    const res = await POST(jsonRequest({ studentId: "s1" }));
    expect(res.status).toBe(400);
  });

  it("returns 403 when groupId is provided but not the teacher's own group", async () => {
    (auth as any).mockResolvedValue({ user: { id: "t1", role: "TEACHER" } });
    (prisma.group.findUnique as any).mockResolvedValue({ id: "g1", teacherId: "t2" });

    const res = await POST(jsonRequest({ studentId: "s1", groupId: "g1", description: "x" }));
    expect(res.status).toBe(403);
    expect(prisma.incident.create).not.toHaveBeenCalled();
  });

  it("returns 400 when the student has no active enrollment in the specified group", async () => {
    (auth as any).mockResolvedValue({ user: { id: "t1", role: "TEACHER" } });
    (prisma.group.findUnique as any).mockResolvedValue({ id: "g1", teacherId: "t1" });
    (prisma.enrollment.findFirst as any).mockResolvedValue(null);

    const res = await POST(jsonRequest({ studentId: "s1", groupId: "g1", description: "x" }));
    expect(res.status).toBe(400);
  });

  it("returns 404 when no groupId is given and the student is outside the caller's campus scope", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u2", role: "STAFF" } });
    (getCampusScope as any).mockResolvedValue({ type: "CAMPUS_LIST", campusIds: ["c1"] });
    (prisma.student.findUnique as any).mockResolvedValue({ id: "s1", campusId: "c2" });

    const res = await POST(jsonRequest({ studentId: "s1", description: "x" }));
    expect(res.status).toBe(404);
  });

  it("creates the incident on success with a groupId", async () => {
    (auth as any).mockResolvedValue({ user: { id: "t1", role: "TEACHER" } });
    (prisma.group.findUnique as any).mockResolvedValue({ id: "g1", teacherId: "t1" });
    (prisma.enrollment.findFirst as any).mockResolvedValue({ id: "e1" });
    (prisma.incident.create as any).mockResolvedValue({ id: "i1" });

    const res = await POST(jsonRequest({ studentId: "s1", groupId: "g1", description: "Llegó tarde" }));
    expect(res.status).toBe(201);
    expect(prisma.incident.create).toHaveBeenCalledWith({
      data: { studentId: "s1", groupId: "g1", reportedById: "t1", description: "Llegó tarde" },
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/api/portal-incidents.test.ts`
Expected: FAIL — route doesn't exist yet.

- [ ] **Step 3: Implement**

`src/app/api/portal/incidents/route.ts`:
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
  if (role !== "TEACHER" && role !== "STAFF" && role !== "ADMIN") {
    return Response.json({ error: "No autorizado" }, { status: 403 });
  }

  let body: { studentId?: string; groupId?: string; description?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Cuerpo de la solicitud inválido" }, { status: 400 });
  }

  if (!body.studentId || !body.description) {
    return Response.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const userId = (session.user as { id: string }).id;

  if (body.groupId) {
    const group = await prisma.group.findUnique({ where: { id: body.groupId } });
    if (!group) {
      return Response.json({ error: "Grupo no encontrado" }, { status: 404 });
    }
    if (group.teacherId !== userId) {
      return Response.json({ error: "No autorizado" }, { status: 403 });
    }

    const enrollment = await prisma.enrollment.findFirst({
      where: { studentId: body.studentId, groupId: body.groupId, completedAt: null },
    });
    if (!enrollment) {
      return Response.json(
        { error: "El alumno no tiene una inscripción activa en ese grupo" },
        { status: 400 }
      );
    }
  } else {
    const student = await prisma.student.findUnique({ where: { id: body.studentId } });
    if (!student) {
      return Response.json({ error: "No encontrado" }, { status: 404 });
    }

    if (role !== "TEACHER") {
      const scope = await getCampusScope(session.user as { id: string; role: any });
      const inScope =
        scope.type === "ALL" ||
        (scope.type === "CAMPUS_LIST" && scope.campusIds.includes(student.campusId));
      if (!inScope) {
        return Response.json({ error: "No encontrado" }, { status: 404 });
      }
    }
  }

  const incident = await prisma.incident.create({
    data: {
      studentId: body.studentId,
      groupId: body.groupId ?? null,
      reportedById: userId,
      description: body.description,
    },
  });

  return Response.json(incident, { status: 201 });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/api/portal-incidents.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add src/app/api/portal/incidents tests/api/portal-incidents.test.ts
git commit -m "feat: add incident-reporting endpoint"
```

---

### Task 5: GET /api/admin/incidents

**Files:**
- Create: `src/app/api/admin/incidents/route.ts`
- Test: `tests/api/admin-incidents.test.ts`

**Interfaces:**
- Consumes: `auth`, `getCampusScope`, `prisma`.
- Produces: `GET /api/admin/incidents` — consumed by Task 8's admin page.

- [ ] **Step 1: Write the failing tests**

`tests/api/admin-incidents.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/campus-scope", () => ({ getCampusScope: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { incident: { findMany: vi.fn() } },
}));

import { auth } from "@/lib/auth";
import { getCampusScope } from "@/lib/campus-scope";
import { prisma } from "@/lib/prisma";
import { GET } from "@/app/api/admin/incidents/route";

describe("GET /api/admin/incidents", () => {
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

  it("lists all incidents for ADMIN", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1", role: "ADMIN" } });
    (getCampusScope as any).mockResolvedValue({ type: "ALL" });
    (prisma.incident.findMany as any).mockResolvedValue([]);

    const res = await GET();
    expect(res.status).toBe(200);
    expect(prisma.incident.findMany).toHaveBeenCalledWith({
      where: {},
      orderBy: { createdAt: "desc" },
      include: { student: { include: { user: true } }, reportedBy: true, group: true },
    });
  });

  it("scopes to the caller's campus for STAFF", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u2", role: "STAFF" } });
    (getCampusScope as any).mockResolvedValue({ type: "CAMPUS_LIST", campusIds: ["c1"] });
    (prisma.incident.findMany as any).mockResolvedValue([]);

    await GET();
    expect(prisma.incident.findMany).toHaveBeenCalledWith({
      where: { student: { campusId: { in: ["c1"] } } },
      orderBy: { createdAt: "desc" },
      include: { student: { include: { user: true } }, reportedBy: true, group: true },
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/api/admin-incidents.test.ts`
Expected: FAIL — route doesn't exist yet.

- [ ] **Step 3: Implement**

`src/app/api/admin/incidents/route.ts`:
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
  const where: Prisma.IncidentWhereInput =
    scope.type === "ALL"
      ? {}
      : scope.type === "CAMPUS_LIST"
        ? { student: { campusId: { in: scope.campusIds } } }
        : { id: { in: [] } };

  const incidents = await prisma.incident.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { student: { include: { user: true } }, reportedBy: true, group: true },
  });

  return Response.json(incidents);
}
```

Note: the `include: { user: true }` here pulls the full `User` record for `student.user` and the full `reportedBy` `User` — since this route serializes directly to `Response.json`, narrow both selects to avoid exposing `passwordHash` (a real issue found and fixed in a prior spec's review): use `user: { select: { id: true, name: true } }` for `student.user`, and change the top-level `reportedBy: true` to `reportedBy: { select: { id: true, name: true } }`.

- [ ] **Step 4: Run tests to verify they pass, updating the test's `include` expectations to match the narrowed selects**

Run: `npm test -- tests/api/admin-incidents.test.ts`
Expected: PASS (4 tests) — update the two `toHaveBeenCalledWith` assertions in the test file to expect `include: { student: { include: { user: { select: { id: true, name: true } } } }, reportedBy: { select: { id: true, name: true } }, group: true }` instead of the bare `true` values shown in Step 1's test listing above (that listing was illustrative of the query shape before the passwordHash-safety note; the actual test you write and run must match the narrowed-select implementation).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/admin/incidents tests/api/admin-incidents.test.ts
git commit -m "feat: add GET /api/admin/incidents with campus scoping"
```

---

### Task 6: Attendance page and form

**Files:**
- Create: `src/components/portal/attendance-form.tsx`
- Create: `src/app/portal/asistencia/page.tsx`
- Modify: `src/components/portal/portal-nav.tsx`

**Interfaces:**
- Consumes: `auth`, `prisma`, `POST /api/portal/attendance` (Task 3), `Card`, `Button`.
- Produces: `/portal/asistencia`, plus an "Asistencia" entry in `PortalNav` (visible always — the page itself redirects non-TEACHER visitors, matching the pattern already used for admin-only pages).

- [ ] **Step 1: Add Asistencia and Incidencias to PortalNav**

In `src/components/portal/portal-nav.tsx`, change the `MODULES` array from its current single Cobranzas entry to:
```ts
const MODULES = [
  { href: "/portal/cobranzas", label: "Cobranzas" },
  { href: "/portal/asistencia", label: "Asistencia" },
  { href: "/portal/incidencias", label: "Incidencias" },
];
```

- [ ] **Step 2: AttendanceForm (client component)**

`src/components/portal/attendance-form.tsx`:
```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

const STATUS_OPTIONS = [
  { value: "PRESENT", label: "Presente" },
  { value: "ABSENT", label: "Ausente" },
  { value: "LATE", label: "Retardo" },
  { value: "EXCUSED", label: "Justificado" },
];

export function AttendanceForm({
  groupId,
  date,
  students,
}: {
  groupId: string;
  date: string;
  students: { enrollmentId: string; name: string }[];
}) {
  const router = useRouter();
  const [statuses, setStatuses] = useState<Record<string, string>>(
    Object.fromEntries(students.map((s) => [s.enrollmentId, "PRESENT"]))
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/portal/attendance", {
        method: "POST",
        body: JSON.stringify({
          groupId,
          date,
          records: students.map((s) => ({
            enrollmentId: s.enrollmentId,
            status: statuses[s.enrollmentId],
          })),
        }),
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "No se pudo guardar la asistencia");
        return;
      }

      router.refresh();
    } catch {
      setError("No se pudo guardar la asistencia");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="divide-y divide-border rounded-lg border border-border bg-white">
        {students.map((s) => (
          <div key={s.enrollmentId} className="flex items-center justify-between px-4 py-3">
            <span className="text-sm font-medium">{s.name}</span>
            <select
              value={statuses[s.enrollmentId]}
              onChange={(e) =>
                setStatuses((prev) => ({ ...prev, [s.enrollmentId]: e.target.value }))
              }
              className="rounded-md border border-border px-2 py-1 text-sm"
              aria-label={`Estatus de ${s.name}`}
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
      {error && <p className="text-sm text-accent-dark">{error}</p>}
      <Button type="submit" disabled={submitting}>
        {submitting ? "Guardando..." : "Guardar asistencia"}
      </Button>
    </form>
  );
}
```

- [ ] **Step 3: Attendance page**

`src/app/portal/asistencia/page.tsx`:
```tsx
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { AttendanceForm } from "@/components/portal/attendance-form";

export default async function AsistenciaPage({
  searchParams,
}: {
  searchParams: Promise<{ groupId?: string; date?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const role = (session.user as { role: string }).role;
  if (role !== "TEACHER") redirect("/portal");

  const userId = (session.user as { id: string }).id;
  const groups = await prisma.group.findMany({
    where: { teacherId: userId },
    include: { level: true },
    orderBy: { name: "asc" },
  });

  const params = await searchParams;
  const selectedGroupId = params.groupId ?? groups[0]?.id;
  const date = params.date ?? new Date().toISOString().slice(0, 10);

  if (!selectedGroupId) {
    return (
      <div>
        <h1 className="text-lg font-semibold">Asistencia</h1>
        <p className="mt-2 text-sm text-muted">No tienes grupos asignados.</p>
      </div>
    );
  }

  const enrollments = await prisma.enrollment.findMany({
    where: { groupId: selectedGroupId, completedAt: null },
    include: { student: { include: { user: true } } },
  });

  const existing = await prisma.attendanceRecord.findMany({
    where: { date: new Date(date), enrollment: { groupId: selectedGroupId } },
  });

  return (
    <div>
      <h1 className="text-lg font-semibold">Asistencia</h1>
      <form method="get" className="mt-4 flex flex-wrap gap-3">
        <select name="groupId" defaultValue={selectedGroupId} className="rounded-md border border-border px-2 py-1 text-sm">
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.level.code} · {g.name}
            </option>
          ))}
        </select>
        <input
          type="date"
          name="date"
          defaultValue={date}
          className="rounded-md border border-border px-2 py-1 text-sm"
        />
        <button type="submit" className="rounded-md border border-border px-3 py-1 text-sm">
          Ver
        </button>
      </form>

      <div className="mt-6">
        {existing.length > 0 ? (
          <Card>
            <p className="text-sm text-muted">
              Ya existe asistencia guardada para esta fecha. Los registros de asistencia son
              definitivos y no se pueden modificar.
            </p>
          </Card>
        ) : (
          <AttendanceForm
            groupId={selectedGroupId}
            date={date}
            students={enrollments.map((e) => ({
              enrollmentId: e.id,
              name: e.student.user.name,
            }))}
          />
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Verify it builds**

Run: kill any running `next dev` (`pgrep -f "next dev" | xargs -r kill`), then `npm run build`.
Expected: `/portal/asistencia` compiles as a dynamic route.

- [ ] **Step 5: Commit**

```bash
git add src/components/portal/attendance-form.tsx src/app/portal/asistencia src/components/portal/portal-nav.tsx
git commit -m "feat: add teacher attendance page"
```

---

### Task 7: Incidents page for teachers

**Files:**
- Create: `src/components/portal/incident-form.tsx`
- Create: `src/app/portal/incidencias/page.tsx`

**Interfaces:**
- Consumes: `auth`, `prisma`, `POST /api/portal/incidents` (Task 4), `Card`, `Input`, `Button`.
- Produces: `/portal/incidencias`.

- [ ] **Step 1: IncidentForm (client component)**

`src/components/portal/incident-form.tsx`:
```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function IncidentForm({
  students,
}: {
  students: { id: string; name: string; groupId: string }[];
}) {
  const router = useRouter();
  const [studentKey, setStudentKey] = useState(
    students[0] ? `${students[0].id}:${students[0].groupId}` : ""
  );
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const [studentId, groupId] = studentKey.split(":");

    try {
      const res = await fetch("/api/portal/incidents", {
        method: "POST",
        body: JSON.stringify({ studentId, groupId, description }),
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "No se pudo registrar la incidencia");
        return;
      }

      setDescription("");
      router.refresh();
    } catch {
      setError("No se pudo registrar la incidencia");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-border bg-white p-4">
      <select
        value={studentKey}
        onChange={(e) => setStudentKey(e.target.value)}
        className="w-full rounded-md border border-border px-2 py-2 text-sm"
      >
        {students.map((s) => (
          <option key={`${s.id}:${s.groupId}`} value={`${s.id}:${s.groupId}`}>
            {s.name}
          </option>
        ))}
      </select>
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Describe lo ocurrido"
        required
        rows={3}
        className="w-full rounded-md border border-border px-3 py-2 text-sm"
      />
      {error && <p className="text-sm text-accent-dark">{error}</p>}
      <Button type="submit" disabled={submitting || !studentKey}>
        {submitting ? "Guardando..." : "Registrar incidencia"}
      </Button>
    </form>
  );
}
```

- [ ] **Step 2: Incidents page**

`src/app/portal/incidencias/page.tsx`:
```tsx
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { IncidentForm } from "@/components/portal/incident-form";

export default async function IncidenciasPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const role = (session.user as { role: string }).role;
  if (role !== "TEACHER") redirect("/portal");

  const userId = (session.user as { id: string }).id;

  const groups = await prisma.group.findMany({
    where: { teacherId: userId },
    include: {
      enrollments: {
        where: { completedAt: null },
        include: { student: { include: { user: true } } },
      },
    },
  });

  const students = groups.flatMap((g) =>
    g.enrollments.map((e) => ({ id: e.studentId, name: e.student.user.name, groupId: g.id }))
  );

  const incidents = await prisma.incident.findMany({
    where: { reportedById: userId },
    orderBy: { createdAt: "desc" },
    include: { student: { include: { user: true } } },
  });

  return (
    <div>
      <h1 className="text-lg font-semibold">Incidencias</h1>
      <div className="mt-4">
        {students.length > 0 ? (
          <IncidentForm students={students} />
        ) : (
          <p className="text-sm text-muted">No tienes alumnos asignados.</p>
        )}
      </div>
      <div className="mt-8">
        <h2 className="text-sm font-semibold text-muted">Incidencias registradas por ti</h2>
        <div className="mt-3 space-y-3">
          {incidents.map((incident) => (
            <Card key={incident.id}>
              <p className="text-sm font-medium">{incident.student.user.name}</p>
              <p className="mt-1 text-sm text-muted">{incident.description}</p>
              <p className="mt-2 text-xs text-muted">
                {incident.createdAt.toLocaleDateString("es-MX")}
              </p>
            </Card>
          ))}
          {incidents.length === 0 && (
            <p className="text-sm text-muted">Aún no has registrado incidencias.</p>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify it builds**

Run: `npm run build`
Expected: `/portal/incidencias` compiles as a dynamic route.

- [ ] **Step 4: Commit**

```bash
git add src/components/portal/incident-form.tsx src/app/portal/incidencias
git commit -m "feat: add teacher incidents page"
```

---

### Task 8: Admin incidents page

**Files:**
- Create: `src/app/admin/incidencias/page.tsx`
- Modify: `src/components/admin/admin-nav.tsx`

**Interfaces:**
- Consumes: `auth`, `getCampusScope`, `prisma`, `Table`/`TableRow`/`TableCell`/`TableHead`.
- Produces: `/admin/incidencias`.

- [ ] **Step 1: Add Incidencias to AdminNav**

In `src/components/admin/admin-nav.tsx`, add `{ href: "/admin/incidencias", label: "Incidencias" }` to the `MODULES` array (after Reinscripciones).

- [ ] **Step 2: Admin incidents page**

`src/app/admin/incidencias/page.tsx`:
```tsx
import { auth } from "@/lib/auth";
import { getCampusScope } from "@/lib/campus-scope";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { Table, TableRow, TableCell, TableHead } from "@/components/ui/table";

export default async function IncidenciasAdminPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const role = (session.user as { role: string }).role;
  if (role !== "ADMIN" && role !== "STAFF") redirect("/portal");

  const scope = await getCampusScope(session.user as { id: string; role: any });
  const where: Prisma.IncidentWhereInput =
    scope.type === "ALL"
      ? {}
      : scope.type === "CAMPUS_LIST"
        ? { student: { campusId: { in: scope.campusIds } } }
        : { id: { in: [] } };

  const incidents = await prisma.incident.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      student: { include: { user: { select: { id: true, name: true } } } },
      reportedBy: { select: { id: true, name: true } },
      group: true,
    },
  });

  return (
    <div>
      <h1 className="text-lg font-semibold">Incidencias</h1>
      <div className="mt-6 overflow-x-auto">
        <Table>
          <thead>
            <TableRow>
              <TableHead>Alumno</TableHead>
              <TableHead>Grupo</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead>Registrado por</TableHead>
              <TableHead>Fecha</TableHead>
            </TableRow>
          </thead>
          <tbody>
            {incidents.map((incident) => (
              <TableRow key={incident.id}>
                <TableCell>{incident.student.user.name}</TableCell>
                <TableCell>{incident.group?.name ?? "—"}</TableCell>
                <TableCell>{incident.description}</TableCell>
                <TableCell>{incident.reportedBy.name}</TableCell>
                <TableCell>{incident.createdAt.toLocaleDateString("es-MX")}</TableCell>
              </TableRow>
            ))}
          </tbody>
        </Table>
        {incidents.length === 0 && (
          <p className="mt-6 text-center text-sm text-muted">No hay incidencias que mostrar.</p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify it builds**

Run: `npm run build`
Expected: `/admin/incidencias` compiles as a dynamic route.

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/incidencias src/components/admin/admin-nav.tsx
git commit -m "feat: add admin incidents page"
```

---

## Post-plan checklist

- [ ] `npm test` — all suites pass
- [ ] `npx tsc --noEmit` — no type errors
- [ ] `npm run build` — production build succeeds, all new routes listed
- [ ] Manual smoke test: log in as `profesor.itinerante@bristol-ingles.com`, take attendance for the seeded group, confirm it becomes read-only on reload; log an incident; log in as admin and confirm both are visible in `/admin/incidencias`
