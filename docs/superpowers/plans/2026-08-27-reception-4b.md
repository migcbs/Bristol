# Bristol Recepción 4b — Finanzas y Escolar — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the second third of Spec 4 (Recepción) — the bridge to Caja (extend `Invoice` for "Enviar a Caja" with scholarship/discount audit trail, a financial-status badge) and to Control Escolar (`Group.cupoMaximo` + availability matrix, `BlockEvaluation` for the real LSRWG grading format, and a `GroupChangeRequest` approval workflow that reuses Reinscripciones' existing transaction logic rather than reimplementing it).

**Architecture:** `Invoice` (Spec 2b, Cobranzas) is extended with audit-trail fields, not replaced — see `docs/superpowers/specs/2026-08-27-reception-design.md`'s "Decisiones de arquitectura" §5, already confirmed with the user. `BlockEvaluation` is a genuinely new model (also already confirmed) since its 5-fixed-score shape is incompatible with the existing free-form `Grade`. `GroupChangeRequest`'s approval handler for `CAMBIO_GRUPO` reuses the exact same transaction (`updateMany` count-guard + `create`) already proven correct in `src/app/api/admin/reinscripciones/route.ts` — do not reimplement that logic from scratch.

**Tech Stack:** Next.js 16 (App Router), Prisma/PostgreSQL, Vitest.

## Global Constraints

- Node ≥22 required — prepend node 22's bin dir to `PATH` before any npm/npx command.
- This repo lives on a network volume that spawns `._<filename>` AppleDouble junk files on write (gitignored); clean with `find . -name "._*" -not -path "./node_modules/*" -not -path "./.git/*" -delete` before build/test.
- Any schema migration that requires a destructive `prisma migrate reset` MUST get the human's explicit, real-time consent first (Prisma's own CLI enforces this for AI agents) — if `prisma migrate dev` refuses to run non-interactively due to existing incompatible data, STOP and report `NEEDS_CONTEXT` rather than attempting a workaround; the controller session, not the implementer, obtains consent and runs the reset.
- Every write endpoint that accepts a `campusId` (directly, or indirectly via a related record like `Group`/`Student`/`Lead`) MUST verify a STAFF caller's scope via `getCampusScope`/`assertCampusInScope` (already in `src/lib/campus-scope.ts`) before writing — this exact class of bug recurred three times in the previous sub-spec (4a) and must not recur here. Use `assertCampusInScope` directly rather than reimplementing the ternary inline.
- `GroupChangeRequest` approval for `type: CAMBIO_GRUPO` MUST reuse the transaction shape already in `src/app/api/admin/reinscripciones/route.ts` (`updateMany` with a `count !== 1` race guard, then `create`) — read that file before writing the approval handler.
- Free-text/URL inputs get the same hygiene the last several specs' final reviews required up front: trim, non-empty-after-trim where meaningful, length caps.
- Every task must leave `npm run build`, `npm test`, and `npx tsc --noEmit` passing.

---

## File Structure

```
prisma/
  schema.prisma                            # + Invoice fields, Group.cupoMaximo, BlockEvaluation, GroupChangeRequest
src/
  lib/
    financial-status.ts                        # NEW: computeFinancialStatus(invoices)
  app/
    api/
      admin/
        invoices/
          from-reception/
            route.ts                                # NEW: POST
        students/
          [id]/
            financial-status/
              route.ts                                    # NEW: GET
        groups/
          availability/
            route.ts                                # NEW: GET
        block-evaluations/
          route.ts                                # NEW: POST
        group-change-requests/
          route.ts                                # NEW: GET, POST
          [id]/
            route.ts                                    # NEW: PATCH
    admin/
      recepcion/
        grupos-disponibilidad/
          page.tsx                                    # NEW
      control-escolar/
        solicitudes/
          page.tsx                                    # NEW
  components/
    admin/
      financial-status-badge.tsx           # NEW
      admin-nav.tsx                         # MODIFY: + Solicitudes, Disponibilidad entries
    portal/
      block-evaluation-form.tsx             # NEW
tests/
  lib/
    financial-status.test.ts
  api/
    admin-invoices-from-reception.test.ts
    admin-students-financial-status.test.ts
    admin-groups-availability.test.ts
    admin-block-evaluations.test.ts
    admin-group-change-requests-post.test.ts
    admin-group-change-requests-patch.test.ts
```

---

### Task 1: Schema — extend Invoice/Group, add BlockEvaluation and GroupChangeRequest

**Files:**
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Produces: extended `Invoice`/`Group`, new `BlockEvaluation`/`GroupChangeRequest`/`GroupChangeRequestType`/`GroupChangeRequestStatus` — consumed by every later task in this plan.

- [ ] **Step 1: Extend `Invoice`**

Add these fields to the existing `Invoice` model (keep every existing field, including `stripeCheckoutSessionId`/`status`/`amountCents`, untouched — `amountCents` remains the actual amount billed/charged via Stripe; the new fields are audit-trail additions only):
```prisma
model Invoice {
  // ...existing fields...
  baseCents                 Int?
  scholarshipPercent        Decimal?  @db.Decimal(5, 2)
  earlyPaymentDiscountCents Int?
}
```

- [ ] **Step 2: Extend `Group`**

Add one field:
```prisma
model Group {
  // ...existing fields...
  cupoMaximo Int @default(20)
}
```

- [ ] **Step 3: Add `BlockEvaluation`**

```prisma
model BlockEvaluation {
  id             String   @id @default(cuid())
  enrollmentId   String
  bloqueNumero   Int
  notaListening  Decimal  @db.Decimal(4, 2)
  notaSpeaking   Decimal  @db.Decimal(4, 2)
  notaReading    Decimal  @db.Decimal(4, 2)
  notaWriting    Decimal  @db.Decimal(4, 2)
  notaGrammar    Decimal  @db.Decimal(4, 2)
  promedioBloque Decimal  @db.Decimal(4, 2)
  createdById    String
  createdAt      DateTime @default(now())

  enrollment Enrollment @relation(fields: [enrollmentId], references: [id], onDelete: Cascade)
  createdBy  User       @relation(fields: [createdById], references: [id], onDelete: Cascade)

  @@unique([enrollmentId, bloqueNumero])
}
```
Add `blockEvaluations BlockEvaluation[]` to `Enrollment`, and `createdBlockEvaluations BlockEvaluation[]` to `User`.

- [ ] **Step 4: Add `GroupChangeRequest`**

```prisma
enum GroupChangeRequestType {
  BAJA
  CAMBIO_GRUPO
}

enum GroupChangeRequestStatus {
  PENDIENTE
  APROBADA
  RECHAZADA
}

model GroupChangeRequest {
  id               String                   @id @default(cuid())
  type             GroupChangeRequestType
  studentId        String
  currentGroupId   String
  requestedGroupId String?
  reason           String
  status           GroupChangeRequestStatus @default(PENDIENTE)
  requestedById    String
  reviewedById     String?
  reviewedAt       DateTime?
  createdAt        DateTime                 @default(now())

  student        Student @relation(fields: [studentId], references: [id], onDelete: Cascade)
  currentGroup   Group   @relation("CurrentGroup", fields: [currentGroupId], references: [id])
  requestedGroup Group?  @relation("RequestedGroup", fields: [requestedGroupId], references: [id])
  requestedBy    User    @relation("RequestedBy", fields: [requestedById], references: [id], onDelete: Cascade)
  reviewedBy     User?   @relation("ReviewedBy", fields: [reviewedById], references: [id])
}
```
Add these back-references:
- `Student`: `groupChangeRequests GroupChangeRequest[]`
- `Group`: `changeRequestsFrom GroupChangeRequest[] @relation("CurrentGroup")` and `changeRequestsTo GroupChangeRequest[] @relation("RequestedGroup")`
- `User`: `requestedGroupChanges GroupChangeRequest[] @relation("RequestedBy")` and `reviewedGroupChanges GroupChangeRequest[] @relation("ReviewedBy")`

- [ ] **Step 5: Run the migration**

Run: `npx prisma migrate dev --name reception_4b_finance_escolar`. This is a purely additive migration (new optional/defaulted columns, new tables) against existing data — it should NOT require a destructive reset (unlike 4a's `Student.matricula`, nothing here is a new required-unique column on a populated table). If it unexpectedly does require one, STOP and report `NEEDS_CONTEXT` per the Global Constraints — do not run `migrate reset` yourself.

- [ ] **Step 6: Verify**

Run: `npx prisma format --check` (fix with `npx prisma format` if needed), `npx prisma migrate status` (no drift), then `npx tsc --noEmit` (generate `.next/types` first via `npx next typegen` if `tsc` only complains about `LayoutProps<"/">` in `src/app/layout.tsx` — never edit that file).

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat: extend Invoice/Group, add BlockEvaluation and GroupChangeRequest"
```

---

### Task 2: financial-status.ts helper

**Files:**
- Create: `src/lib/financial-status.ts`
- Test: `tests/lib/financial-status.test.ts`

**Interfaces:**
- Produces: `computeFinancialStatus(invoices)` — consumed by Task 4 (financial-status route) and Task 8 (badge component).

- [ ] **Step 1: Write the failing tests**

`tests/lib/financial-status.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { computeFinancialStatus } from "@/lib/financial-status";

describe("computeFinancialStatus", () => {
  it("returns AL_CORRIENTE when there are no invoices", () => {
    expect(computeFinancialStatus([])).toBe("AL_CORRIENTE");
  });

  it("returns AL_CORRIENTE when every invoice is PAID or CANCELED", () => {
    expect(computeFinancialStatus([{ status: "PAID" }, { status: "CANCELED" }])).toBe("AL_CORRIENTE");
  });

  it("returns MOROSO when any invoice is OVERDUE, even if others are PENDING", () => {
    expect(computeFinancialStatus([{ status: "PENDING" }, { status: "OVERDUE" }])).toBe("MOROSO");
  });

  it("returns PENDIENTE_DE_COBRO when at least one invoice is PENDING and none are OVERDUE", () => {
    expect(computeFinancialStatus([{ status: "PAID" }, { status: "PENDING" }])).toBe("PENDIENTE_DE_COBRO");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/lib/financial-status.test.ts`
Expected: FAIL — module doesn't exist yet.

- [ ] **Step 3: Implement**

`src/lib/financial-status.ts`:
```ts
export type FinancialStatus = "AL_CORRIENTE" | "PENDIENTE_DE_COBRO" | "MOROSO";

export function computeFinancialStatus(invoices: { status: string }[]): FinancialStatus {
  if (invoices.some((i) => i.status === "OVERDUE")) return "MOROSO";
  if (invoices.some((i) => i.status === "PENDING")) return "PENDIENTE_DE_COBRO";
  return "AL_CORRIENTE";
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/lib/financial-status.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/financial-status.ts tests/lib/financial-status.test.ts
git commit -m "feat: add computeFinancialStatus helper"
```

---

### Task 3: POST /api/admin/invoices/from-reception

**Files:**
- Create: `src/app/api/admin/invoices/from-reception/route.ts`
- Test: `tests/api/admin-invoices-from-reception.test.ts`

**Interfaces:**
- Consumes: `auth`, `getCampusScope`, `assertCampusInScope`, `prisma`.
- Produces: `POST /api/admin/invoices/from-reception` — the "Enviar a Caja" button's endpoint.

- [ ] **Step 1: Write the failing tests**

`tests/api/admin-invoices-from-reception.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/campus-scope", () => ({ getCampusScope: vi.fn(), assertCampusInScope: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { student: { findUnique: vi.fn() }, invoice: { create: vi.fn() } },
}));

import { auth } from "@/lib/auth";
import { assertCampusInScope } from "@/lib/campus-scope";
import { prisma } from "@/lib/prisma";
import { POST } from "@/app/api/admin/invoices/from-reception/route";

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/admin/invoices/from-reception", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

const VALID_BODY = {
  studentId: "st1",
  description: "Colegiatura septiembre",
  baseCents: 200000,
  dueDate: "2026-09-15",
};

describe("POST /api/admin/invoices/from-reception", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 without a session", async () => {
    (auth as any).mockResolvedValue(null);
    const res = await POST(jsonRequest(VALID_BODY));
    expect(res.status).toBe(401);
  });

  it("returns 403 for a TEACHER", async () => {
    (auth as any).mockResolvedValue({ user: { id: "t1", role: "TEACHER" } });
    const res = await POST(jsonRequest(VALID_BODY));
    expect(res.status).toBe(403);
  });

  it("returns 404 when the student doesn't exist", async () => {
    (auth as any).mockResolvedValue({ user: { id: "a1", role: "ADMIN" } });
    (prisma.student.findUnique as any).mockResolvedValue(null);
    const res = await POST(jsonRequest(VALID_BODY));
    expect(res.status).toBe(404);
    expect(prisma.invoice.create).not.toHaveBeenCalled();
  });

  it("returns 403 when STAFF targets a student outside their campus scope", async () => {
    (auth as any).mockResolvedValue({ user: { id: "s1", role: "STAFF" } });
    (prisma.student.findUnique as any).mockResolvedValue({ id: "st1", campusId: "c2" });
    (assertCampusInScope as any).mockResolvedValue(false);
    const res = await POST(jsonRequest(VALID_BODY));
    expect(res.status).toBe(403);
    expect(prisma.invoice.create).not.toHaveBeenCalled();
  });

  it("returns 400 for a scholarship percent out of 0-100 range", async () => {
    (auth as any).mockResolvedValue({ user: { id: "a1", role: "ADMIN" } });
    (prisma.student.findUnique as any).mockResolvedValue({ id: "st1", campusId: "c1" });
    const res = await POST(jsonRequest({ ...VALID_BODY, scholarshipPercent: 150 }));
    expect(res.status).toBe(400);
  });

  it("computes amountCents from base minus scholarship minus early-payment discount, and creates the invoice", async () => {
    (auth as any).mockResolvedValue({ user: { id: "a1", role: "ADMIN" } });
    (prisma.student.findUnique as any).mockResolvedValue({ id: "st1", campusId: "c1" });
    (prisma.invoice.create as any).mockResolvedValue({ id: "inv1" });

    const res = await POST(
      jsonRequest({
        ...VALID_BODY,
        scholarshipPercent: 20,
        earlyPaymentDiscountCents: 5000,
      })
    );
    expect(res.status).toBe(201);
    // base 200000 - 20% (40000) - 5000 = 155000
    expect(prisma.invoice.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        studentId: "st1",
        description: "Colegiatura septiembre",
        baseCents: 200000,
        scholarshipPercent: 20,
        earlyPaymentDiscountCents: 5000,
        amountCents: 155000,
        status: "PENDING",
      }),
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/api/admin-invoices-from-reception.test.ts`
Expected: FAIL — route doesn't exist yet.

- [ ] **Step 3: Implement**

`src/app/api/admin/invoices/from-reception/route.ts`:
```ts
import { auth } from "@/lib/auth";
import { assertCampusInScope } from "@/lib/campus-scope";
import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";

const MAX_DESCRIPTION_LENGTH = 200;

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
    studentId?: string;
    description?: string;
    baseCents?: number;
    scholarshipPercent?: number;
    earlyPaymentDiscountCents?: number;
    dueDate?: string;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Cuerpo de la solicitud inválido" }, { status: 400 });
  }

  const description = body.description?.trim();
  if (
    !body.studentId ||
    !description ||
    description.length > MAX_DESCRIPTION_LENGTH ||
    typeof body.baseCents !== "number" ||
    !Number.isInteger(body.baseCents) ||
    body.baseCents <= 0 ||
    !body.dueDate
  ) {
    return Response.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const dueDate = new Date(body.dueDate);
  if (Number.isNaN(dueDate.getTime())) {
    return Response.json({ error: "Fecha de vencimiento inválida" }, { status: 400 });
  }

  const scholarshipPercent = body.scholarshipPercent ?? 0;
  if (!Number.isFinite(scholarshipPercent) || scholarshipPercent < 0 || scholarshipPercent > 100) {
    return Response.json({ error: "El porcentaje de beca debe estar entre 0 y 100" }, { status: 400 });
  }

  const earlyPaymentDiscountCents = body.earlyPaymentDiscountCents ?? 0;
  if (!Number.isInteger(earlyPaymentDiscountCents) || earlyPaymentDiscountCents < 0) {
    return Response.json({ error: "El descuento por pronto pago es inválido" }, { status: 400 });
  }

  const student = await prisma.student.findUnique({ where: { id: body.studentId } });
  if (!student) {
    return Response.json({ error: "Alumno no encontrado" }, { status: 404 });
  }

  if (role === "STAFF") {
    const inScope = await assertCampusInScope(session.user as { id: string; role: Role }, student.campusId);
    if (!inScope) {
      return Response.json({ error: "No autorizado" }, { status: 403 });
    }
  }

  const scholarshipCents = Math.round((body.baseCents * scholarshipPercent) / 100);
  const amountCents = Math.max(0, body.baseCents - scholarshipCents - earlyPaymentDiscountCents);

  const invoice = await prisma.invoice.create({
    data: {
      studentId: body.studentId,
      description,
      baseCents: body.baseCents,
      scholarshipPercent,
      earlyPaymentDiscountCents,
      amountCents,
      dueDate,
      status: "PENDING",
    },
  });

  return Response.json(invoice, { status: 201 });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/api/admin-invoices-from-reception.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add src/app/api/admin/invoices/from-reception tests/api/admin-invoices-from-reception.test.ts
git commit -m "feat: add POST /api/admin/invoices/from-reception"
```

---

### Task 4: GET /api/admin/students/[id]/financial-status

**Files:**
- Create: `src/app/api/admin/students/[id]/financial-status/route.ts`
- Test: `tests/api/admin-students-financial-status.test.ts`

**Interfaces:**
- Consumes: `auth`, `assertCampusInScope`, `computeFinancialStatus`, `prisma`.
- Produces: `GET /api/admin/students/[id]/financial-status` — consumed by Task 8's badge component.

- [ ] **Step 1: Write the failing tests**

`tests/api/admin-students-financial-status.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/campus-scope", () => ({ assertCampusInScope: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { student: { findUnique: vi.fn() }, invoice: { findMany: vi.fn() } },
}));

import { auth } from "@/lib/auth";
import { assertCampusInScope } from "@/lib/campus-scope";
import { prisma } from "@/lib/prisma";
import { GET } from "@/app/api/admin/students/[id]/financial-status/route";

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("GET /api/admin/students/[id]/financial-status", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 without a session", async () => {
    (auth as any).mockResolvedValue(null);
    const res = await GET(new Request("http://localhost"), makeParams("st1"));
    expect(res.status).toBe(401);
  });

  it("returns 404 when the student doesn't exist", async () => {
    (auth as any).mockResolvedValue({ user: { id: "a1", role: "ADMIN" } });
    (prisma.student.findUnique as any).mockResolvedValue(null);
    const res = await GET(new Request("http://localhost"), makeParams("st1"));
    expect(res.status).toBe(404);
  });

  it("returns 404 when STAFF's scope doesn't include the student's campus", async () => {
    (auth as any).mockResolvedValue({ user: { id: "s1", role: "STAFF" } });
    (prisma.student.findUnique as any).mockResolvedValue({ id: "st1", campusId: "c2" });
    (assertCampusInScope as any).mockResolvedValue(false);
    const res = await GET(new Request("http://localhost"), makeParams("st1"));
    expect(res.status).toBe(404);
  });

  it("returns the computed status for an in-scope student", async () => {
    (auth as any).mockResolvedValue({ user: { id: "a1", role: "ADMIN" } });
    (prisma.student.findUnique as any).mockResolvedValue({ id: "st1", campusId: "c1" });
    (prisma.invoice.findMany as any).mockResolvedValue([{ status: "OVERDUE" }]);

    const res = await GET(new Request("http://localhost"), makeParams("st1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ status: "MOROSO" });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/api/admin-students-financial-status.test.ts`
Expected: FAIL — route doesn't exist yet.

- [ ] **Step 3: Implement**

`src/app/api/admin/students/[id]/financial-status/route.ts`:
```ts
import { auth } from "@/lib/auth";
import { assertCampusInScope } from "@/lib/campus-scope";
import { computeFinancialStatus } from "@/lib/financial-status";
import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }
  const role = (session.user as { role: Role }).role;
  if (role !== "ADMIN" && role !== "STAFF") {
    return Response.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id } = await params;
  const student = await prisma.student.findUnique({ where: { id } });
  if (!student) {
    return Response.json({ error: "No encontrado" }, { status: 404 });
  }

  if (role === "STAFF") {
    const inScope = await assertCampusInScope(session.user as { id: string; role: Role }, student.campusId);
    if (!inScope) {
      return Response.json({ error: "No encontrado" }, { status: 404 });
    }
  }

  const invoices = await prisma.invoice.findMany({ where: { studentId: id } });
  const status = computeFinancialStatus(invoices);

  return Response.json({ status });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/api/admin-students-financial-status.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/app/api/admin/students tests/api/admin-students-financial-status.test.ts
git commit -m "feat: add GET /api/admin/students/[id]/financial-status"
```

---

### Task 5: GET /api/admin/groups/availability

**Files:**
- Create: `src/app/api/admin/groups/availability/route.ts`
- Test: `tests/api/admin-groups-availability.test.ts`

**Interfaces:**
- Consumes: `auth`, `getCampusScope`, `prisma`.
- Produces: `GET /api/admin/groups/availability` — consumed by Task 9's disponibilidad page.

- [ ] **Step 1: Write the failing tests**

`tests/api/admin-groups-availability.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/campus-scope", () => ({ getCampusScope: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { group: { findMany: vi.fn() } },
}));

import { auth } from "@/lib/auth";
import { getCampusScope } from "@/lib/campus-scope";
import { prisma } from "@/lib/prisma";
import { GET } from "@/app/api/admin/groups/availability/route";

describe("GET /api/admin/groups/availability", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 without a session", async () => {
    (auth as any).mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns groups scoped by campus with cupoMaximo and active-enrollment counts", async () => {
    (auth as any).mockResolvedValue({ user: { id: "s1", role: "STAFF" } });
    (getCampusScope as any).mockResolvedValue({ type: "CAMPUS_LIST", campusIds: ["c1"] });
    (prisma.group.findMany as any).mockResolvedValue([
      { id: "g1", name: "A1 Matutino", cupoMaximo: 15, campus: { name: "Coatepec" }, level: { code: "A1" }, _count: { enrollments: 12 } },
    ]);

    const res = await GET();
    expect(res.status).toBe(200);
    expect(prisma.group.findMany).toHaveBeenCalledWith({
      where: { campusId: { in: ["c1"] } },
      include: {
        campus: true,
        level: true,
        _count: { select: { enrollments: { where: { completedAt: null } } } },
      },
      orderBy: { name: "asc" },
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/api/admin-groups-availability.test.ts`
Expected: FAIL — route doesn't exist yet.

- [ ] **Step 3: Implement**

`src/app/api/admin/groups/availability/route.ts`:
```ts
import { auth } from "@/lib/auth";
import { getCampusScope } from "@/lib/campus-scope";
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
  const where =
    scope.type === "ALL" ? {} : scope.type === "CAMPUS_LIST" ? { campusId: { in: scope.campusIds } } : { id: { in: [] } };

  const groups = await prisma.group.findMany({
    where,
    include: {
      campus: true,
      level: true,
      _count: { select: { enrollments: { where: { completedAt: null } } } },
    },
    orderBy: { name: "asc" },
  });

  return Response.json(groups);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/api/admin-groups-availability.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/app/api/admin/groups/availability tests/api/admin-groups-availability.test.ts
git commit -m "feat: add GET /api/admin/groups/availability"
```

---

### Task 6: POST /api/admin/block-evaluations

**Files:**
- Create: `src/app/api/admin/block-evaluations/route.ts`
- Test: `tests/api/admin-block-evaluations.test.ts`

**Interfaces:**
- Consumes: `auth`, `prisma`.
- Produces: `POST /api/admin/block-evaluations` — consumed by Task 11's `<BlockEvaluationForm>`.

- [ ] **Step 1: Write the failing tests**

`tests/api/admin-block-evaluations.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { enrollment: { findUnique: vi.fn() }, blockEvaluation: { create: vi.fn() } },
}));

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { POST } from "@/app/api/admin/block-evaluations/route";

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/admin/block-evaluations", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

const VALID_BODY = {
  enrollmentId: "e1",
  bloqueNumero: 1,
  notaListening: 90,
  notaSpeaking: 85,
  notaReading: 92,
  notaWriting: 88,
  notaGrammar: 80,
};

describe("POST /api/admin/block-evaluations", () => {
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
      group: { teacherId: "t2" },
    });
    const res = await POST(jsonRequest(VALID_BODY));
    expect(res.status).toBe(403);
    expect(prisma.blockEvaluation.create).not.toHaveBeenCalled();
  });

  it("returns 400 when any score is out of 0-100 range", async () => {
    (auth as any).mockResolvedValue({ user: { id: "t1", role: "TEACHER" } });
    (prisma.enrollment.findUnique as any).mockResolvedValue({ id: "e1", group: { teacherId: "t1" } });
    const res = await POST(jsonRequest({ ...VALID_BODY, notaGrammar: 150 }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for a duplicate bloqueNumero on the same enrollment (P2002)", async () => {
    (auth as any).mockResolvedValue({ user: { id: "t1", role: "TEACHER" } });
    (prisma.enrollment.findUnique as any).mockResolvedValue({ id: "e1", group: { teacherId: "t1" } });
    (prisma.blockEvaluation.create as any).mockRejectedValue(
      Object.assign(new Error("Unique constraint failed"), { code: "P2002" })
    );
    const res = await POST(jsonRequest(VALID_BODY));
    expect(res.status).toBe(400);
  });

  it("computes promedioBloque and creates the evaluation on success", async () => {
    (auth as any).mockResolvedValue({ user: { id: "t1", role: "TEACHER" } });
    (prisma.enrollment.findUnique as any).mockResolvedValue({ id: "e1", group: { teacherId: "t1" } });
    (prisma.blockEvaluation.create as any).mockResolvedValue({ id: "be1" });

    const res = await POST(jsonRequest(VALID_BODY));
    expect(res.status).toBe(201);
    // (90+85+92+88+80)/5 = 87
    expect(prisma.blockEvaluation.create).toHaveBeenCalledWith({
      data: {
        enrollmentId: "e1",
        bloqueNumero: 1,
        notaListening: 90,
        notaSpeaking: 85,
        notaReading: 92,
        notaWriting: 88,
        notaGrammar: 80,
        promedioBloque: 87,
        createdById: "t1",
      },
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/api/admin-block-evaluations.test.ts`
Expected: FAIL — route doesn't exist yet.

- [ ] **Step 3: Implement**

`src/app/api/admin/block-evaluations/route.ts`:
```ts
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";

const SCORE_FIELDS = ["notaListening", "notaSpeaking", "notaReading", "notaWriting", "notaGrammar"] as const;

function isValidScore(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100;
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }
  const role = (session.user as { role: Role }).role;
  if (role !== "TEACHER") {
    return Response.json({ error: "No autorizado" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Cuerpo de la solicitud inválido" }, { status: 400 });
  }

  if (
    !body.enrollmentId ||
    typeof body.enrollmentId !== "string" ||
    !Number.isInteger(body.bloqueNumero) ||
    (body.bloqueNumero as number) < 1
  ) {
    return Response.json({ error: "Datos inválidos" }, { status: 400 });
  }

  for (const field of SCORE_FIELDS) {
    if (!isValidScore(body[field])) {
      return Response.json({ error: "Las calificaciones deben estar entre 0 y 100" }, { status: 400 });
    }
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

  const scores = SCORE_FIELDS.map((f) => body[f] as number);
  const promedioBloque = Math.round((scores.reduce((sum, s) => sum + s, 0) / 5) * 100) / 100;

  try {
    const evaluation = await prisma.blockEvaluation.create({
      data: {
        enrollmentId: body.enrollmentId,
        bloqueNumero: body.bloqueNumero as number,
        notaListening: body.notaListening as number,
        notaSpeaking: body.notaSpeaking as number,
        notaReading: body.notaReading as number,
        notaWriting: body.notaWriting as number,
        notaGrammar: body.notaGrammar as number,
        promedioBloque,
        createdById: (session.user as { id: string }).id,
      },
    });
    return Response.json(evaluation, { status: 201 });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      return Response.json(
        { error: "Ya existe una evaluación para este bloque en esta inscripción" },
        { status: 400 }
      );
    }
    console.error("Error al guardar la evaluación por bloque:", error);
    return Response.json({ error: "No se pudo guardar la evaluación" }, { status: 500 });
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/api/admin-block-evaluations.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add src/app/api/admin/block-evaluations tests/api/admin-block-evaluations.test.ts
git commit -m "feat: add POST /api/admin/block-evaluations"
```

---

### Task 7: POST /api/admin/group-change-requests

**Files:**
- Create: `src/app/api/admin/group-change-requests/route.ts` (POST; GET added in same file)
- Test: `tests/api/admin-group-change-requests-post.test.ts`

**Interfaces:**
- Consumes: `auth`, `getCampusScope`, `assertCampusInScope`, `prisma`.
- Produces: `POST/GET /api/admin/group-change-requests` — POST is Recepción's "create the request"; GET lists pending requests for Task 10's approval page.

- [ ] **Step 1: Write the failing tests**

`tests/api/admin-group-change-requests-post.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/campus-scope", () => ({ getCampusScope: vi.fn(), assertCampusInScope: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    student: { findUnique: vi.fn() },
    enrollment: { findFirst: vi.fn() },
    groupChangeRequest: { create: vi.fn(), findMany: vi.fn() },
  },
}));

import { auth } from "@/lib/auth";
import { assertCampusInScope } from "@/lib/campus-scope";
import { prisma } from "@/lib/prisma";
import { POST } from "@/app/api/admin/group-change-requests/route";

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/admin/group-change-requests", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

const VALID_BODY = { type: "BAJA", studentId: "st1", currentGroupId: "g1", reason: "Cambio de ciudad" };

describe("POST /api/admin/group-change-requests", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 without a session", async () => {
    (auth as any).mockResolvedValue(null);
    const res = await POST(jsonRequest(VALID_BODY));
    expect(res.status).toBe(401);
  });

  it("returns 400 for CAMBIO_GRUPO with no requestedGroupId", async () => {
    (auth as any).mockResolvedValue({ user: { id: "s1", role: "STAFF" } });
    const res = await POST(jsonRequest({ ...VALID_BODY, type: "CAMBIO_GRUPO" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for a blank reason", async () => {
    (auth as any).mockResolvedValue({ user: { id: "s1", role: "STAFF" } });
    const res = await POST(jsonRequest({ ...VALID_BODY, reason: "   " }));
    expect(res.status).toBe(400);
  });

  it("returns 404 when the student has no active enrollment in currentGroupId", async () => {
    (auth as any).mockResolvedValue({ user: { id: "a1", role: "ADMIN" } });
    (prisma.enrollment.findFirst as any).mockResolvedValue(null);
    const res = await POST(jsonRequest(VALID_BODY));
    expect(res.status).toBe(404);
    expect(prisma.groupChangeRequest.create).not.toHaveBeenCalled();
  });

  it("returns 403 when STAFF's scope doesn't include the student's campus", async () => {
    (auth as any).mockResolvedValue({ user: { id: "s1", role: "STAFF" } });
    (prisma.enrollment.findFirst as any).mockResolvedValue({ id: "e1", student: { campusId: "c2" } });
    (assertCampusInScope as any).mockResolvedValue(false);
    const res = await POST(jsonRequest(VALID_BODY));
    expect(res.status).toBe(403);
    expect(prisma.groupChangeRequest.create).not.toHaveBeenCalled();
  });

  it("creates the request on success", async () => {
    (auth as any).mockResolvedValue({ user: { id: "a1", role: "ADMIN" } });
    (prisma.enrollment.findFirst as any).mockResolvedValue({ id: "e1", student: { campusId: "c1" } });
    (prisma.groupChangeRequest.create as any).mockResolvedValue({ id: "gcr1" });

    const res = await POST(jsonRequest(VALID_BODY));
    expect(res.status).toBe(201);
    expect(prisma.groupChangeRequest.create).toHaveBeenCalledWith({
      data: {
        type: "BAJA",
        studentId: "st1",
        currentGroupId: "g1",
        requestedGroupId: null,
        reason: "Cambio de ciudad",
        requestedById: "a1",
      },
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/api/admin-group-change-requests-post.test.ts`
Expected: FAIL — route doesn't exist yet.

- [ ] **Step 3: Implement**

`src/app/api/admin/group-change-requests/route.ts`:
```ts
import { auth } from "@/lib/auth";
import { assertCampusInScope } from "@/lib/campus-scope";
import { prisma } from "@/lib/prisma";
import type { GroupChangeRequestType, Role } from "@prisma/client";

const MAX_REASON_LENGTH = 500;

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
    type?: string;
    studentId?: string;
    currentGroupId?: string;
    requestedGroupId?: string;
    reason?: string;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Cuerpo de la solicitud inválido" }, { status: 400 });
  }

  const reason = body.reason?.trim();
  if (
    !body.type ||
    !["BAJA", "CAMBIO_GRUPO"].includes(body.type) ||
    !body.studentId ||
    !body.currentGroupId ||
    !reason ||
    reason.length > MAX_REASON_LENGTH
  ) {
    return Response.json({ error: "Datos inválidos" }, { status: 400 });
  }

  if (body.type === "CAMBIO_GRUPO" && !body.requestedGroupId) {
    return Response.json({ error: "Debes especificar el grupo destino" }, { status: 400 });
  }

  const enrollment = await prisma.enrollment.findFirst({
    where: { studentId: body.studentId, groupId: body.currentGroupId, completedAt: null },
    include: { student: true },
  });
  if (!enrollment) {
    return Response.json(
      { error: "El alumno no tiene una inscripción activa en ese grupo" },
      { status: 404 }
    );
  }

  if (role === "STAFF") {
    const inScope = await assertCampusInScope(
      session.user as { id: string; role: Role },
      enrollment.student.campusId
    );
    if (!inScope) {
      return Response.json({ error: "No autorizado" }, { status: 403 });
    }
  }

  const changeRequest = await prisma.groupChangeRequest.create({
    data: {
      type: body.type as GroupChangeRequestType,
      studentId: body.studentId,
      currentGroupId: body.currentGroupId,
      requestedGroupId: body.requestedGroupId ?? null,
      reason,
      requestedById: (session.user as { id: string }).id,
    },
  });

  return Response.json(changeRequest, { status: 201 });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/api/admin-group-change-requests-post.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add src/app/api/admin/group-change-requests tests/api/admin-group-change-requests-post.test.ts
git commit -m "feat: add POST /api/admin/group-change-requests"
```

---

### Task 8: GET /api/admin/group-change-requests and PATCH /api/admin/group-change-requests/[id] (approval)

**Files:**
- Modify: `src/app/api/admin/group-change-requests/route.ts` (add GET alongside Task 7's POST)
- Create: `src/app/api/admin/group-change-requests/[id]/route.ts` (PATCH)
- Test: `tests/api/admin-group-change-requests-patch.test.ts`

**Interfaces:**
- Consumes: `auth`, `getCampusScope`, `prisma`. The `PATCH` handler reuses the exact transaction pattern from `src/app/api/admin/reinscripciones/route.ts` (read that file — it's already open from Global Constraints) for the `CAMBIO_GRUPO` approval path.
- Produces: `GET /api/admin/group-change-requests`, `PATCH /api/admin/group-change-requests/[id]` — consumed by Task 10's approval page.

- [ ] **Step 1: Write the failing tests**

`tests/api/admin-group-change-requests-patch.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    groupChangeRequest: { findUnique: vi.fn(), update: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
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

describe("PATCH /api/admin/group-change-requests/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 without a session", async () => {
    (auth as any).mockResolvedValue(null);
    const res = await PATCH(jsonRequest({ decision: "APROBADA" }), makeParams("gcr1"));
    expect(res.status).toBe(401);
  });

  it("returns 400 for an invalid decision value", async () => {
    (auth as any).mockResolvedValue({ user: { id: "a1", role: "ADMIN" } });
    const res = await PATCH(jsonRequest({ decision: "BOGUS" }), makeParams("gcr1"));
    expect(res.status).toBe(400);
  });

  it("returns 404 for a nonexistent request", async () => {
    (auth as any).mockResolvedValue({ user: { id: "a1", role: "ADMIN" } });
    (prisma.groupChangeRequest.findUnique as any).mockResolvedValue(null);
    const res = await PATCH(jsonRequest({ decision: "APROBADA" }), makeParams("gcr1"));
    expect(res.status).toBe(404);
  });

  it("returns 400 when the request is not PENDIENTE", async () => {
    (auth as any).mockResolvedValue({ user: { id: "a1", role: "ADMIN" } });
    (prisma.groupChangeRequest.findUnique as any).mockResolvedValue({ id: "gcr1", status: "APROBADA" });
    const res = await PATCH(jsonRequest({ decision: "APROBADA" }), makeParams("gcr1"));
    expect(res.status).toBe(400);
  });

  it("on REJECTED decision, just updates status/reviewedBy without touching enrollments", async () => {
    (auth as any).mockResolvedValue({ user: { id: "a1", role: "ADMIN" } });
    (prisma.groupChangeRequest.findUnique as any).mockResolvedValue({ id: "gcr1", status: "PENDIENTE", type: "BAJA" });
    (prisma.groupChangeRequest.update as any).mockResolvedValue({ id: "gcr1", status: "RECHAZADA" });

    const res = await PATCH(jsonRequest({ decision: "RECHAZADA" }), makeParams("gcr1"));
    expect(res.status).toBe(200);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.groupChangeRequest.update).toHaveBeenCalledWith({
      where: { id: "gcr1" },
      data: { status: "RECHAZADA", reviewedById: "a1", reviewedAt: expect.any(Date) },
    });
  });

  it("on APROBADA + BAJA, closes the enrollment and marks the request approved in one transaction", async () => {
    (auth as any).mockResolvedValue({ user: { id: "a1", role: "ADMIN" } });
    (prisma.groupChangeRequest.findUnique as any).mockResolvedValue({
      id: "gcr1",
      status: "PENDIENTE",
      type: "BAJA",
      studentId: "st1",
      currentGroupId: "g1",
    });
    (prisma.$transaction as any).mockImplementation(async (fn: any) =>
      fn({
        enrollment: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
        groupChangeRequest: { update: vi.fn().mockResolvedValue({ id: "gcr1", status: "APROBADA" }) },
      })
    );

    const res = await PATCH(jsonRequest({ decision: "APROBADA" }), makeParams("gcr1"));
    expect(res.status).toBe(200);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it("on APROBADA + CAMBIO_GRUPO, closes current enrollment and creates a new one in one transaction", async () => {
    (auth as any).mockResolvedValue({ user: { id: "a1", role: "ADMIN" } });
    (prisma.groupChangeRequest.findUnique as any).mockResolvedValue({
      id: "gcr1",
      status: "PENDIENTE",
      type: "CAMBIO_GRUPO",
      studentId: "st1",
      currentGroupId: "g1",
      requestedGroupId: "g2",
    });
    (prisma.$transaction as any).mockImplementation(async (fn: any) =>
      fn({
        enrollment: {
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          create: vi.fn().mockResolvedValue({ id: "e2" }),
        },
        groupChangeRequest: { update: vi.fn().mockResolvedValue({ id: "gcr1", status: "APROBADA" }) },
      })
    );

    const res = await PATCH(jsonRequest({ decision: "APROBADA" }), makeParams("gcr1"));
    expect(res.status).toBe(200);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it("returns 400 if the enrollment was already completed by the time of approval (race guard)", async () => {
    (auth as any).mockResolvedValue({ user: { id: "a1", role: "ADMIN" } });
    (prisma.groupChangeRequest.findUnique as any).mockResolvedValue({
      id: "gcr1",
      status: "PENDIENTE",
      type: "BAJA",
      studentId: "st1",
      currentGroupId: "g1",
    });
    (prisma.$transaction as any).mockImplementation(async (fn: any) =>
      fn({ enrollment: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) } })
    );

    const res = await PATCH(jsonRequest({ decision: "APROBADA" }), makeParams("gcr1"));
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/api/admin-group-change-requests-patch.test.ts`
Expected: FAIL — route doesn't exist yet.

- [ ] **Step 3: Implement GET (added to Task 7's file)**

Add to `src/app/api/admin/group-change-requests/route.ts`:
```ts
import { getCampusScope } from "@/lib/campus-scope";

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
  const where =
    scope.type === "ALL"
      ? {}
      : scope.type === "CAMPUS_LIST"
        ? { student: { campusId: { in: scope.campusIds } } }
        : { id: { in: [] } };

  const requests = await prisma.groupChangeRequest.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { student: { include: { user: { select: { id: true, name: true } } } }, currentGroup: true, requestedGroup: true },
  });

  return Response.json(requests);
}
```

- [ ] **Step 4: Implement PATCH**

`src/app/api/admin/group-change-requests/[id]/route.ts`:
```ts
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }
  const role = (session.user as { role: Role }).role;
  if (role !== "ADMIN" && role !== "STAFF") {
    return Response.json({ error: "No autorizado" }, { status: 403 });
  }

  let body: { decision?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Cuerpo de la solicitud inválido" }, { status: 400 });
  }

  if (body.decision !== "APROBADA" && body.decision !== "RECHAZADA") {
    return Response.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const { id } = await params;
  const changeRequest = await prisma.groupChangeRequest.findUnique({ where: { id } });
  if (!changeRequest) {
    return Response.json({ error: "No encontrado" }, { status: 404 });
  }
  if (changeRequest.status !== "PENDIENTE") {
    return Response.json({ error: "Esta solicitud ya fue revisada" }, { status: 400 });
  }

  const reviewerId = (session.user as { id: string }).id;

  if (body.decision === "RECHAZADA") {
    const updated = await prisma.groupChangeRequest.update({
      where: { id },
      data: { status: "RECHAZADA", reviewedById: reviewerId, reviewedAt: new Date() },
    });
    return Response.json(updated);
  }

  // APROBADA: close the current enrollment; for CAMBIO_GRUPO, also open the new one.
  // Reuses the exact race-safe transaction shape from src/app/api/admin/reinscripciones/route.ts.
  try {
    const result = await prisma.$transaction(async (tx) => {
      const closed = await tx.enrollment.updateMany({
        where: { studentId: changeRequest.studentId, groupId: changeRequest.currentGroupId, completedAt: null },
        data: { completedAt: new Date() },
      });
      if (closed.count !== 1) {
        throw Object.assign(new Error("Enrollment already completed"), { code: "ALREADY_COMPLETED" });
      }

      if (changeRequest.type === "CAMBIO_GRUPO") {
        await tx.enrollment.create({
          data: { studentId: changeRequest.studentId, groupId: changeRequest.requestedGroupId! },
        });
      }

      return tx.groupChangeRequest.update({
        where: { id },
        data: { status: "APROBADA", reviewedById: reviewerId, reviewedAt: new Date() },
      });
    });
    return Response.json(result);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ALREADY_COMPLETED") {
      return Response.json(
        { error: "La inscripción del alumno ya no está activa; no se puede aprobar" },
        { status: 400 }
      );
    }
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      return Response.json({ error: "El alumno ya tiene una inscripción activa" }, { status: 400 });
    }
    console.error("Error al aprobar la solicitud de cambio de grupo:", error);
    return Response.json({ error: "Ocurrió un error al procesar la solicitud" }, { status: 500 });
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- tests/api/admin-group-change-requests-patch.test.ts tests/api/admin-group-change-requests-post.test.ts`
Expected: PASS (both files)

- [ ] **Step 6: Commit**

```bash
git add src/app/api/admin/group-change-requests tests/api/admin-group-change-requests-patch.test.ts
git commit -m "feat: add GET/PATCH for group change request approval"
```

---

### Task 9: FinancialStatusBadge component and wiring into Admisiones

**Files:**
- Create: `src/components/admin/financial-status-badge.tsx`
- Modify: `src/app/admin/admisiones/page.tsx` (add the badge to each lead/student row — read the file first to find the right insertion point)

**Interfaces:**
- Consumes: `computeFinancialStatus`, `prisma` (queries `Invoice` directly server-side rather than calling the API route, matching this project's established server-component convention).
- Produces: a reusable badge shown wherever a student's financial status is relevant.

- [ ] **Step 1: FinancialStatusBadge**

`src/components/admin/financial-status-badge.tsx`:
```tsx
import { Badge } from "@/components/ui/badge";
import type { FinancialStatus } from "@/lib/financial-status";

const LABELS: Record<FinancialStatus, string> = {
  AL_CORRIENTE: "Al Corriente",
  PENDIENTE_DE_COBRO: "Pendiente de Cobro",
  MOROSO: "Moroso",
};

const TONES: Record<FinancialStatus, "primary" | "accent" | "neutral"> = {
  AL_CORRIENTE: "primary",
  PENDIENTE_DE_COBRO: "neutral",
  MOROSO: "accent",
};

export function FinancialStatusBadge({ status }: { status: FinancialStatus }) {
  return <Badge tone={TONES[status]}>{LABELS[status]}</Badge>;
}
```

- [ ] **Step 2: Wire into Admisiones**

Read `src/app/admin/admisiones/page.tsx` in full first. It lists `Lead` rows, not `Student` rows directly — a financial status only makes sense for leads that have converted to a `Student` (i.e. `status === "ENROLLED"`). Add a new table column "Estatus Financiero" that, for each lead where `status === "ENROLLED"`, looks up the corresponding `Student` (via matching email/user, or however this codebase currently links a converted `Lead` back to its `Student` — check if such a link exists; if there is no direct FK from `Lead` to `Student` in this codebase today, that's fine — in that case, skip rendering the badge for now and leave a code comment noting that a future spec should add a proper `Lead.convertedStudentId` link if this feature needs to work reliably; do NOT invent a new schema relation in this task, since it's not in this task's file scope). For any lead not yet `ENROLLED`, don't show a financial badge at all (leads aren't students, they don't have invoices).

Given the likely absence of a direct Lead→Student link, the pragmatic outcome for THIS task may be: add the `FinancialStatusBadge` component (Step 1, always useful for a future direct `Student` list page), and skip wiring it into Admisiones if there's no reliable way to resolve which `Student` a `Lead` became — in that case, note this explicitly in your report rather than forcing an unreliable heuristic (e.g. matching by email is fragile if the student's account email differs from the lead's).

- [ ] **Step 3: Verify it builds**

Run: `npm run build`
Expected: clean build.

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/financial-status-badge.tsx src/app/admin/admisiones/page.tsx
git commit -m "feat: add FinancialStatusBadge component"
```

---

### Task 10: Disponibilidad and Solicitudes pages

**Files:**
- Create: `src/app/admin/recepcion/grupos-disponibilidad/page.tsx`
- Create: `src/app/admin/control-escolar/solicitudes/page.tsx`
- Modify: `src/components/admin/admin-nav.tsx`

**Interfaces:**
- Consumes: `GET /api/admin/groups/availability`'s underlying query logic (query Prisma directly, server component, per project convention), `GET/PATCH /api/admin/group-change-requests`'s underlying logic.
- Produces: `/admin/recepcion/grupos-disponibilidad`, `/admin/control-escolar/solicitudes`, two new `AdminNav` entries.

- [ ] **Step 1: Add nav entries**

In `src/components/admin/admin-nav.tsx`, add `{ href: "/admin/recepcion/grupos-disponibilidad", label: "Disponibilidad" }` and `{ href: "/admin/control-escolar/solicitudes", label: "Solicitudes" }` to the end of `MODULES`.

- [ ] **Step 2: Disponibilidad page**

`src/app/admin/recepcion/grupos-disponibilidad/page.tsx`: server component, redirects unauthenticated/non-ADMIN-STAFF, queries groups exactly like the availability route (`getCampusScope` + the same `include`/`where`), renders a table: Plantel | Grupo | Nivel | Cupo (e.g. "12/15") | Estatus visual (a simple color cue, e.g. red text if `_count.enrollments >= cupoMaximo`, otherwise default).

- [ ] **Step 3: Solicitudes page**

`src/app/admin/control-escolar/solicitudes/page.tsx`: server component, redirects unauthenticated/non-ADMIN-STAFF, lists `PENDIENTE` `GroupChangeRequest` rows (student name, type, current/requested group, reason, requester), with a small client sub-form (inline Server Actions, following the established pattern from `src/app/admin/recepcion/bitacora/page.tsx` in the prior sub-spec — read that file for the pattern) with two buttons per row: "Aprobar" / "Rechazar", each calling a Server Action that does the equivalent of `PATCH /api/admin/group-change-requests/[id]` (you may either call the actual route handler's logic via a shared function, or reimplement the same call inline — prefer extracting the PATCH handler's core logic into an exported function in the route file that the Server Action can import and call directly, avoiding a second copy of the approval transaction logic, since duplicated write-path logic was the direct cause of multiple real bugs in the previous sub-spec's final review).

- [ ] **Step 4: Verify it builds**

Run: `npm run build`
Expected: both new routes compile.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/recepcion/grupos-disponibilidad src/app/admin/control-escolar src/components/admin/admin-nav.tsx
git commit -m "feat: add disponibilidad and solicitudes pages"
```

---

### Task 11: Block evaluation form on /portal/calificaciones

**Files:**
- Create: `src/components/portal/block-evaluation-form.tsx`
- Modify: `src/app/portal/calificaciones/page.tsx`

**Interfaces:**
- Consumes: `POST /api/admin/block-evaluations` (Task 6), existing `getVisibleEnrollmentIds`.
- Produces: a second section on the existing calificaciones page for the LSRWG block format, alongside the existing free-form `Grade` list (do not remove or restructure the existing `Grade` section).

- [ ] **Step 1: Read the existing page first**

Read `src/app/portal/calificaciones/page.tsx` in full (already shown in this plan's context above) before editing — you are ADDING a section, not replacing the existing `GradeForm`/grade-list rendering.

- [ ] **Step 2: BlockEvaluationForm**

`src/components/portal/block-evaluation-form.tsx`:
```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function BlockEvaluationForm({ students }: { students: { enrollmentId: string; name: string }[] }) {
  const router = useRouter();
  const [enrollmentId, setEnrollmentId] = useState(students[0]?.enrollmentId ?? "");
  const [bloqueNumero, setBloqueNumero] = useState("1");
  const [scores, setScores] = useState({ notaListening: "", notaSpeaking: "", notaReading: "", notaWriting: "", notaGrammar: "" });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/block-evaluations", {
        method: "POST",
        body: JSON.stringify({
          enrollmentId,
          bloqueNumero: Number(bloqueNumero),
          notaListening: Number(scores.notaListening),
          notaSpeaking: Number(scores.notaSpeaking),
          notaReading: Number(scores.notaReading),
          notaWriting: Number(scores.notaWriting),
          notaGrammar: Number(scores.notaGrammar),
        }),
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "No se pudo guardar la evaluación");
        return;
      }

      setScores({ notaListening: "", notaSpeaking: "", notaReading: "", notaWriting: "", notaGrammar: "" });
      router.refresh();
    } catch {
      setError("No se pudo guardar la evaluación");
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
        type="number"
        min={1}
        value={bloqueNumero}
        onChange={(e) => setBloqueNumero(e.target.value)}
        placeholder="Número de bloque"
        className="w-24 rounded-md border border-border px-2 py-2 text-sm"
      />
      <div className="grid grid-cols-5 gap-2">
        {(["notaListening", "notaSpeaking", "notaReading", "notaWriting", "notaGrammar"] as const).map((field) => (
          <input
            key={field}
            type="number"
            min={0}
            max={100}
            value={scores[field]}
            onChange={(e) => setScores((prev) => ({ ...prev, [field]: e.target.value }))}
            placeholder={field.replace("nota", "")}
            required
            className="rounded-md border border-border px-2 py-2 text-sm"
          />
        ))}
      </div>
      {error && <p className="text-sm text-accent-dark">{error}</p>}
      <Button type="submit" disabled={submitting || !enrollmentId}>
        {submitting ? "Guardando..." : "Guardar evaluación de bloque"}
      </Button>
    </form>
  );
}
```

- [ ] **Step 3: Wire into the page**

In `src/app/portal/calificaciones/page.tsx`, add a fetch for `prisma.blockEvaluation.findMany({ where: { enrollmentId: { in: enrollmentIds } }, orderBy: { createdAt: "desc" } })`, and render, for `role === "TEACHER"`, a `<BlockEvaluationForm students={...} />` (reuse the same `enrollments` list already computed for `GradeForm`) plus a list of existing `BlockEvaluation` rows (bloque number, 5 scores, promedio, student/group name via the same `enrollmentById` map already built) below the existing free-form `Grade` list, under a new heading "Evaluaciones por bloque".

- [ ] **Step 4: Verify it builds**

Run: `npm run build`
Expected: `/portal/calificaciones` still compiles.

- [ ] **Step 5: Commit**

```bash
git add src/components/portal/block-evaluation-form.tsx src/app/portal/calificaciones/page.tsx
git commit -m "feat: add block evaluation form to calificaciones page"
```

---

## Post-plan checklist

- [ ] `npm test` — all suites pass
- [ ] `npx tsc --noEmit` — no type errors
- [ ] `npm run build` — production build succeeds, all new routes listed
- [ ] Manual smoke test: create an invoice via "Enviar a Caja" with a scholarship discount, confirm the computed amount; check `/admin/recepcion/grupos-disponibilidad` shows cupo counts; create a `BAJA` group-change-request and approve it from `/admin/control-escolar/solicitudes`, confirm the enrollment closes; log in as the seeded teacher and record a block evaluation on `/portal/calificaciones`
