# Bristol Comunicaciones Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Spec 2e (Comunicaciones) — ADMIN/STAFF publish announcements targeted at ALL users, one campus, or one role; TEACHER/STUDENT/PARENT see the ones that reach them in their portal; a matching email goes out via Resend when requested.

**Architecture:** A single immutable `Announcement` model with an `audience` discriminator (`ALL`/`CAMPUS`/`ROLE`) and two nullable columns (`campusId`, `role`) whose validity depends on `audience`. A new `src/lib/announcement-scope.ts` module holds the audience-matching rules in one place, used in both directions: "which announcements does this portal user see" (a `where` clause) and "which users does this announcement reach" (a recipient list, for email). This mirrors the project's existing split between admin-side `getCampusScope` and portal-side `getVisibleStudentIds` — a third, narrower scoping concept for this one feature, not a replacement for either.

**Tech Stack:** Next.js 16 (App Router), Prisma/PostgreSQL, Vitest, Resend — established patterns from prior specs.

## Global Constraints

- Node ≥22 required — `nvm use 22` before any `npm`/`npx` command (or prepend node 22's bin dir to `PATH`).
- This repo lives on a network volume that spawns `._<filename>` AppleDouble junk files on write (gitignored); clean with `find . -name "._*" -not -path "./node_modules/*" -not -path "./.git/*" -delete` before build/test.
- An `Announcement` is immutable once created — no PATCH/PUT/DELETE route in this spec.
- STAFF may only create `audience: "CAMPUS"` announcements for a campus within their own `getCampusScope`; STAFF creating `audience: "ALL"` or `audience: "ROLE"` must be rejected (403). ADMIN may create any audience.
- `getRecipientCampusIds` (portal-side, for matching CAMPUS announcements to TEACHER/STUDENT/PARENT) is a NEW function, distinct from the existing admin-side `getCampusScope` in `src/lib/campus-scope.ts` — do not reuse `getCampusScope` for this. `getCampusScope` returns `NONE` for PARENT (parents manage nothing), but a parent must still see CAMPUS announcements for any of their children's campuses. Reusing `getCampusScope` here would silently exclude parents.
- A failed email send must never roll back or block the announcement's creation — the announcement already exists and is visible in the portal regardless of email delivery. Wrap the email step so its failure is logged, not thrown, and does not change the route's success response.
- Every route handler must check session + role BEFORE any database query.
- Every task must leave `npm run build`, `npm test`, and `npx tsc --noEmit` passing.

---

## File Structure

```
prisma/
  schema.prisma                    # + AnnouncementAudience enum, Announcement model
src/
  lib/
    announcement-scope.ts              # NEW: audience matching, both directions
    email.ts                           # + sendAnnouncementEmail
  app/
    admin/
      comunicaciones/
        page.tsx                          # admin/staff: create + list
    portal/
      comunicaciones/
        page.tsx                           # teacher/student/parent: read-only list
    api/
      admin/
        announcements/
          route.ts                            # GET, POST
      portal/
        announcements/
          route.ts                             # GET
  components/
    admin/
      announcement-form.tsx           # client: title/body/audience/campus/role/email checkbox
      admin-nav.tsx                    # + Comunicaciones entry
    portal/
      portal-nav.tsx                    # + Comunicaciones entry
tests/
  lib/
    announcement-scope.test.ts
  api/
    admin-announcements-post.test.ts
    admin-announcements-get.test.ts
    portal-announcements.test.ts
```

---

### Task 1: Announcement model and migration

**Files:**
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Produces: `AnnouncementAudience` enum, `Announcement` model, plus a back-reference relation field on `User` (`createdAnnouncements`) and `Campus` (`announcements`) — consumed by every later task.

- [ ] **Step 1: Add the enum and model**

Add to `prisma/schema.prisma`:
```prisma
enum AnnouncementAudience {
  ALL
  CAMPUS
  ROLE
}

model Announcement {
  id          String               @id @default(cuid())
  title       String
  body        String
  audience    AnnouncementAudience
  campusId    String?
  role        Role?
  sendEmail   Boolean              @default(false)
  createdById String
  createdAt   DateTime             @default(now())

  campus    Campus? @relation(fields: [campusId], references: [id])
  createdBy User    @relation(fields: [createdById], references: [id], onDelete: Cascade)
}
```

Add the back-reference relation fields to the existing models:
- `User`: add `createdAnnouncements Announcement[]`
- `Campus`: add `announcements Announcement[]`

- [ ] **Step 2: Run the migration**

Run: `npx prisma migrate dev --name add_announcements`
Expected: migration applies cleanly against the local `bristol` database.

- [ ] **Step 3: Verify**

Run: `npx prisma format --check` (fix alignment with `npx prisma format` if it fails), then `npx tsc --noEmit`.
Expected: both clean.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat: add Announcement model with ALL/CAMPUS/ROLE audience targeting"
```

---

### Task 2: announcement-scope.ts — audience matching, both directions

**Files:**
- Create: `src/lib/announcement-scope.ts`
- Test: `tests/lib/announcement-scope.test.ts`

**Interfaces:**
- Produces: `getRecipientCampusIds(user)`, `announcementAudienceWhere(user, campusIds)`, `resolveAnnouncementRecipients(announcement)` — consumed by Tasks 4 (POST, for email) and 6 (GET /api/portal/announcements, for the `where` clause).

- [ ] **Step 1: Write the failing tests**

`tests/lib/announcement-scope.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    teacherCampus: { findMany: vi.fn() },
    student: { findUnique: vi.fn(), findMany: vi.fn() },
    parentStudent: { findMany: vi.fn() },
    user: { findMany: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import {
  getRecipientCampusIds,
  announcementAudienceWhere,
  resolveAnnouncementRecipients,
} from "@/lib/announcement-scope";

describe("getRecipientCampusIds", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns TeacherCampus campus ids for TEACHER", async () => {
    (prisma.teacherCampus.findMany as any).mockResolvedValue([{ campusId: "c1" }, { campusId: "c2" }]);
    const ids = await getRecipientCampusIds({ id: "t1", role: "TEACHER" as any });
    expect(ids).toEqual(["c1", "c2"]);
  });

  it("returns the student's own campus for STUDENT", async () => {
    (prisma.student.findUnique as any).mockResolvedValue({ campusId: "c1" });
    const ids = await getRecipientCampusIds({ id: "s1", role: "STUDENT" as any });
    expect(ids).toEqual(["c1"]);
  });

  it("returns an empty array for STUDENT with no Student record", async () => {
    (prisma.student.findUnique as any).mockResolvedValue(null);
    const ids = await getRecipientCampusIds({ id: "s1", role: "STUDENT" as any });
    expect(ids).toEqual([]);
  });

  it("returns deduplicated campus ids across all children for PARENT", async () => {
    (prisma.parentStudent.findMany as any).mockResolvedValue([
      { student: { campusId: "c1" } },
      { student: { campusId: "c1" } },
      { student: { campusId: "c2" } },
    ]);
    const ids = await getRecipientCampusIds({ id: "p1", role: "PARENT" as any });
    expect(ids.sort()).toEqual(["c1", "c2"]);
  });

  it("returns an empty array for ADMIN/STAFF (not portal recipients)", async () => {
    expect(await getRecipientCampusIds({ id: "a1", role: "ADMIN" as any })).toEqual([]);
    expect(await getRecipientCampusIds({ id: "st1", role: "STAFF" as any })).toEqual([]);
  });
});

describe("announcementAudienceWhere", () => {
  it("always includes ALL and this user's ROLE", () => {
    const where = announcementAudienceWhere({ role: "TEACHER" as any }, []);
    expect(where).toEqual({
      OR: [{ audience: "ALL" }, { audience: "ROLE", role: "TEACHER" }],
    });
  });

  it("includes a CAMPUS clause when campusIds is non-empty", () => {
    const where = announcementAudienceWhere({ role: "STUDENT" as any }, ["c1", "c2"]);
    expect(where).toEqual({
      OR: [
        { audience: "ALL" },
        { audience: "ROLE", role: "STUDENT" },
        { audience: "CAMPUS", campusId: { in: ["c1", "c2"] } },
      ],
    });
  });
});

describe("resolveAnnouncementRecipients", () => {
  beforeEach(() => vi.clearAllMocks());

  it("ALL resolves to every user", async () => {
    (prisma.user.findMany as any).mockResolvedValue([{ id: "u1", email: "a@x.com" }]);
    const recipients = await resolveAnnouncementRecipients({ audience: "ALL", campusId: null, role: null });
    expect(prisma.user.findMany).toHaveBeenCalledWith({ select: { id: true, email: true } });
    expect(recipients).toEqual([{ id: "u1", email: "a@x.com" }]);
  });

  it("ROLE resolves to users of that role", async () => {
    (prisma.user.findMany as any).mockResolvedValue([{ id: "u1", email: "t@x.com" }]);
    const recipients = await resolveAnnouncementRecipients({ audience: "ROLE", campusId: null, role: "TEACHER" as any });
    expect(prisma.user.findMany).toHaveBeenCalledWith({
      where: { role: "TEACHER" },
      select: { id: true, email: true },
    });
    expect(recipients).toEqual([{ id: "u1", email: "t@x.com" }]);
  });

  it("CAMPUS resolves to the union of teachers, students, and parents at that campus, deduplicated", async () => {
    (prisma.teacherCampus.findMany as any).mockResolvedValue([
      { user: { id: "t1", email: "t1@x.com" } },
    ]);
    (prisma.student.findMany as any).mockResolvedValue([
      { user: { id: "s1", email: "s1@x.com" } },
    ]);
    (prisma.parentStudent.findMany as any).mockResolvedValue([
      { parent: { id: "p1", email: "p1@x.com" } },
      { parent: { id: "p1", email: "p1@x.com" } }, // two children, same parent
    ]);

    const recipients = await resolveAnnouncementRecipients({ audience: "CAMPUS", campusId: "c1", role: null });

    expect(recipients).toHaveLength(3);
    expect(recipients).toEqual(
      expect.arrayContaining([
        { id: "t1", email: "t1@x.com" },
        { id: "s1", email: "s1@x.com" },
        { id: "p1", email: "p1@x.com" },
      ])
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/lib/announcement-scope.test.ts`
Expected: FAIL — module doesn't exist yet.

- [ ] **Step 3: Implement**

`src/lib/announcement-scope.ts`:
```ts
import { prisma } from "@/lib/prisma";
import type { Prisma, Role } from "@prisma/client";

/**
 * Campus ids relevant to a portal user (TEACHER/STUDENT/PARENT) for
 * matching CAMPUS-audience announcements. Distinct from the admin-side
 * getCampusScope in campus-scope.ts: getCampusScope returns NONE for
 * PARENT (a parent manages nothing), but a parent must still see CAMPUS
 * announcements for any of their children's campuses. Do not conflate
 * the two — they answer different questions ("what can I manage" vs.
 * "what's relevant to me").
 */
export async function getRecipientCampusIds(user: { id: string; role: Role }): Promise<string[]> {
  switch (user.role) {
    case "TEACHER": {
      const rows = await prisma.teacherCampus.findMany({
        where: { userId: user.id },
        select: { campusId: true },
      });
      return rows.map((r) => r.campusId);
    }
    case "STUDENT": {
      const student = await prisma.student.findUnique({
        where: { userId: user.id },
        select: { campusId: true },
      });
      return student ? [student.campusId] : [];
    }
    case "PARENT": {
      const rows = await prisma.parentStudent.findMany({
        where: { parentUserId: user.id },
        select: { student: { select: { campusId: true } } },
      });
      return [...new Set(rows.map((r) => r.student.campusId))];
    }
    default:
      return [];
  }
}

/**
 * Builds the Prisma `where` clause matching every announcement that
 * reaches this user: always ALL and their own ROLE, plus CAMPUS
 * announcements for any campus in `campusIds` when non-empty.
 */
export function announcementAudienceWhere(
  user: { role: Role },
  campusIds: string[]
): Prisma.AnnouncementWhereInput {
  const or: Prisma.AnnouncementWhereInput[] = [
    { audience: "ALL" },
    { audience: "ROLE", role: user.role },
  ];
  if (campusIds.length > 0) {
    or.push({ audience: "CAMPUS", campusId: { in: campusIds } });
  }
  return { OR: or };
}

/**
 * Inverse direction: given an announcement, resolves the concrete list
 * of users it reaches, for email sending. CAMPUS recipients are the
 * union of TEACHER/STUDENT/PARENT at that campus (not Staff/Admin —
 * announcements are addressed to the school community, not to the
 * people administering it), deduplicated by user id.
 */
export async function resolveAnnouncementRecipients(announcement: {
  audience: "ALL" | "CAMPUS" | "ROLE";
  campusId: string | null;
  role: Role | null;
}): Promise<{ id: string; email: string }[]> {
  if (announcement.audience === "ALL") {
    return prisma.user.findMany({ select: { id: true, email: true } });
  }

  if (announcement.audience === "ROLE") {
    return prisma.user.findMany({
      where: { role: announcement.role! },
      select: { id: true, email: true },
    });
  }

  const campusId = announcement.campusId!;
  const [teacherRows, studentRows, parentRows] = await Promise.all([
    prisma.teacherCampus.findMany({
      where: { campusId },
      select: { user: { select: { id: true, email: true } } },
    }),
    prisma.student.findMany({
      where: { campusId },
      select: { user: { select: { id: true, email: true } } },
    }),
    prisma.parentStudent.findMany({
      where: { student: { campusId } },
      select: { parent: { select: { id: true, email: true } } },
    }),
  ]);

  const byId = new Map<string, { id: string; email: string }>();
  for (const row of teacherRows) byId.set(row.user.id, row.user);
  for (const row of studentRows) byId.set(row.user.id, row.user);
  for (const row of parentRows) byId.set(row.parent.id, row.parent);

  return [...byId.values()];
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/lib/announcement-scope.test.ts`
Expected: PASS (all cases)

- [ ] **Step 5: Commit**

```bash
git add src/lib/announcement-scope.ts tests/lib/announcement-scope.test.ts
git commit -m "feat: add announcement audience-matching helpers"
```

---

### Task 3: sendAnnouncementEmail

**Files:**
- Modify: `src/lib/email.ts`
- Test: create `tests/lib/email.test.ts` if one doesn't already exist for this file (check first — if `tests/lib/email.test.ts` already exists, add to it instead of creating a duplicate)

**Interfaces:**
- Produces: `sendAnnouncementEmail(to: string, announcement: { title: string; body: string })` — consumed by Task 4's POST route.

- [ ] **Step 1: Check for an existing test file**

Run: `ls tests/lib/email.test.ts 2>/dev/null || echo "no existing file"`. If it exists, read it first to match its existing mocking pattern for `resend`.

- [ ] **Step 2: Write the failing test**

Add this test (to the existing file if found, else create `tests/lib/email.test.ts` following the same `vi.mock("resend", ...)` pattern used for `sendVerificationEmail`/`sendPasswordResetEmail` if those already have tests — otherwise mock `resend` directly):
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const sendMock = vi.fn();
vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(() => ({ emails: { send: sendMock } })),
}));

describe("sendAnnouncementEmail", () => {
  beforeEach(() => {
    sendMock.mockClear();
    sendMock.mockResolvedValue({});
  });

  it("sends an email with the announcement's title and body", async () => {
    const { sendAnnouncementEmail } = await import("@/lib/email");
    await sendAnnouncementEmail("parent@example.com", { title: "Suspensión de clases", body: "Mañana no hay clases." });

    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "parent@example.com",
        subject: "Suspensión de clases",
        html: expect.stringContaining("Mañana no hay clases."),
      })
    );
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- tests/lib/email.test.ts`
Expected: FAIL — function doesn't exist yet.

- [ ] **Step 4: Implement**

Add to `src/lib/email.ts` (after the existing functions, same file, same `resend`/`FROM` already declared at the top):
```ts
export async function sendAnnouncementEmail(
  to: string,
  announcement: { title: string; body: string }
): Promise<void> {
  await resend.emails.send({
    from: FROM,
    to,
    subject: announcement.title,
    html: `<p>${announcement.body}</p>`,
  });
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- tests/lib/email.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/email.ts tests/lib/email.test.ts
git commit -m "feat: add sendAnnouncementEmail"
```

---

### Task 4: POST /api/admin/announcements

**Files:**
- Create: `src/app/api/admin/announcements/route.ts` (POST handler; GET is added in Task 5 in the same file)
- Test: `tests/api/admin-announcements-post.test.ts`

**Interfaces:**
- Consumes: `auth`, `getCampusScope`, `resolveAnnouncementRecipients`, `sendAnnouncementEmail`, `prisma`.
- Produces: `POST /api/admin/announcements` — consumed by Task 7's `AnnouncementForm`.

- [ ] **Step 1: Write the failing tests**

`tests/api/admin-announcements-post.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/campus-scope", () => ({ getCampusScope: vi.fn() }));
vi.mock("@/lib/announcement-scope", () => ({ resolveAnnouncementRecipients: vi.fn() }));
vi.mock("@/lib/email", () => ({ sendAnnouncementEmail: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { announcement: { create: vi.fn() } },
}));

import { auth } from "@/lib/auth";
import { getCampusScope } from "@/lib/campus-scope";
import { resolveAnnouncementRecipients } from "@/lib/announcement-scope";
import { sendAnnouncementEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";
import { POST } from "@/app/api/admin/announcements/route";

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/admin/announcements", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/admin/announcements", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 without a session", async () => {
    (auth as any).mockResolvedValue(null);
    const res = await POST(jsonRequest({ title: "t", body: "b", audience: "ALL" }));
    expect(res.status).toBe(401);
  });

  it("returns 403 for a TEACHER", async () => {
    (auth as any).mockResolvedValue({ user: { id: "t1", role: "TEACHER" } });
    const res = await POST(jsonRequest({ title: "t", body: "b", audience: "ALL" }));
    expect(res.status).toBe(403);
  });

  it("returns 400 for an inconsistent audience/campusId/role combination", async () => {
    (auth as any).mockResolvedValue({ user: { id: "a1", role: "ADMIN" } });
    const res = await POST(jsonRequest({ title: "t", body: "b", audience: "CAMPUS" })); // missing campusId
    expect(res.status).toBe(400);
  });

  it("returns 403 when STAFF tries audience ALL", async () => {
    (auth as any).mockResolvedValue({ user: { id: "s1", role: "STAFF" } });
    const res = await POST(jsonRequest({ title: "t", body: "b", audience: "ALL" }));
    expect(res.status).toBe(403);
    expect(prisma.announcement.create).not.toHaveBeenCalled();
  });

  it("returns 403 when STAFF targets a campus outside their scope", async () => {
    (auth as any).mockResolvedValue({ user: { id: "s1", role: "STAFF" } });
    (getCampusScope as any).mockResolvedValue({ type: "CAMPUS_LIST", campusIds: ["c1"] });
    const res = await POST(jsonRequest({ title: "t", body: "b", audience: "CAMPUS", campusId: "c2" }));
    expect(res.status).toBe(403);
    expect(prisma.announcement.create).not.toHaveBeenCalled();
  });

  it("creates the announcement on success for ADMIN with audience ROLE, without sending email when sendEmail is false", async () => {
    (auth as any).mockResolvedValue({ user: { id: "a1", role: "ADMIN" } });
    (prisma.announcement.create as any).mockResolvedValue({ id: "an1" });

    const res = await POST(
      jsonRequest({ title: "t", body: "b", audience: "ROLE", role: "TEACHER", sendEmail: false })
    );

    expect(res.status).toBe(201);
    expect(prisma.announcement.create).toHaveBeenCalledWith({
      data: {
        title: "t",
        body: "b",
        audience: "ROLE",
        campusId: null,
        role: "TEACHER",
        sendEmail: false,
        createdById: "a1",
      },
    });
    expect(sendAnnouncementEmail).not.toHaveBeenCalled();
  });

  it("sends email to every resolved recipient when sendEmail is true, and still returns 201 if a send fails", async () => {
    (auth as any).mockResolvedValue({ user: { id: "a1", role: "ADMIN" } });
    (prisma.announcement.create as any).mockResolvedValue({ id: "an1", title: "t", body: "b" });
    (resolveAnnouncementRecipients as any).mockResolvedValue([
      { id: "u1", email: "u1@x.com" },
      { id: "u2", email: "u2@x.com" },
    ]);
    (sendAnnouncementEmail as any)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("resend down"));

    const res = await POST(jsonRequest({ title: "t", body: "b", audience: "ALL", sendEmail: true }));

    expect(res.status).toBe(201);
    expect(sendAnnouncementEmail).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/api/admin-announcements-post.test.ts`
Expected: FAIL — route doesn't exist yet.

- [ ] **Step 3: Implement**

`src/app/api/admin/announcements/route.ts`:
```ts
import { auth } from "@/lib/auth";
import { getCampusScope } from "@/lib/campus-scope";
import { resolveAnnouncementRecipients } from "@/lib/announcement-scope";
import { sendAnnouncementEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";

const VALID_ROLES: Role[] = ["ADMIN", "STAFF", "TEACHER", "STUDENT", "PARENT"];

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }
  const role = (session.user as { role: Role }).role;
  if (role !== "ADMIN" && role !== "STAFF") {
    return Response.json({ error: "No autorizado" }, { status: 403 });
  }

  let body: {
    title?: string;
    body?: string;
    audience?: string;
    campusId?: string;
    role?: string;
    sendEmail?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Cuerpo de la solicitud inválido" }, { status: 400 });
  }

  if (!body.title || !body.body || !body.audience) {
    return Response.json({ error: "Datos inválidos" }, { status: 400 });
  }

  if (body.audience === "ALL" && (body.campusId || body.role)) {
    return Response.json({ error: "Datos inválidos" }, { status: 400 });
  }
  if (body.audience === "CAMPUS" && (!body.campusId || body.role)) {
    return Response.json({ error: "Datos inválidos" }, { status: 400 });
  }
  if (body.audience === "ROLE" && (!body.role || body.campusId || !VALID_ROLES.includes(body.role as Role))) {
    return Response.json({ error: "Datos inválidos" }, { status: 400 });
  }
  if (!["ALL", "CAMPUS", "ROLE"].includes(body.audience)) {
    return Response.json({ error: "Datos inválidos" }, { status: 400 });
  }

  if (role === "STAFF") {
    if (body.audience !== "CAMPUS") {
      return Response.json({ error: "No autorizado" }, { status: 403 });
    }
    const scope = await getCampusScope(session.user as { id: string; role: Role });
    const inScope =
      scope.type === "ALL" || (scope.type === "CAMPUS_LIST" && scope.campusIds.includes(body.campusId!));
    if (!inScope) {
      return Response.json({ error: "No autorizado" }, { status: 403 });
    }
  }

  const announcement = await prisma.announcement.create({
    data: {
      title: body.title,
      body: body.body,
      audience: body.audience as "ALL" | "CAMPUS" | "ROLE",
      campusId: body.campusId ?? null,
      role: (body.role as Role) ?? null,
      sendEmail: body.sendEmail ?? false,
      createdById: (session.user as { id: string }).id,
    },
  });

  if (body.sendEmail) {
    const recipients = await resolveAnnouncementRecipients({
      audience: announcement.audience,
      campusId: announcement.campusId,
      role: announcement.role,
    });
    await Promise.allSettled(
      recipients.map((r) => sendAnnouncementEmail(r.email, { title: announcement.title, body: announcement.body }))
    );
  }

  return Response.json(announcement, { status: 201 });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/api/admin-announcements-post.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add src/app/api/admin/announcements tests/api/admin-announcements-post.test.ts
git commit -m "feat: add POST /api/admin/announcements"
```

---

### Task 5: GET /api/admin/announcements

**Files:**
- Modify: `src/app/api/admin/announcements/route.ts` (add GET alongside Task 4's POST)
- Test: `tests/api/admin-announcements-get.test.ts`

**Interfaces:**
- Consumes: `auth`, `prisma`.
- Produces: `GET /api/admin/announcements` — consumed by Task 7's admin page.

- [ ] **Step 1: Write the failing tests**

`tests/api/admin-announcements-get.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { announcement: { findMany: vi.fn() } },
}));

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { GET } from "@/app/api/admin/announcements/route";

describe("GET /api/admin/announcements", () => {
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

  it("ADMIN sees every announcement", async () => {
    (auth as any).mockResolvedValue({ user: { id: "a1", role: "ADMIN" } });
    (prisma.announcement.findMany as any).mockResolvedValue([]);

    await GET();
    expect(prisma.announcement.findMany).toHaveBeenCalledWith({
      where: {},
      orderBy: { createdAt: "desc" },
      include: { createdBy: { select: { id: true, name: true } }, campus: true },
    });
  });

  it("STAFF sees their own announcements plus ALL-audience ones", async () => {
    (auth as any).mockResolvedValue({ user: { id: "s1", role: "STAFF" } });
    (prisma.announcement.findMany as any).mockResolvedValue([]);

    await GET();
    expect(prisma.announcement.findMany).toHaveBeenCalledWith({
      where: { OR: [{ createdById: "s1" }, { audience: "ALL" }] },
      orderBy: { createdAt: "desc" },
      include: { createdBy: { select: { id: true, name: true } }, campus: true },
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/api/admin-announcements-get.test.ts`
Expected: FAIL — GET export doesn't exist yet.

- [ ] **Step 3: Implement**

Add to `src/app/api/admin/announcements/route.ts` (same file as Task 4's POST):
```ts
import type { Prisma } from "@prisma/client";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }
  const role = (session.user as { role: Role }).role;
  if (role !== "ADMIN" && role !== "STAFF") {
    return Response.json({ error: "No autorizado" }, { status: 403 });
  }

  const where: Prisma.AnnouncementWhereInput =
    role === "ADMIN"
      ? {}
      : { OR: [{ createdById: (session.user as { id: string }).id }, { audience: "ALL" }] };

  const announcements = await prisma.announcement.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { createdBy: { select: { id: true, name: true } }, campus: true },
  });

  return Response.json(announcements);
}
```

Note: add the `import type { Prisma } from "@prisma/client";` to the top of the file alongside the existing `Role` import (combine into one import statement: `import type { Prisma, Role } from "@prisma/client";`).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/api/admin-announcements-get.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Run the full Task 4 + Task 5 test file together to confirm no interference**

Run: `npm test -- tests/api/admin-announcements-post.test.ts tests/api/admin-announcements-get.test.ts`
Expected: PASS (both files)

- [ ] **Step 6: Commit**

```bash
git add src/app/api/admin/announcements tests/api/admin-announcements-get.test.ts
git commit -m "feat: add GET /api/admin/announcements"
```

---

### Task 6: GET /api/portal/announcements

**Files:**
- Create: `src/app/api/portal/announcements/route.ts`
- Test: `tests/api/portal-announcements.test.ts`

**Interfaces:**
- Consumes: `auth`, `getRecipientCampusIds`, `announcementAudienceWhere`, `prisma`.
- Produces: `GET /api/portal/announcements` — consumed by Task 8's portal page.

- [ ] **Step 1: Write the failing tests**

`tests/api/portal-announcements.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/announcement-scope", () => ({
  getRecipientCampusIds: vi.fn(),
  announcementAudienceWhere: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { announcement: { findMany: vi.fn() } },
}));

import { auth } from "@/lib/auth";
import { getRecipientCampusIds, announcementAudienceWhere } from "@/lib/announcement-scope";
import { prisma } from "@/lib/prisma";
import { GET } from "@/app/api/portal/announcements/route";

describe("GET /api/portal/announcements", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 without a session", async () => {
    (auth as any).mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns 403 for ADMIN/STAFF (this endpoint is for the community, not administrators)", async () => {
    (auth as any).mockResolvedValue({ user: { id: "a1", role: "ADMIN" } });
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("returns announcements matching this user's audience, most recent first", async () => {
    (auth as any).mockResolvedValue({ user: { id: "p1", role: "PARENT" } });
    (getRecipientCampusIds as any).mockResolvedValue(["c1"]);
    (announcementAudienceWhere as any).mockReturnValue({ OR: [{ audience: "ALL" }] });
    (prisma.announcement.findMany as any).mockResolvedValue([]);

    const res = await GET();

    expect(res.status).toBe(200);
    expect(getRecipientCampusIds).toHaveBeenCalledWith({ id: "p1", role: "PARENT" });
    expect(announcementAudienceWhere).toHaveBeenCalledWith({ role: "PARENT" }, ["c1"]);
    expect(prisma.announcement.findMany).toHaveBeenCalledWith({
      where: { OR: [{ audience: "ALL" }] },
      orderBy: { createdAt: "desc" },
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/api/portal-announcements.test.ts`
Expected: FAIL — route doesn't exist yet.

- [ ] **Step 3: Implement**

`src/app/api/portal/announcements/route.ts`:
```ts
import { auth } from "@/lib/auth";
import { getRecipientCampusIds, announcementAudienceWhere } from "@/lib/announcement-scope";
import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }
  const role = (session.user as { role: Role }).role;
  if (role !== "TEACHER" && role !== "STUDENT" && role !== "PARENT") {
    return Response.json({ error: "No autorizado" }, { status: 403 });
  }

  const user = { id: (session.user as { id: string }).id, role };
  const campusIds = await getRecipientCampusIds(user);
  const where = announcementAudienceWhere({ role }, campusIds);

  const announcements = await prisma.announcement.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });

  return Response.json(announcements);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/api/portal-announcements.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/app/api/portal/announcements tests/api/portal-announcements.test.ts
git commit -m "feat: add GET /api/portal/announcements"
```

---

### Task 7: Admin comunicaciones page

**Files:**
- Create: `src/components/admin/announcement-form.tsx`
- Create: `src/app/admin/comunicaciones/page.tsx`
- Modify: `src/components/admin/admin-nav.tsx`

**Interfaces:**
- Consumes: `auth`, `getCampusScope`, `prisma`, `POST /api/admin/announcements` (Task 4), `GET /api/admin/announcements` (Task 5), `Card`, `Button`.
- Produces: `/admin/comunicaciones`, plus a "Comunicaciones" entry in `AdminNav`.

- [ ] **Step 1: Add Comunicaciones to AdminNav**

In `src/components/admin/admin-nav.tsx`, add `{ href: "/admin/comunicaciones", label: "Comunicaciones" }` to the end of the `MODULES` array.

- [ ] **Step 2: AnnouncementForm (client component)**

Before writing this, check `src/components/ui/card.tsx` and `src/components/ui/button.tsx` for actual export names/props to match this codebase's conventions.

`src/components/admin/announcement-form.tsx`:
```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

const ROLE_OPTIONS = ["ADMIN", "STAFF", "TEACHER", "STUDENT", "PARENT"];

export function AnnouncementForm({
  isAdmin,
  campuses,
}: {
  isAdmin: boolean;
  campuses: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<"ALL" | "CAMPUS" | "ROLE">("CAMPUS");
  const [campusId, setCampusId] = useState(campuses[0]?.id ?? "");
  const [targetRole, setTargetRole] = useState("TEACHER");
  const [sendEmail, setSendEmail] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/announcements", {
        method: "POST",
        body: JSON.stringify({
          title,
          body,
          audience,
          campusId: audience === "CAMPUS" ? campusId : undefined,
          role: audience === "ROLE" ? targetRole : undefined,
          sendEmail,
        }),
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "No se pudo publicar el anuncio");
        return;
      }

      setTitle("");
      setBody("");
      router.refresh();
    } catch {
      setError("No se pudo publicar el anuncio");
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
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Contenido del anuncio"
        required
        rows={3}
        className="w-full rounded-md border border-border px-3 py-2 text-sm"
      />
      <div className="flex flex-wrap gap-3">
        <select
          value={audience}
          onChange={(e) => setAudience(e.target.value as "ALL" | "CAMPUS" | "ROLE")}
          className="rounded-md border border-border px-2 py-1 text-sm"
        >
          {isAdmin && <option value="ALL">Toda la escuela</option>}
          <option value="CAMPUS">Un plantel</option>
          {isAdmin && <option value="ROLE">Un rol</option>}
        </select>

        {audience === "CAMPUS" && (
          <select
            value={campusId}
            onChange={(e) => setCampusId(e.target.value)}
            className="rounded-md border border-border px-2 py-1 text-sm"
          >
            {campuses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}

        {audience === "ROLE" && isAdmin && (
          <select
            value={targetRole}
            onChange={(e) => setTargetRole(e.target.value)}
            className="rounded-md border border-border px-2 py-1 text-sm"
          >
            {ROLE_OPTIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        )}

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} />
          Enviar por correo
        </label>
      </div>
      {error && <p className="text-sm text-accent-dark">{error}</p>}
      <Button type="submit" disabled={submitting}>
        {submitting ? "Publicando..." : "Publicar anuncio"}
      </Button>
    </form>
  );
}
```

- [ ] **Step 3: Admin comunicaciones page**

`src/app/admin/comunicaciones/page.tsx`:
```tsx
import { auth } from "@/lib/auth";
import { getCampusScope } from "@/lib/campus-scope";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { AnnouncementForm } from "@/components/admin/announcement-form";
import type { Prisma, Role } from "@prisma/client";

export default async function ComunicacionesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const role = (session.user as { role: Role }).role;
  if (role !== "ADMIN" && role !== "STAFF") redirect("/portal");

  const isAdmin = role === "ADMIN";
  const scope = await getCampusScope(session.user as { id: string; role: Role });
  const campuses =
    scope.type === "ALL"
      ? await prisma.campus.findMany({ orderBy: { name: "asc" } })
      : scope.type === "CAMPUS_LIST"
        ? await prisma.campus.findMany({ where: { id: { in: scope.campusIds } }, orderBy: { name: "asc" } })
        : [];

  const where: Prisma.AnnouncementWhereInput =
    role === "ADMIN" ? {} : { OR: [{ createdById: (session.user as { id: string }).id }, { audience: "ALL" }] };

  const announcements = await prisma.announcement.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { createdBy: { select: { id: true, name: true } }, campus: true },
  });

  return (
    <div>
      <h1 className="text-lg font-semibold">Comunicaciones</h1>
      <div className="mt-4">
        <AnnouncementForm isAdmin={isAdmin} campuses={campuses} />
      </div>
      <div className="mt-8 space-y-3">
        {announcements.map((a) => (
          <Card key={a.id}>
            <p className="text-sm font-medium">{a.title}</p>
            <p className="mt-1 text-sm text-muted">{a.body}</p>
            <p className="mt-2 text-xs text-muted">
              {a.audience === "ALL" && "Toda la escuela"}
              {a.audience === "CAMPUS" && a.campus?.name}
              {a.audience === "ROLE" && a.role}
              {" · "}
              {a.createdBy.name} · {a.createdAt.toLocaleDateString("es-MX")}
            </p>
          </Card>
        ))}
        {announcements.length === 0 && (
          <p className="text-sm text-muted">Aún no hay anuncios.</p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Verify it builds**

Run: kill any running `next dev` (`pgrep -f "next dev" | xargs -r kill`), `rm -rf .next`, then `npm run build`.
Expected: `/admin/comunicaciones` compiles as a dynamic route.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/announcement-form.tsx src/app/admin/comunicaciones src/components/admin/admin-nav.tsx
git commit -m "feat: add admin comunicaciones page"
```

---

### Task 8: Portal comunicaciones page

**Files:**
- Create: `src/app/portal/comunicaciones/page.tsx`
- Modify: `src/components/portal/portal-nav.tsx`

**Interfaces:**
- Consumes: `auth`, `getRecipientCampusIds`, `announcementAudienceWhere`, `prisma`, `Card`.
- Produces: `/portal/comunicaciones`, plus a "Comunicaciones" entry in `PortalNav`.

- [ ] **Step 1: Add Comunicaciones to PortalNav**

In `src/components/portal/portal-nav.tsx`, add `{ href: "/portal/comunicaciones", label: "Comunicaciones" }` to the end of the `MODULES` array.

- [ ] **Step 2: Portal comunicaciones page**

`src/app/portal/comunicaciones/page.tsx`:
```tsx
import { auth } from "@/lib/auth";
import { getRecipientCampusIds, announcementAudienceWhere } from "@/lib/announcement-scope";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import type { Role } from "@prisma/client";

export default async function PortalComunicacionesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const role = (session.user as { role: Role }).role;
  if (role !== "TEACHER" && role !== "STUDENT" && role !== "PARENT") redirect("/admin");

  const user = { id: (session.user as { id: string }).id, role };
  const campusIds = await getRecipientCampusIds(user);
  const where = announcementAudienceWhere({ role }, campusIds);

  const announcements = await prisma.announcement.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <h1 className="text-lg font-semibold">Comunicaciones</h1>
      <div className="mt-6 space-y-3">
        {announcements.map((a) => (
          <Card key={a.id}>
            <p className="text-sm font-medium">{a.title}</p>
            <p className="mt-1 text-sm text-muted">{a.body}</p>
            <p className="mt-2 text-xs text-muted">{a.createdAt.toLocaleDateString("es-MX")}</p>
          </Card>
        ))}
        {announcements.length === 0 && (
          <p className="text-sm text-muted">No hay anuncios por el momento.</p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify it builds**

Run: `npm run build`
Expected: `/portal/comunicaciones` compiles as a dynamic route.

- [ ] **Step 4: Commit**

```bash
git add src/app/portal/comunicaciones src/components/portal/portal-nav.tsx
git commit -m "feat: add portal comunicaciones page"
```

---

## Post-plan checklist

- [ ] `npm test` — all suites pass
- [ ] `npx tsc --noEmit` — no type errors
- [ ] `npm run build` — production build succeeds, all new routes listed
- [ ] Manual smoke test: log in as admin, publish an ALL-audience announcement with "enviar por correo" checked, confirm it shows on `/admin/comunicaciones`; log in as the seeded student/parent/teacher accounts and confirm the announcement appears on `/portal/comunicaciones`; log in as staff and confirm ALL/ROLE options are unavailable and a foreign campus can't be selected
