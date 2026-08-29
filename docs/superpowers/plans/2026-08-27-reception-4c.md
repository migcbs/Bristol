# Bristol Recepción 4c — Comercial y Comunicación Interna — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the final third of Spec 4 (Recepción) — assigning a commercial advisor to a `Lead`, an inter-area ticket inbox, and a notification bell wired into two concrete existing events (group-change-request approval, advisor assignment).

**Architecture:** `Lead.asesorAsignadoId` and the extended `LeadSource`/`LeadStatus` enums were already added in Spec 4a's migration — this plan does NOT touch the `Lead` schema again. It reuses the existing `PATCH /api/admin/leads/[id]` route (Spec 2f) rather than adding a parallel `/assign` endpoint. See `docs/superpowers/specs/2026-08-27-reception-design.md`'s "Nota de alcance (actualizada tras 4a/4b)" for the full reasoning, already written up before this plan.

**Tech Stack:** Next.js 16 (App Router), Prisma/PostgreSQL, Vitest.

## Global Constraints

- Node ≥22 required — prepend node 22's bin dir to `PATH` before any npm/npx command.
- This repo lives on a network volume that spawns `._<filename>` AppleDouble junk files on write (gitignored); clean with `find . -name "._*" -not -path "./node_modules/*" -not -path "./.git/*" -delete` before build/test.
- Any schema migration that requires a destructive `prisma migrate reset` MUST get the human's explicit, real-time consent first — if `prisma migrate dev` refuses to run non-interactively, STOP and report `NEEDS_CONTEXT`; the controller session obtains consent and runs the reset, never the implementer. This plan's migration (two new tables, no changes to existing columns) is expected to be purely additive and should not require this.
- Every write endpoint that accepts or resolves a `campusId`-scoped resource MUST use `assertCampusInScope`/`getCampusScope` from `src/lib/campus-scope.ts` for a STAFF caller — do not reimplement the check inline. This exact class of bug recurred multiple times across the two previous sub-specs.
- `notify()` is a direct function call at the point where a business event already happens — it is NOT a generic event bus. Only wire it into the two specific call sites named in Task 7; do not add speculative notification triggers elsewhere.
- Every task must leave `npm run build`, `npm test`, and `npx tsc --noEmit` passing.

---

## File Structure

```
prisma/
  schema.prisma                            # + InterAreaTicket, Notification, TicketStatus
src/
  lib/
    notifications.ts                           # NEW: notify(userId, message, link?)
  app/
    api/
      admin/
        leads/
          [id]/
            route.ts                                # MODIFY: accept asesorAsignadoId, fix VALID_STATUSES
        tickets/
          route.ts                                # NEW: GET, POST
          [id]/
            route.ts                                    # NEW: PATCH
        notifications/
          route.ts                                # NEW: GET
          [id]/
            read/
              route.ts                                    # NEW: PATCH
    admin/
      tickets/
        page.tsx                                    # NEW
      group-change-requests/route.ts (already exists) — MODIFY to call notify() on approval/rejection
      layout.tsx                                  # MODIFY: notification bell
  components/
    admin/
      lead-row-actions.tsx                    # MODIFY: + advisor selector
      notification-bell.tsx                   # NEW
tests/
  lib/
    notifications.test.ts
  api/
    admin-leads-patch-advisor.test.ts
    admin-tickets-get-post.test.ts
    admin-tickets-patch.test.ts
    admin-notifications.test.ts
```

---

### Task 1: Schema — InterAreaTicket and Notification

**Files:**
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Produces: `TicketStatus` enum, `InterAreaTicket` model, `Notification` model — consumed by every later task.

- [ ] **Step 1: Add the models**

```prisma
enum TicketStatus {
  ABIERTO
  EN_PROCESO
  RESUELTO
}

model InterAreaTicket {
  id           String       @id @default(cuid())
  title        String
  description  String
  createdById  String
  assignedToId String?
  status       TicketStatus @default(ABIERTO)
  createdAt    DateTime     @default(now())
  resolvedAt   DateTime?

  createdBy  User  @relation("TicketCreatedBy", fields: [createdById], references: [id], onDelete: Cascade)
  assignedTo User? @relation("TicketAssignedTo", fields: [assignedToId], references: [id])
}

model Notification {
  id        String    @id @default(cuid())
  userId    String
  message   String
  link      String?
  readAt    DateTime?
  createdAt DateTime  @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

Add back-references to `User`: `createdTickets InterAreaTicket[] @relation("TicketCreatedBy")`, `assignedTickets InterAreaTicket[] @relation("TicketAssignedTo")`, `notifications Notification[]`.

- [ ] **Step 2: Run the migration**

Run: `npx prisma migrate dev --name reception_4c_tickets_notifications`. This is purely additive (two new tables) and should not require a reset. If it does, STOP and report `NEEDS_CONTEXT` per Global Constraints.

- [ ] **Step 3: Verify**

Run: `npx prisma format --check` (fix with `npx prisma format` if needed), `npx prisma migrate status` (no drift), then `npx tsc --noEmit` (generate `.next/types` via `npx next typegen` first if `tsc` only complains about `LayoutProps<"/">` — never edit that file).

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat: add InterAreaTicket and Notification models"
```

---

### Task 2: notify() helper

**Files:**
- Create: `src/lib/notifications.ts`
- Test: `tests/lib/notifications.test.ts`

**Interfaces:**
- Produces: `notify(userId: string, message: string, link?: string): Promise<void>` — consumed by Task 7's wiring.

- [ ] **Step 1: Write the failing tests**

`tests/lib/notifications.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { notification: { create: vi.fn() } },
}));

import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notifications";

describe("notify", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a notification with the given userId, message, and link", async () => {
    (prisma.notification.create as any).mockResolvedValue({ id: "n1" });
    await notify("u1", "Tu solicitud fue aprobada", "/admin/control-escolar/solicitudes");
    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: { userId: "u1", message: "Tu solicitud fue aprobada", link: "/admin/control-escolar/solicitudes" },
    });
  });

  it("creates a notification with a null link when omitted", async () => {
    (prisma.notification.create as any).mockResolvedValue({ id: "n1" });
    await notify("u1", "Se te asignó un lead");
    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: { userId: "u1", message: "Se te asignó un lead", link: null },
    });
  });

  it("swallows a Prisma error rather than throwing, so a failed notification never breaks the caller's business logic", async () => {
    (prisma.notification.create as any).mockRejectedValue(new Error("DB down"));
    await expect(notify("u1", "test")).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/lib/notifications.test.ts`
Expected: FAIL — module doesn't exist yet.

- [ ] **Step 3: Implement**

`src/lib/notifications.ts`:
```ts
import { prisma } from "@/lib/prisma";

/**
 * Fire-and-forget notification creation. A failure here (e.g. a transient
 * DB error) must never propagate to the caller — notify() is always called
 * from inside an already-successful business operation (an approval, an
 * assignment), and that operation's own success must not be undone by a
 * notification-side failure.
 */
export async function notify(userId: string, message: string, link?: string): Promise<void> {
  try {
    await prisma.notification.create({ data: { userId, message, link: link ?? null } });
  } catch (error) {
    console.error("No se pudo crear la notificación:", error);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/lib/notifications.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/notifications.ts tests/lib/notifications.test.ts
git commit -m "feat: add notify() helper"
```

---

### Task 3: Extend PATCH /api/admin/leads/[id] with advisor assignment

**Files:**
- Modify: `src/app/api/admin/leads/[id]/route.ts`
- Test: `tests/api/admin-leads-patch-advisor.test.ts`

**Interfaces:**
- Consumes: `assertCampusInScope`, `notify` (Task 2), `prisma`.
- Produces: `PATCH /api/admin/leads/[id]` gains `asesorAsignadoId` support — consumed by Task 8's advisor selector.

- [ ] **Step 1: Read the current file in full**

Read `src/app/api/admin/leads/[id]/route.ts` (already shown in this plan's context — reproduced below for reference) before editing. You are ADDING to it, not rewriting it:

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

  let body: { status?: string; campusId?: string | null };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Cuerpo de la solicitud inválido" }, { status: 400 });
  }

  if (body.status !== undefined && !VALID_STATUSES.includes(body.status as LeadStatus)) {
    return Response.json({ error: "Estatus inválido" }, { status: 400 });
  }

  const targetCampusId = body.campusId;

  if (targetCampusId !== undefined && targetCampusId !== null) {
    const campus = await prisma.campus.findUnique({ where: { id: targetCampusId } });
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

  if (
    targetCampusId !== undefined &&
    targetCampusId !== null &&
    scope.type === "CAMPUS_LIST" &&
    !scope.campusIds.includes(targetCampusId)
  ) {
    return Response.json({ error: "Plantel fuera de tu alcance" }, { status: 400 });
  }

  const inScope =
    scope.type === "ALL" ||
    (scope.type === "CAMPUS_LIST" &&
      (lead.campusId === null || scope.campusIds.includes(lead.campusId)));

  if (!inScope) {
    return Response.json({ error: "No encontrado" }, { status: 404 });
  }

  const data: { status?: LeadStatus; campusId?: string | null } = {};
  if (body.status !== undefined) data.status = body.status as LeadStatus;
  if (body.campusId !== undefined) data.campusId = body.campusId;

  const updated = await prisma.lead.update({ where: { id }, data });
  return Response.json(updated);
}
```

- [ ] **Step 2: Write the failing tests**

`tests/api/admin-leads-patch-advisor.test.ts` (a NEW, separate test file focused only on the advisor-assignment addition — do not duplicate the existing status/campus tests, which presumably already exist in another test file for this route; if you find that file, leave it untouched):
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/campus-scope", () => ({ getCampusScope: vi.fn() }));
vi.mock("@/lib/notifications", () => ({ notify: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    campus: { findUnique: vi.fn() },
    lead: { findUnique: vi.fn(), update: vi.fn() },
    user: { findUnique: vi.fn() },
  },
}));

import { auth } from "@/lib/auth";
import { getCampusScope } from "@/lib/campus-scope";
import { notify } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { PATCH } from "@/app/api/admin/leads/[id]/route";

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/admin/leads/l1", {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("PATCH /api/admin/leads/[id] — advisor assignment", () => {
  beforeEach(() => vi.clearAllMocks());

  it("accepts the new PLACEMENT_SCHEDULED status (regression test for the pre-existing VALID_STATUSES gap)", async () => {
    (auth as any).mockResolvedValue({ user: { id: "a1", role: "ADMIN" } });
    (prisma.lead.findUnique as any).mockResolvedValue({ id: "l1", campusId: "c1" });
    (getCampusScope as any).mockResolvedValue({ type: "ALL" });
    (prisma.lead.update as any).mockResolvedValue({ id: "l1", status: "PLACEMENT_SCHEDULED" });

    const res = await PATCH(jsonRequest({ status: "PLACEMENT_SCHEDULED" }), makeParams("l1"));
    expect(res.status).toBe(200);
  });

  it("returns 400 for a nonexistent asesorAsignadoId", async () => {
    (auth as any).mockResolvedValue({ user: { id: "a1", role: "ADMIN" } });
    (prisma.lead.findUnique as any).mockResolvedValue({ id: "l1", campusId: "c1" });
    (getCampusScope as any).mockResolvedValue({ type: "ALL" });
    (prisma.user.findUnique as any).mockResolvedValue(null);

    const res = await PATCH(jsonRequest({ asesorAsignadoId: "u404" }), makeParams("l1"));
    expect(res.status).toBe(400);
    expect(prisma.lead.update).not.toHaveBeenCalled();
  });

  it("assigns the advisor and notifies them on success", async () => {
    (auth as any).mockResolvedValue({ user: { id: "a1", role: "ADMIN" } });
    (prisma.lead.findUnique as any).mockResolvedValue({ id: "l1", campusId: "c1", name: "Ana Torres" });
    (getCampusScope as any).mockResolvedValue({ type: "ALL" });
    (prisma.user.findUnique as any).mockResolvedValue({ id: "advisor1" });
    (prisma.lead.update as any).mockResolvedValue({ id: "l1", asesorAsignadoId: "advisor1" });

    const res = await PATCH(jsonRequest({ asesorAsignadoId: "advisor1" }), makeParams("l1"));
    expect(res.status).toBe(200);
    expect(prisma.lead.update).toHaveBeenCalledWith({
      where: { id: "l1" },
      data: { asesorAsignadoId: "advisor1" },
    });
    expect(notify).toHaveBeenCalledWith(
      "advisor1",
      expect.stringContaining("Ana Torres"),
      expect.any(String)
    );
  });

  it("allows clearing the advisor assignment with null, without notifying anyone", async () => {
    (auth as any).mockResolvedValue({ user: { id: "a1", role: "ADMIN" } });
    (prisma.lead.findUnique as any).mockResolvedValue({ id: "l1", campusId: "c1" });
    (getCampusScope as any).mockResolvedValue({ type: "ALL" });
    (prisma.lead.update as any).mockResolvedValue({ id: "l1", asesorAsignadoId: null });

    const res = await PATCH(jsonRequest({ asesorAsignadoId: null }), makeParams("l1"));
    expect(res.status).toBe(200);
    expect(prisma.lead.update).toHaveBeenCalledWith({
      where: { id: "l1" },
      data: { asesorAsignadoId: null },
    });
    expect(notify).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test -- tests/api/admin-leads-patch-advisor.test.ts`
Expected: FAIL — the route doesn't yet accept `asesorAsignadoId`, and `VALID_STATUSES` doesn't include `PLACEMENT_SCHEDULED`.

- [ ] **Step 4: Implement**

Modify `src/app/api/admin/leads/[id]/route.ts`:

1. Fix the pre-existing gap: change `VALID_STATUSES` to `const VALID_STATUSES: LeadStatus[] = ["NEW", "CONTACTED", "PLACEMENT_SCHEDULED", "ENROLLED", "LOST"];`.
2. Import `notify` from `@/lib/notifications`.
3. Extend the body type to `{ status?: string; campusId?: string | null; asesorAsignadoId?: string | null }`.
4. After the existing campus-validity check and before the `lead`/`inScope` lookups (so all validation happens before the write), add: if `body.asesorAsignadoId !== undefined && body.asesorAsignadoId !== null`, look up `prisma.user.findUnique({ where: { id: body.asesorAsignadoId } })` and return 400 "Asesor inválido" if not found.
5. Extend the `data` object: `if (body.asesorAsignadoId !== undefined) data.asesorAsignadoId = body.asesorAsignadoId;`.
6. After the `prisma.lead.update` call succeeds, if `body.asesorAsignadoId` was provided and is non-null, call `await notify(body.asesorAsignadoId, \`Se te asignó el lead "${lead.name}"\`, "/admin/admisiones")` (using the ORIGINAL `lead` object fetched earlier for its `name`, not the updated one) — do not notify when clearing an assignment (`asesorAsignadoId: null`) or when it wasn't part of this request.

Read the STAFF campus-scope logic already in this file — it already handles the case for `campusId`; the `asesorAsignadoId` lookup/validation does NOT need a separate campus-scope check (assigning an advisor doesn't move the lead across campuses, it's an internal staffing detail), but do confirm this reasoning holds and doesn't conflict with anything you see in the file.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- tests/api/admin-leads-patch-advisor.test.ts`
Expected: PASS (4 tests). Also run the FULL suite to confirm this file's pre-existing tests (if any, for `status`/`campusId`) still pass unmodified: `npm test`.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/admin/leads tests/api/admin-leads-patch-advisor.test.ts
git commit -m "feat: add advisor assignment to PATCH /api/admin/leads/[id], fix VALID_STATUSES gap"
```

---

### Task 4: GET/POST /api/admin/tickets

**Files:**
- Create: `src/app/api/admin/tickets/route.ts`
- Test: `tests/api/admin-tickets-get-post.test.ts`

**Interfaces:**
- Consumes: `auth`, `prisma`.
- Produces: `GET/POST /api/admin/tickets` — consumed by Task 8's tickets page.

- [ ] **Step 1: Write the failing tests**

`tests/api/admin-tickets-get-post.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { interAreaTicket: { findMany: vi.fn(), create: vi.fn() }, user: { findUnique: vi.fn() } },
}));

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { GET, POST } from "@/app/api/admin/tickets/route";

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/admin/tickets", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("GET /api/admin/tickets", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 without a session", async () => {
    (auth as any).mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns all tickets, most recent first", async () => {
    (auth as any).mockResolvedValue({ user: { id: "a1", role: "ADMIN" } });
    (prisma.interAreaTicket.findMany as any).mockResolvedValue([]);

    const res = await GET();
    expect(res.status).toBe(200);
    expect(prisma.interAreaTicket.findMany).toHaveBeenCalledWith({
      orderBy: { createdAt: "desc" },
      include: {
        createdBy: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, name: true } },
      },
    });
  });
});

describe("POST /api/admin/tickets", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 without a session", async () => {
    (auth as any).mockResolvedValue(null);
    const res = await POST(jsonRequest({ title: "t", description: "d" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 for a blank title or description", async () => {
    (auth as any).mockResolvedValue({ user: { id: "a1", role: "ADMIN" } });
    const res = await POST(jsonRequest({ title: "   ", description: "d" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for a nonexistent assignedToId", async () => {
    (auth as any).mockResolvedValue({ user: { id: "a1", role: "ADMIN" } });
    (prisma.user.findUnique as any).mockResolvedValue(null);
    const res = await POST(jsonRequest({ title: "t", description: "d", assignedToId: "u404" }));
    expect(res.status).toBe(400);
    expect(prisma.interAreaTicket.create).not.toHaveBeenCalled();
  });

  it("creates the ticket on success", async () => {
    (auth as any).mockResolvedValue({ user: { id: "a1", role: "STAFF" } });
    (prisma.interAreaTicket.create as any).mockResolvedValue({ id: "t1" });

    const res = await POST(jsonRequest({ title: "Reposición de examen", description: "Alumno solicita..." }));
    expect(res.status).toBe(201);
    expect(prisma.interAreaTicket.create).toHaveBeenCalledWith({
      data: {
        title: "Reposición de examen",
        description: "Alumno solicita...",
        assignedToId: null,
        createdById: "a1",
      },
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/api/admin-tickets-get-post.test.ts`
Expected: FAIL — route doesn't exist yet.

- [ ] **Step 3: Implement**

`src/app/api/admin/tickets/route.ts`:
```ts
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";

const MAX_TITLE_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 2000;

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }
  const role = (session.user as { role: Role }).role;
  if (role !== "ADMIN" && role !== "STAFF") {
    return Response.json({ error: "No autorizado" }, { status: 403 });
  }

  const tickets = await prisma.interAreaTicket.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      createdBy: { select: { id: true, name: true } },
      assignedTo: { select: { id: true, name: true } },
    },
  });

  return Response.json(tickets);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }
  const role = (session.user as { role: Role }).role;
  if (role !== "ADMIN" && role !== "STAFF") {
    return Response.json({ error: "No autorizado" }, { status: 403 });
  }

  let body: { title?: string; description?: string; assignedToId?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Cuerpo de la solicitud inválido" }, { status: 400 });
  }

  const title = body.title?.trim();
  const description = body.description?.trim();
  if (!title || title.length > MAX_TITLE_LENGTH || !description || description.length > MAX_DESCRIPTION_LENGTH) {
    return Response.json({ error: "Datos inválidos" }, { status: 400 });
  }

  if (body.assignedToId) {
    const assignee = await prisma.user.findUnique({ where: { id: body.assignedToId } });
    if (!assignee) {
      return Response.json({ error: "Usuario asignado inválido" }, { status: 400 });
    }
  }

  const ticket = await prisma.interAreaTicket.create({
    data: {
      title,
      description,
      assignedToId: body.assignedToId ?? null,
      createdById: (session.user as { id: string }).id,
    },
  });

  return Response.json(ticket, { status: 201 });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/api/admin-tickets-get-post.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add src/app/api/admin/tickets tests/api/admin-tickets-get-post.test.ts
git commit -m "feat: add GET/POST /api/admin/tickets"
```

---

### Task 5: PATCH /api/admin/tickets/[id]

**Files:**
- Create: `src/app/api/admin/tickets/[id]/route.ts`
- Test: `tests/api/admin-tickets-patch.test.ts`

**Interfaces:**
- Consumes: `auth`, `prisma`.
- Produces: `PATCH /api/admin/tickets/[id]` — consumed by Task 8's tickets page (status transitions, reassignment).

- [ ] **Step 1: Write the failing tests**

`tests/api/admin-tickets-patch.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { interAreaTicket: { findUnique: vi.fn(), update: vi.fn() }, user: { findUnique: vi.fn() } },
}));

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PATCH } from "@/app/api/admin/tickets/[id]/route";

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/admin/tickets/t1", {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("PATCH /api/admin/tickets/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 without a session", async () => {
    (auth as any).mockResolvedValue(null);
    const res = await PATCH(jsonRequest({ status: "EN_PROCESO" }), makeParams("t1"));
    expect(res.status).toBe(401);
  });

  it("returns 400 for an invalid status value", async () => {
    (auth as any).mockResolvedValue({ user: { id: "a1", role: "ADMIN" } });
    const res = await PATCH(jsonRequest({ status: "BOGUS" }), makeParams("t1"));
    expect(res.status).toBe(400);
  });

  it("returns 404 for a nonexistent ticket", async () => {
    (auth as any).mockResolvedValue({ user: { id: "a1", role: "ADMIN" } });
    (prisma.interAreaTicket.findUnique as any).mockResolvedValue(null);
    const res = await PATCH(jsonRequest({ status: "EN_PROCESO" }), makeParams("t1"));
    expect(res.status).toBe(404);
  });

  it("sets resolvedAt when transitioning to RESUELTO, clears it otherwise", async () => {
    (auth as any).mockResolvedValue({ user: { id: "a1", role: "ADMIN" } });
    (prisma.interAreaTicket.findUnique as any).mockResolvedValue({ id: "t1", status: "EN_PROCESO" });
    (prisma.interAreaTicket.update as any).mockResolvedValue({ id: "t1", status: "RESUELTO" });

    const res = await PATCH(jsonRequest({ status: "RESUELTO" }), makeParams("t1"));
    expect(res.status).toBe(200);
    expect(prisma.interAreaTicket.update).toHaveBeenCalledWith({
      where: { id: "t1" },
      data: { status: "RESUELTO", resolvedAt: expect.any(Date) },
    });
  });

  it("allows reassignment via assignedToId", async () => {
    (auth as any).mockResolvedValue({ user: { id: "a1", role: "ADMIN" } });
    (prisma.interAreaTicket.findUnique as any).mockResolvedValue({ id: "t1", status: "ABIERTO" });
    (prisma.user.findUnique as any).mockResolvedValue({ id: "u2" });
    (prisma.interAreaTicket.update as any).mockResolvedValue({ id: "t1", assignedToId: "u2" });

    const res = await PATCH(jsonRequest({ assignedToId: "u2" }), makeParams("t1"));
    expect(res.status).toBe(200);
    expect(prisma.interAreaTicket.update).toHaveBeenCalledWith({
      where: { id: "t1" },
      data: { assignedToId: "u2" },
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/api/admin-tickets-patch.test.ts`
Expected: FAIL — route doesn't exist yet.

- [ ] **Step 3: Implement**

`src/app/api/admin/tickets/[id]/route.ts`:
```ts
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Role, TicketStatus } from "@prisma/client";

const VALID_STATUSES: TicketStatus[] = ["ABIERTO", "EN_PROCESO", "RESUELTO"];

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }
  const role = (session.user as { role: Role }).role;
  if (role !== "ADMIN" && role !== "STAFF") {
    return Response.json({ error: "No autorizado" }, { status: 403 });
  }

  let body: { status?: string; assignedToId?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Cuerpo de la solicitud inválido" }, { status: 400 });
  }

  if (body.status !== undefined && !VALID_STATUSES.includes(body.status as TicketStatus)) {
    return Response.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const { id } = await params;
  const ticket = await prisma.interAreaTicket.findUnique({ where: { id } });
  if (!ticket) {
    return Response.json({ error: "No encontrado" }, { status: 404 });
  }

  if (body.assignedToId) {
    const assignee = await prisma.user.findUnique({ where: { id: body.assignedToId } });
    if (!assignee) {
      return Response.json({ error: "Usuario asignado inválido" }, { status: 400 });
    }
  }

  const data: { status?: TicketStatus; resolvedAt?: Date | null; assignedToId?: string } = {};
  if (body.status !== undefined) {
    data.status = body.status as TicketStatus;
    data.resolvedAt = body.status === "RESUELTO" ? new Date() : null;
  }
  if (body.assignedToId !== undefined) {
    data.assignedToId = body.assignedToId;
  }

  const updated = await prisma.interAreaTicket.update({ where: { id }, data });
  return Response.json(updated);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/api/admin-tickets-patch.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/app/api/admin/tickets tests/api/admin-tickets-patch.test.ts
git commit -m "feat: add PATCH /api/admin/tickets/[id]"
```

---

### Task 6: GET /api/admin/notifications and PATCH /api/admin/notifications/[id]/read

**Files:**
- Create: `src/app/api/admin/notifications/route.ts` (GET)
- Create: `src/app/api/admin/notifications/[id]/read/route.ts` (PATCH)
- Test: `tests/api/admin-notifications.test.ts`

**Interfaces:**
- Consumes: `auth`, `prisma`.
- Produces: `GET /api/admin/notifications`, `PATCH /api/admin/notifications/[id]/read` — consumed by Task 8's `<NotificationBell>`.

- [ ] **Step 1: Write the failing tests**

`tests/api/admin-notifications.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { notification: { findMany: vi.fn(), updateMany: vi.fn() } },
}));

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { GET } from "@/app/api/admin/notifications/route";
import { PATCH } from "@/app/api/admin/notifications/[id]/read/route";

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("GET /api/admin/notifications", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 without a session", async () => {
    (auth as any).mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns only the caller's own notifications, most recent first", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1", role: "ADMIN" } });
    (prisma.notification.findMany as any).mockResolvedValue([]);

    const res = await GET();
    expect(res.status).toBe(200);
    expect(prisma.notification.findMany).toHaveBeenCalledWith({
      where: { userId: "u1" },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
  });
});

describe("PATCH /api/admin/notifications/[id]/read", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 without a session", async () => {
    (auth as any).mockResolvedValue(null);
    const res = await PATCH(new Request("http://localhost"), makeParams("n1"));
    expect(res.status).toBe(401);
  });

  it("marks the notification read only if it belongs to the caller (scoped updateMany), 404 if not", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1", role: "ADMIN" } });
    (prisma.notification.updateMany as any).mockResolvedValue({ count: 0 });

    const res = await PATCH(new Request("http://localhost"), makeParams("n1"));
    expect(res.status).toBe(404);
    expect(prisma.notification.updateMany).toHaveBeenCalledWith({
      where: { id: "n1", userId: "u1" },
      data: { readAt: expect.any(Date) },
    });
  });

  it("returns 200 when the notification belongs to the caller", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1", role: "ADMIN" } });
    (prisma.notification.updateMany as any).mockResolvedValue({ count: 1 });

    const res = await PATCH(new Request("http://localhost"), makeParams("n1"));
    expect(res.status).toBe(200);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/api/admin-notifications.test.ts`
Expected: FAIL — routes don't exist yet.

- [ ] **Step 3: Implement**

`src/app/api/admin/notifications/route.ts`:
```ts
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }

  const notifications = await prisma.notification.findMany({
    where: { userId: (session.user as { id: string }).id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return Response.json(notifications);
}
```

`src/app/api/admin/notifications/[id]/read/route.ts`:
```ts
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }

  const { id } = await params;
  const result = await prisma.notification.updateMany({
    where: { id, userId: (session.user as { id: string }).id },
    data: { readAt: new Date() },
  });

  if (result.count === 0) {
    return Response.json({ error: "No encontrado" }, { status: 404 });
  }

  return Response.json({ ok: true });
}
```

Note this route deliberately has NO role gate (unlike every admin route in this project) — any authenticated user (including TEACHER/STUDENT/PARENT) can have notifications and must be able to read/mark their own. The `userId` scoping in the `where` clause (not a role check) is what makes this safe — a user can only ever touch their own notifications.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/api/admin-notifications.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/app/api/admin/notifications tests/api/admin-notifications.test.ts
git commit -m "feat: add notifications GET and mark-read endpoints"
```

---

### Task 7: Wire notify() into GroupChangeRequest approval

**Files:**
- Modify: `src/app/api/admin/group-change-requests/[id]/route.ts`

**Interfaces:**
- Consumes: `notify` (Task 2).
- Produces: the requester of a `GroupChangeRequest` gets notified when it's approved or rejected.

- [ ] **Step 1: Read the current file in full**

Read `src/app/api/admin/group-change-requests/[id]/route.ts` (from Spec 4b, already merged) before editing — it exports `reviewGroupChangeRequest`, the single write path used by both the `PATCH` route and a Server Action on `/admin/control-escolar/solicitudes`.

- [ ] **Step 2: Add the notification calls**

Inside `reviewGroupChangeRequest`, after each successful outcome (both the RECHAZADA branch's `update` and the APROBADA branch's `$transaction`), call:
```ts
await notify(
  changeRequest.requestedById,
  decision === "APROBADA"
    ? "Tu solicitud de cambio de grupo fue aprobada"
    : "Tu solicitud de cambio de grupo fue rechazada",
  "/admin/control-escolar/solicitudes"
);
```
Place this call AFTER the database write succeeds (so a notification failure — which `notify()` itself already swallows internally per Task 2 — can never roll back or block the actual approval/rejection), and BEFORE the function returns its response. Import `notify` from `@/lib/notifications` at the top of the file.

No new automated test is required for this task specifically (the existing `tests/api/admin-group-change-requests-patch.test.ts` mocks `@/lib/notifications` implicitly via its existing `prisma` mocks not covering `notification.create` — check whether adding this call breaks any existing test by requiring you to add `vi.mock("@/lib/notifications", () => ({ notify: vi.fn() }))` to that test file; if the existing tests fail because `notify` now gets called against the real, unmocked module, add that one mock line to the top of the existing test file — this is the one exception to "don't touch other files," since it's a direct, minimal, required consequence of this task's own change).

- [ ] **Step 3: Run tests to verify nothing broke**

Run: `npm test -- tests/api/admin-group-change-requests-patch.test.ts` then the full suite `npm test`.
Expected: all still passing (with the one mock addition from Step 2 if needed).

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit`.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/admin/group-change-requests
git commit -m "feat: notify the requester when a group change request is reviewed"
```

---

### Task 8: Tickets page, notification bell, advisor selector

**Files:**
- Create: `src/app/admin/tickets/page.tsx`
- Create: `src/components/admin/notification-bell.tsx`
- Modify: `src/components/admin/lead-row-actions.tsx` (add advisor selector)
- Modify: `src/app/admin/admisiones/page.tsx` (pass the list of assignable advisors to `LeadRowActions`)
- Modify: `src/app/admin/layout.tsx` (mount `<NotificationBell>`)
- Modify: `src/components/admin/admin-nav.tsx` (add "Tickets" entry)

**Interfaces:**
- Consumes: `GET/POST /api/admin/tickets` (Task 4), `PATCH /api/admin/tickets/[id]` (Task 5), `GET/PATCH /api/admin/notifications*` (Task 6), the extended `PATCH /api/admin/leads/[id]` (Task 3).
- Produces: `/admin/tickets`, a notification bell visible on every admin page, an advisor dropdown on each lead row in Admisiones.

- [ ] **Step 1: Add the nav entry**

In `src/components/admin/admin-nav.tsx`, add `{ href: "/admin/tickets", label: "Tickets" }` to the end of `MODULES`.

- [ ] **Step 2: Tickets page**

`src/app/admin/tickets/page.tsx`: server component, standard redirect gate (unauthenticated → `/login`, non-ADMIN/STAFF → `/portal`), fetches tickets and a list of ADMIN+STAFF users (for the assignee dropdown) directly via Prisma (matching this project's established server-component convention — mirror the query shape from `GET /api/admin/tickets`), renders a table (Título | Descripción | Asignado a | Estatus | Creado) with a small client sub-form (inline Server Actions, matching the pattern already used on `/admin/recepcion/bitacora` and `/admin/control-escolar/solicitudes`) for creating a new ticket and for changing an existing ticket's status/assignee.

- [ ] **Step 3: NotificationBell**

`src/components/admin/notification-bell.tsx`:
```tsx
"use client";

import { useEffect, useState } from "react";

interface NotificationRow {
  id: string;
  message: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);

  async function load() {
    try {
      const res = await fetch("/api/admin/notifications");
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data)) setNotifications(data);
    } catch {
      // silent — the bell just stays as-is
    }
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []);

  const unreadCount = notifications.filter((n) => !n.readAt).length;

  async function markRead(id: string) {
    await fetch(`/api/admin/notifications/${id}/read`, { method: "PATCH" });
    load();
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="relative rounded-full px-2 py-1 text-sm"
        aria-label="Notificaciones"
      >
        🔔
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 rounded-full bg-accent px-1.5 text-[10px] text-white">
            {unreadCount}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-80 rounded-lg border border-border bg-white p-2 shadow-lg">
          {notifications.length === 0 && <p className="p-2 text-sm text-muted">Sin notificaciones.</p>}
          {notifications.map((n) => (
            <div
              key={n.id}
              className={`rounded-md p-2 text-sm ${n.readAt ? "text-muted" : "font-medium"}`}
            >
              <p>{n.message}</p>
              {!n.readAt && (
                <button onClick={() => markRead(n.id)} className="mt-1 text-xs text-primary underline">
                  Marcar como leída
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Mount NotificationBell in admin layout**

Read `src/app/admin/layout.tsx` (already modified once in Spec 4a for `<CommandPalette>`/`<QuickCreateDrawer>` — read its current full content first). Add `<NotificationBell />` next to `<QuickCreateDrawer>` in the header's right-hand section.

- [ ] **Step 5: Advisor selector on Admisiones**

Read `src/components/admin/lead-row-actions.tsx` (shown in full in this plan's earlier context) and `src/app/admin/admisiones/page.tsx` before editing. Add an `asesorAsignadoId`/`asesorAsignado` prop and a third `<select>` (matching the existing two selects' styling) to `LeadRowActions`, listing ADMIN+STAFF users as options plus a "Sin asignar" option, calling `update({ asesorAsignadoId: ... })` the same way the existing status/campus handlers do. In `admisiones/page.tsx`, fetch the list of ADMIN+STAFF users (`prisma.user.findMany({ where: { role: { in: ["ADMIN", "STAFF"] } } })`) alongside the existing `leads`/`campuses` queries, and pass both the advisor list and each lead's current `asesorAsignadoId` down to `LeadRowActions`.

- [ ] **Step 6: Verify it builds**

Run: kill any running `next dev` (`pgrep -f "next dev" | xargs -r kill`), `rm -rf .next`, then `npm run build`. Confirm `/admin/tickets` compiles and every existing `/admin/*` page (the layout change affects all of them) still compiles.

- [ ] **Step 7: Commit**

```bash
git add src/app/admin/tickets src/components/admin/notification-bell.tsx src/components/admin/lead-row-actions.tsx src/app/admin/admisiones/page.tsx src/app/admin/layout.tsx src/components/admin/admin-nav.tsx
git commit -m "feat: add tickets page, notification bell, advisor selector"
```

---

## Post-plan checklist

- [ ] `npm test` — all suites pass
- [ ] `npx tsc --noEmit` — no type errors
- [ ] `npm run build` — production build succeeds, all new routes listed
- [ ] Manual smoke test: assign an advisor to a lead on `/admin/admisiones`, confirm a notification appears in that advisor's bell on next login; create a ticket on `/admin/tickets`, change its status to RESUELTO; approve a pending group-change-request and confirm the requester's bell shows the notification
