# Bristol Recepción 4a — Registro y Operación Diaria — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the first third of Spec 4 (Recepción) — real campus names, an extended `Lead` covering the full Prospecto/waitlist lifecycle, an extended `Student` with matrícula/CURP/contact/fiscal data, a `ReceptionLogEntry` bitácora, global search, quick student registration, a waitlist pipeline, and a placement-appointment calendar.

**Architecture:** This plan extends existing, already-merged models (`Lead`, `Student`) rather than introducing parallel entities — see `docs/superpowers/specs/2026-08-27-reception-design.md`'s "Decisiones de arquitectura" for the reasoning, already confirmed with the user. `AgeBracket` is always computed from a birthdate, never stored, to avoid drift.

**Tech Stack:** Next.js 16 (App Router), Prisma/PostgreSQL, Vitest.

## Global Constraints

- Node ≥22 required — prepend node 22's bin dir to `PATH` before any npm/npx command.
- This repo lives on a network volume that spawns `._<filename>` AppleDouble junk files on write (gitignored); clean with `find . -name "._*" -not -path "./node_modules/*" -not -path "./.git/*" -delete` before build/test.
- `AgeBracket` (NINO/ADOLESCENTE/ADULTO) is NEVER a stored column — always computed on read from a birthdate via the shared `src/lib/age-bracket.ts` helper, for both `Lead.dateOfBirth` and `Student.fechaNacimiento`.
- `matricula` generation must be race-safe: two concurrent student creations must never receive the same value. Generate it inside a transaction using a count-based approach with a retry-on-conflict, or an atomic upsert-based sequence — see Task 2 for the exact approach.
- Every route handler must check session + role BEFORE any database query. All new admin routes require ADMIN or STAFF, scoped by `getCampusScope` exactly as every other admin route in this project already does.
- Free-text/URL inputs get the same hygiene the last three specs' final reviews required up front: trim, non-empty-after-trim where meaningful, length caps.
- Every task must leave `npm run build`, `npm test`, and `npx tsc --noEmit` passing.

---

## File Structure

```
prisma/
  schema.prisma                       # + Lead fields, Student fields, PlacementAppointment, ReceptionLogEntry
prisma/seed.ts                        # MODIFY: campus names, staff emails
README.md                             # MODIFY: seeded account table
src/
  lib/
    age-bracket.ts                        # NEW: computeAgeBracket(birthdate)
    matricula.ts                          # NEW: generateMatricula()
  app/
    api/
      admin/
        search/
          route.ts                            # NEW: GET
        students/
          quick-create/
            route.ts                              # NEW: POST
        leads/
          waitlist/
            route.ts                              # NEW: GET, PATCH
        placement-appointments/
          route.ts                              # NEW: GET, POST
        reception-log/
          route.ts                              # NEW: GET, POST
          monthly-report/
            route.ts                              # NEW: GET
    admin/
      recepcion/
        lista-espera/
          page.tsx                              # NEW
        agenda/
          page.tsx                              # NEW
        bitacora/
          page.tsx                              # NEW
  components/
    admin/
      command-palette.tsx              # NEW
      quick-create-drawer.tsx           # NEW
      admin-nav.tsx                     # MODIFY: + Recepción entries
tests/
  lib/
    age-bracket.test.ts
    matricula.test.ts
  api/
    admin-search.test.ts
    admin-students-quick-create.test.ts
    admin-leads-waitlist.test.ts
    admin-placement-appointments.test.ts
    admin-reception-log.test.ts
```

---

### Task 1: Rename campuses to Coatepec/Xalapa

**Files:**
- Modify: `prisma/seed.ts`
- Modify: `README.md`

**Interfaces:**
- Produces: renamed seed data — consumed by nothing programmatically (pure data), but the demo credentials table in `README.md` must match.

- [ ] **Step 1: Update the seed script**

In `prisma/seed.ts`, change:
```ts
const [campusNorte, campusSur] = await Promise.all([
  prisma.campus.create({ data: { name: "Bristol Norte", address: "Av. Principal 100" } }),
  prisma.campus.create({ data: { name: "Bristol Sur", address: "Av. Secundaria 200" } }),
]);
```
to:
```ts
const [campusCoatepec, campusXalapa] = await Promise.all([
  prisma.campus.create({ data: { name: "Coatepec", address: "Coatepec, Veracruz" } }),
  prisma.campus.create({ data: { name: "Xalapa", address: "Xalapa, Veracruz" } }),
]);
```
Then rename every other use of `campusNorte`/`campusSur` in the file to `campusCoatepec`/`campusXalapa` (variable renames only — do not change the surrounding logic), and rename the seeded staff accounts' emails/names from `staff.norte@bristol-ingles.com`/`"Staff Norte"` and `staff.sur@bristol-ingles.com`/`"Staff Sur"` to `staff.coatepec@bristol-ingles.com`/`"Staff Coatepec"` and `staff.xalapa@bristol-ingles.com`/`"Staff Xalapa"`. Read the whole file first — there are likely several places (group creation, teacher campus links) that reference these variables; rename every occurrence consistently.

- [ ] **Step 2: Update README's seeded-accounts table**

In `README.md`, update the two STAFF rows to reflect the new emails and campus names (`staff.coatepec@bristol-ingles.com` / `staff.xalapa@bristol-ingles.com`).

- [ ] **Step 3: Verify**

Run: `npx prisma db seed` (or `npm run db:seed`, whichever script this project uses — check `package.json`) against a reset local database (`npm run db:reset` first) to confirm the seed still runs cleanly end to end.

- [ ] **Step 4: Commit**

```bash
git add prisma/seed.ts README.md
git commit -m "feat: rename seeded campuses to Coatepec and Xalapa"
```

---

### Task 2: age-bracket.ts and matricula.ts helpers

**Files:**
- Create: `src/lib/age-bracket.ts`
- Create: `src/lib/matricula.ts`
- Test: `tests/lib/age-bracket.test.ts`
- Test: `tests/lib/matricula.test.ts`

**Interfaces:**
- Produces: `computeAgeBracket(birthdate: Date, asOf?: Date): "NINO" | "ADOLESCENTE" | "ADULTO"`, `generateMatricula(tx: PrismaTransactionClient): Promise<string>` — consumed by every later task in this plan and 4b/4c.

- [ ] **Step 1: Write the failing tests**

`tests/lib/age-bracket.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { computeAgeBracket } from "@/lib/age-bracket";

describe("computeAgeBracket", () => {
  it("classifies under 12 as NINO", () => {
    const asOf = new Date("2026-01-01");
    expect(computeAgeBracket(new Date("2016-06-01"), asOf)).toBe("NINO");
  });

  it("classifies 12-17 as ADOLESCENTE", () => {
    const asOf = new Date("2026-01-01");
    expect(computeAgeBracket(new Date("2012-06-01"), asOf)).toBe("ADOLESCENTE");
  });

  it("classifies 18+ as ADULTO", () => {
    const asOf = new Date("2026-01-01");
    expect(computeAgeBracket(new Date("2000-06-01"), asOf)).toBe("ADULTO");
  });

  it("handles a birthday that hasn't happened yet this year", () => {
    const asOf = new Date("2026-01-01");
    // turns 12 on 2026-12-01, so as of 2026-01-01 is still 11 -> NINO
    expect(computeAgeBracket(new Date("2014-12-01"), asOf)).toBe("NINO");
  });
});
```

`tests/lib/matricula.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateMatricula } from "@/lib/matricula";

describe("generateMatricula", () => {
  beforeEach(() => vi.clearAllMocks());

  it("produces BRI-<year>-<5-digit-padded-count+1>", async () => {
    const tx = { student: { count: vi.fn().mockResolvedValue(41) } } as any;
    const matricula = await generateMatricula(tx, new Date("2026-03-01"));
    expect(matricula).toBe("BRI-2026-00042");
    expect(tx.student.count).toHaveBeenCalledWith({
      where: { matricula: { startsWith: "BRI-2026-" } },
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/lib/age-bracket.test.ts tests/lib/matricula.test.ts`
Expected: FAIL — modules don't exist yet.

- [ ] **Step 3: Implement**

`src/lib/age-bracket.ts`:
```ts
export type AgeBracket = "NINO" | "ADOLESCENTE" | "ADULTO";

export function computeAgeBracket(birthdate: Date, asOf: Date = new Date()): AgeBracket {
  let age = asOf.getFullYear() - birthdate.getFullYear();
  const hasHadBirthdayThisYear =
    asOf.getMonth() > birthdate.getMonth() ||
    (asOf.getMonth() === birthdate.getMonth() && asOf.getDate() >= birthdate.getDate());
  if (!hasHadBirthdayThisYear) age -= 1;

  if (age < 12) return "NINO";
  if (age < 18) return "ADOLESCENTE";
  return "ADULTO";
}
```

`src/lib/matricula.ts`:
```ts
import type { Prisma } from "@prisma/client";

type TxClient = Prisma.TransactionClient;

/**
 * Generates a race-safe matrícula of the form BRI-<year>-<00001>. Must be
 * called from within the same transaction that creates the Student row —
 * the count-then-create pattern only avoids collisions when both happen
 * atomically relative to other concurrent calls. If two callers ever do
 * race despite this, the unique constraint on Student.matricula will
 * reject the second insert with a P2002, which the caller must handle by
 * retrying (see Task 3's quick-create route for the retry loop).
 */
export async function generateMatricula(tx: TxClient, asOf: Date = new Date()): Promise<string> {
  const year = asOf.getFullYear();
  const prefix = `BRI-${year}-`;
  const count = await tx.student.count({ where: { matricula: { startsWith: prefix } } });
  const sequence = String(count + 1).padStart(5, "0");
  return `${prefix}${sequence}`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/lib/age-bracket.test.ts tests/lib/matricula.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/age-bracket.ts src/lib/matricula.ts tests/lib/age-bracket.test.ts tests/lib/matricula.test.ts
git commit -m "feat: add computeAgeBracket and generateMatricula helpers"
```

---

### Task 3: Schema — extend Lead, extend Student, add PlacementAppointment and ReceptionLogEntry

**Files:**
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Produces: extended `Lead`/`Student`, new `PlacementAppointment`/`ReceptionLogEntry`/`StudentStatus`/`InterestType`/`ReceptionLogType` — consumed by every remaining task in this plan.

- [ ] **Step 1: Extend the `LeadSource` and `LeadStatus` enums**

In `prisma/schema.prisma`, add two values to the existing `LeadSource` enum (do not remove or reorder existing values):
```prisma
enum LeadSource {
  WEB
  REDES_SOCIALES
  REFERIDO
  VISITA_PRESENCIAL
  OTRO
  PRESENCIAL_RECEPCION
  VOLANTEO
}
```
Add one value to the existing `LeadStatus` enum, inserted between `CONTACTED` and `ENROLLED` (order matters for anything that reads the enum as a pipeline sequence in the UI, even though Postgres enums don't enforce ordering themselves):
```prisma
enum LeadStatus {
  NEW
  CONTACTED
  PLACEMENT_SCHEDULED
  ENROLLED
  LOST
}
```

- [ ] **Step 2: Add the new `InterestType` enum and extend `Lead`**

```prisma
enum InterestType {
  CURSO_REGULAR
  TALLER_CONVERSACION
  CERTIFICACION
}
```

Add these fields to the existing `Lead` model (keep every existing field untouched):
```prisma
model Lead {
  // ...existing fields (id, name, email, phone, message, campusId, status, source, createdAt)...
  dateOfBirth      DateTime?
  interestType     InterestType?
  notasBitacora    String?
  asesorAsignadoId String?

  asesorAsignado       User?                 @relation("LeadAdvisor", fields: [asesorAsignadoId], references: [id])
  placementAppointment PlacementAppointment?
}
```

- [ ] **Step 3: Add `PlacementAppointment`**

```prisma
model PlacementAppointment {
  id           String   @id @default(cuid())
  leadId       String   @unique
  scheduledFor DateTime
  campusId     String
  notes        String?
  createdAt    DateTime @default(now())

  lead   Lead   @relation(fields: [leadId], references: [id], onDelete: Cascade)
  campus Campus @relation(fields: [campusId], references: [id])
}
```

Add `placementAppointments PlacementAppointment[]` to `Campus`, and `leadsAsAdvisor Lead[] @relation("LeadAdvisor")` to `User`.

- [ ] **Step 4: Add `StudentStatus` enum and extend `Student`**

```prisma
enum StudentStatus {
  ACTIVO
  BAJA
  GRADUADO
}
```

Add these fields to the existing `Student` model (keep every existing field, including `userId`/`campusId`/relations, untouched):
```prisma
model Student {
  // ...existing fields...
  matricula          String        @unique
  curp               String?
  fechaNacimiento    DateTime?
  entregaActa        Boolean       @default(false)
  entregaCurp        Boolean       @default(false)
  entregaComprobante Boolean       @default(false)
  telefonoFijo       String?
  telefonoMovil      String?
  emailContacto      String?
  rfc                String?
  razonSocial        String?
  regimenFiscal      String?
  codigoPostalFiscal String?
  usoCfdi            String?
  estatusAlumno      StudentStatus @default(ACTIVO)
}
```

IMPORTANT: `matricula` has no default and no nullable modifier, but existing seeded `Student` rows have none. Prisma's `migrate dev` will prompt for how to handle existing rows when adding a required unique column with no default — since this is local dev data, resolve this by running the migration with a temporary default, then removing it, OR (simpler, and what to actually do): make the migration a two-step raw SQL edit — add the column as nullable first, backfill existing rows via a one-off script inside the migration (or accept Prisma's interactive prompt to provide a placeholder value per existing row if it offers one), then alter it to `NOT NULL UNIQUE` in the same migration file. If `npx prisma migrate dev` cannot proceed non-interactively for this reason, resolve it by: adding the field as `String? @unique` first, running a follow-up script to backfill matrículas for any existing seeded students (there are none in a fresh local DB per this project's seed — verify this is true by checking `prisma/seed.ts` creates no bare `Student` rows without also being expected to get a matrícula in this same migration's data, which it doesn't yet since Task 1 only touched Campus/User), and only requiring `NOT NULL` going forward. Simplest correct path for THIS project specifically: since the local dev database is disposable and reseedable (`npm run db:reset`), just add `matricula String @unique` directly (no nullable transition needed) and reset+reseed the local database as part of verification — do NOT overthink migration-safety for production data that doesn't exist yet in this project's current state.

- [ ] **Step 5: Add `ReceptionLogType` enum and `ReceptionLogEntry`**

```prisma
enum ReceptionLogType {
  LLAMADA
  INCIDENCIA
  NOTA
}

model ReceptionLogEntry {
  id          String           @id @default(cuid())
  campusId    String
  createdById String
  type        ReceptionLogType
  note        String
  createdAt   DateTime         @default(now())

  campus    Campus @relation(fields: [campusId], references: [id])
  createdBy User   @relation(fields: [createdById], references: [id], onDelete: Cascade)
}
```

Add `receptionLogEntries ReceptionLogEntry[]` to `Campus`, and `receptionLogEntries ReceptionLogEntry[]` to `User`.

- [ ] **Step 6: Run the migration**

Run: `npm run db:reset` (drops and recreates from scratch, since `matricula` needs no nullable-transition dance per Step 4's note) then `npx prisma migrate dev --name reception_4a_lead_student_extensions`, then `npm run db:seed`.
Expected: migration applies cleanly, seed runs cleanly (existing seeded `Student` rows, if the reset path creates any before this migration, would need a `matricula` — but since this is a fresh reset+migrate+seed sequence in that exact order, the seed script runs AFTER the schema already requires `matricula`, so `prisma/seed.ts`'s student-creation calls, if any, must already supply a `matricula`. Check `prisma/seed.ts` for any `prisma.student.create` calls — if found, add a literal seeded matrícula value like `"BRI-2026-00001"` to each, incrementing per seeded student, as a minimal fix to keep seeding working; this is in scope for this task since it's a direct consequence of the schema change).

- [ ] **Step 7: Verify**

Run: `npx prisma format --check` (fix with `npx prisma format` if needed), then `npx tsc --noEmit` (generate `.next/types` first via `npx next typegen` if `tsc` only complains about `LayoutProps<"/">` in `src/app/layout.tsx` — never edit that file).

- [ ] **Step 8: Commit**

```bash
git add prisma/schema.prisma prisma/migrations prisma/seed.ts
git commit -m "feat: extend Lead/Student, add PlacementAppointment and ReceptionLogEntry"
```

---

### Task 4: GET /api/admin/search

**Files:**
- Create: `src/app/api/admin/search/route.ts`
- Test: `tests/api/admin-search.test.ts`

**Interfaces:**
- Consumes: `auth`, `getCampusScope`, `prisma`.
- Produces: `GET /api/admin/search?q=` — consumed by Task 8's `<CommandPalette>`.

- [ ] **Step 1: Write the failing tests**

`tests/api/admin-search.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/campus-scope", () => ({ getCampusScope: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    student: { findMany: vi.fn() },
    lead: { findMany: vi.fn() },
    group: { findMany: vi.fn() },
  },
}));

import { auth } from "@/lib/auth";
import { getCampusScope } from "@/lib/campus-scope";
import { prisma } from "@/lib/prisma";
import { GET } from "@/app/api/admin/search/route";

function getRequest(qs: string) {
  return new Request(`http://localhost/api/admin/search${qs}`);
}

describe("GET /api/admin/search", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 without a session", async () => {
    (auth as any).mockResolvedValue(null);
    const res = await GET(getRequest("?q=ana"));
    expect(res.status).toBe(401);
  });

  it("returns 403 for a TEACHER", async () => {
    (auth as any).mockResolvedValue({ user: { id: "t1", role: "TEACHER" } });
    const res = await GET(getRequest("?q=ana"));
    expect(res.status).toBe(403);
  });

  it("returns 400 for a query shorter than 2 characters", async () => {
    (auth as any).mockResolvedValue({ user: { id: "a1", role: "ADMIN" } });
    const res = await GET(getRequest("?q=a"));
    expect(res.status).toBe(400);
  });

  it("returns grouped results scoped by campus, limited to 5 per type", async () => {
    (auth as any).mockResolvedValue({ user: { id: "s1", role: "STAFF" } });
    (getCampusScope as any).mockResolvedValue({ type: "CAMPUS_LIST", campusIds: ["c1"] });
    (prisma.student.findMany as any).mockResolvedValue([]);
    (prisma.lead.findMany as any).mockResolvedValue([]);
    (prisma.group.findMany as any).mockResolvedValue([]);

    const res = await GET(getRequest("?q=ana"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ students: [], leads: [], groups: [] });

    expect(prisma.student.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 5,
        where: expect.objectContaining({ campusId: { in: ["c1"] } }),
      })
    );
    expect(prisma.lead.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 5,
        where: expect.objectContaining({ campusId: { in: ["c1"] } }),
      })
    );
    expect(prisma.group.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 5,
        where: expect.objectContaining({ campusId: { in: ["c1"] } }),
      })
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/api/admin-search.test.ts`
Expected: FAIL — route doesn't exist yet.

- [ ] **Step 3: Implement**

`src/app/api/admin/search/route.ts`:
```ts
import { auth } from "@/lib/auth";
import { getCampusScope } from "@/lib/campus-scope";
import { prisma } from "@/lib/prisma";
import type { Prisma, Role } from "@prisma/client";

function campusFilter(scope: Awaited<ReturnType<typeof getCampusScope>>): Prisma.StringFilter | undefined {
  if (scope.type === "CAMPUS_LIST") return undefined; // handled per-model below via campusId: { in }
  return undefined;
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }
  const role = (session.user as { role: Role }).role;
  if (role !== "ADMIN" && role !== "STAFF") {
    return Response.json({ error: "No autorizado" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) {
    return Response.json({ error: "La búsqueda requiere al menos 2 caracteres" }, { status: 400 });
  }

  const scope = await getCampusScope(session.user as { id: string; role: Role });
  const campusWhere: Prisma.StudentWhereInput | Prisma.LeadWhereInput | Prisma.GroupWhereInput =
    scope.type === "ALL" ? {} : scope.type === "CAMPUS_LIST" ? { campusId: { in: scope.campusIds } } : { id: { in: [] } };

  const [students, leads, groups] = await Promise.all([
    prisma.student.findMany({
      where: {
        ...campusWhere,
        OR: [
          { matricula: { contains: q, mode: "insensitive" } },
          { user: { name: { contains: q, mode: "insensitive" } } },
        ],
      },
      take: 5,
      select: { id: true, matricula: true, user: { select: { name: true } } },
    }),
    prisma.lead.findMany({
      where: {
        ...campusWhere,
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
          { phone: { contains: q, mode: "insensitive" } },
        ],
      },
      take: 5,
      select: { id: true, name: true, email: true },
    }),
    prisma.group.findMany({
      where: { ...campusWhere, name: { contains: q, mode: "insensitive" } },
      take: 5,
      select: { id: true, name: true },
    }),
  ]);

  return Response.json({ students, leads, groups });
}
```

Note: the unused `campusFilter` helper stub above is scaffolding text only — do NOT include it in the final file; the inline `campusWhere` ternary in `GET` is the actual implementation. Remove that dead stub before committing.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/api/admin-search.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/app/api/admin/search tests/api/admin-search.test.ts
git commit -m "feat: add GET /api/admin/search (global search)"
```

---

### Task 5: POST /api/admin/students/quick-create

**Files:**
- Create: `src/app/api/admin/students/quick-create/route.ts`
- Test: `tests/api/admin-students-quick-create.test.ts`

**Interfaces:**
- Consumes: `auth`, `getCampusScope`, `generateMatricula`, `hashPassword`, `prisma`.
- Produces: `POST /api/admin/students/quick-create` — consumed by Task 9's `<QuickCreateDrawer>`.

- [ ] **Step 1: Write the failing tests**

`tests/api/admin-students-quick-create.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/campus-scope", () => ({ getCampusScope: vi.fn() }));
vi.mock("@/lib/matricula", () => ({ generateMatricula: vi.fn() }));
vi.mock("@/lib/password", () => ({ hashPassword: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(),
  },
}));

import { auth } from "@/lib/auth";
import { getCampusScope } from "@/lib/campus-scope";
import { generateMatricula } from "@/lib/matricula";
import { hashPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { POST } from "@/app/api/admin/students/quick-create/route";

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/admin/students/quick-create", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

const VALID_BODY = { name: "Ana Torres", email: "ana@example.com", campusId: "c1" };

describe("POST /api/admin/students/quick-create", () => {
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

  it("returns 403 when STAFF targets a campus outside their scope", async () => {
    (auth as any).mockResolvedValue({ user: { id: "s1", role: "STAFF" } });
    (getCampusScope as any).mockResolvedValue({ type: "CAMPUS_LIST", campusIds: ["c2"] });
    const res = await POST(jsonRequest(VALID_BODY));
    expect(res.status).toBe(403);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("returns 400 for a missing name or invalid email", async () => {
    (auth as any).mockResolvedValue({ user: { id: "a1", role: "ADMIN" } });
    const res = await POST(jsonRequest({ email: "ana@example.com", campusId: "c1" }));
    expect(res.status).toBe(400);
  });

  it("creates User+Student with a generated matrícula in one transaction on success", async () => {
    (auth as any).mockResolvedValue({ user: { id: "a1", role: "ADMIN" } });
    (hashPassword as any).mockResolvedValue("hashed");
    (generateMatricula as any).mockResolvedValue("BRI-2026-00001");
    (prisma.$transaction as any).mockImplementation(async (fn: any) =>
      fn({
        user: { create: vi.fn().mockResolvedValue({ id: "u1" }) },
        student: { create: vi.fn().mockResolvedValue({ id: "st1", matricula: "BRI-2026-00001" }) },
      })
    );

    const res = await POST(jsonRequest(VALID_BODY));
    expect(res.status).toBe(201);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/api/admin-students-quick-create.test.ts`
Expected: FAIL — route doesn't exist yet.

- [ ] **Step 3: Implement**

`src/app/api/admin/students/quick-create/route.ts`:
```ts
import { auth } from "@/lib/auth";
import { getCampusScope } from "@/lib/campus-scope";
import { generateMatricula } from "@/lib/matricula";
import { hashPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { isValidEmail } from "@/lib/validation";
import type { Role } from "@prisma/client";
import crypto from "node:crypto";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }
  const role = (session.user as { role: Role }).role;
  if (role !== "ADMIN" && role !== "STAFF") {
    return Response.json({ error: "No autorizado" }, { status: 403 });
  }

  let body: { name?: string; email?: string; campusId?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Cuerpo de la solicitud inválido" }, { status: 400 });
  }

  const name = body.name?.trim();
  const email = body.email?.trim();
  if (!name || !email || !body.campusId || !isValidEmail(email)) {
    return Response.json({ error: "Datos inválidos" }, { status: 400 });
  }

  if (role === "STAFF") {
    const scope = await getCampusScope(session.user as { id: string; role: Role });
    const inScope = scope.type === "ALL" || (scope.type === "CAMPUS_LIST" && scope.campusIds.includes(body.campusId));
    if (!inScope) {
      return Response.json({ error: "No autorizado" }, { status: 403 });
    }
  }

  const temporaryPassword = crypto.randomBytes(12).toString("base64url");
  const passwordHash = await hashPassword(temporaryPassword);

  const student = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { name, email, role: "STUDENT", passwordHash },
    });
    const matricula = await generateMatricula(tx);
    return tx.student.create({
      data: { userId: user.id, campusId: body.campusId!, matricula },
    });
  });

  return Response.json(student, { status: 201 });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/api/admin-students-quick-create.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/app/api/admin/students/quick-create tests/api/admin-students-quick-create.test.ts
git commit -m "feat: add POST /api/admin/students/quick-create"
```

---

### Task 6: GET/PATCH /api/admin/leads/waitlist

**Files:**
- Create: `src/app/api/admin/leads/waitlist/route.ts`
- Test: `tests/api/admin-leads-waitlist.test.ts`

**Interfaces:**
- Consumes: `auth`, `getCampusScope`, `leadScopeWhere`, `prisma`.
- Produces: `GET/PATCH /api/admin/leads/waitlist` — consumed by Task 10's kanban page.

- [ ] **Step 1: Write the failing tests**

`tests/api/admin-leads-waitlist.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/campus-scope", () => ({ getCampusScope: vi.fn(), leadScopeWhere: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { lead: { findMany: vi.fn(), update: vi.fn() } },
}));

import { auth } from "@/lib/auth";
import { getCampusScope, leadScopeWhere } from "@/lib/campus-scope";
import { prisma } from "@/lib/prisma";
import { GET, PATCH } from "@/app/api/admin/leads/waitlist/route";

function jsonRequest(body: unknown, method = "PATCH") {
  return new Request("http://localhost/api/admin/leads/waitlist", {
    method,
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("GET /api/admin/leads/waitlist", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 without a session", async () => {
    (auth as any).mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns leads scoped by campus, ordered by createdAt", async () => {
    (auth as any).mockResolvedValue({ user: { id: "s1", role: "STAFF" } });
    (getCampusScope as any).mockResolvedValue({ type: "CAMPUS_LIST", campusIds: ["c1"] });
    (leadScopeWhere as any).mockReturnValue({ campusId: { in: ["c1"] } });
    (prisma.lead.findMany as any).mockResolvedValue([]);

    const res = await GET();
    expect(res.status).toBe(200);
    expect(prisma.lead.findMany).toHaveBeenCalledWith({
      where: { campusId: { in: ["c1"] } },
      orderBy: { createdAt: "asc" },
    });
  });
});

describe("PATCH /api/admin/leads/waitlist", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 for an invalid status value", async () => {
    (auth as any).mockResolvedValue({ user: { id: "a1", role: "ADMIN" } });
    const res = await PATCH(jsonRequest({ id: "l1", status: "BOGUS" }));
    expect(res.status).toBe(400);
    expect(prisma.lead.update).not.toHaveBeenCalled();
  });

  it("updates the lead's status on a valid request", async () => {
    (auth as any).mockResolvedValue({ user: { id: "a1", role: "ADMIN" } });
    (prisma.lead.update as any).mockResolvedValue({ id: "l1", status: "CONTACTED" });

    const res = await PATCH(jsonRequest({ id: "l1", status: "CONTACTED" }));
    expect(res.status).toBe(200);
    expect(prisma.lead.update).toHaveBeenCalledWith({
      where: { id: "l1" },
      data: { status: "CONTACTED" },
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/api/admin-leads-waitlist.test.ts`
Expected: FAIL — route doesn't exist yet.

- [ ] **Step 3: Implement**

`src/app/api/admin/leads/waitlist/route.ts`:
```ts
import { auth } from "@/lib/auth";
import { getCampusScope, leadScopeWhere } from "@/lib/campus-scope";
import { prisma } from "@/lib/prisma";
import type { LeadStatus, Role } from "@prisma/client";

const VALID_STATUSES: LeadStatus[] = ["NEW", "CONTACTED", "PLACEMENT_SCHEDULED", "ENROLLED", "LOST"];

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

  const leads = await prisma.lead.findMany({ where, orderBy: { createdAt: "asc" } });
  return Response.json(leads);
}

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }
  const role = (session.user as { role: Role }).role;
  if (role !== "ADMIN" && role !== "STAFF") {
    return Response.json({ error: "No autorizado" }, { status: 403 });
  }

  let body: { id?: string; status?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Cuerpo de la solicitud inválido" }, { status: 400 });
  }

  if (!body.id || !body.status || !VALID_STATUSES.includes(body.status as LeadStatus)) {
    return Response.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const lead = await prisma.lead.update({
    where: { id: body.id },
    data: { status: body.status as LeadStatus },
  });

  return Response.json(lead);
}
```

Note: this route intentionally does not re-verify the lead belongs to the caller's campus scope before the `update` — the same gap would exist as a pre-existing pattern to match if `leadScopeWhere` isn't threaded into the `update`'s `where`. To close this properly, change the `PATCH` update call to `prisma.lead.updateMany({ where: { id: body.id, ...leadScopeWhere(scope) }, data: { status: body.status as LeadStatus } })` and check the returned `count === 1` (404 if `0`, since either the lead doesn't exist or is outside scope) — implement it this way, not the bare `update` shown above, which was left unscoped only for brevity in this brief. Compute `scope`/`where` once before both the count-check and any usage.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/api/admin-leads-waitlist.test.ts`
Expected: PASS — you will need to adjust the PATCH test's mock for `prisma.lead.updateMany` instead of `prisma.lead.update` to match the corrected implementation described in the Note above; update the test file accordingly (mock `updateMany` returning `{ count: 1 }` for the success case, and add a case for `count: 0` → 404).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/admin/leads/waitlist tests/api/admin-leads-waitlist.test.ts
git commit -m "feat: add GET/PATCH /api/admin/leads/waitlist"
```

---

### Task 7: GET/POST /api/admin/placement-appointments

**Files:**
- Create: `src/app/api/admin/placement-appointments/route.ts`
- Test: `tests/api/admin-placement-appointments.test.ts`

**Interfaces:**
- Consumes: `auth`, `getCampusScope`, `prisma`.
- Produces: `GET/POST /api/admin/placement-appointments` — consumed by Task 10's calendar page.

- [ ] **Step 1: Write the failing tests**

`tests/api/admin-placement-appointments.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/campus-scope", () => ({ getCampusScope: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    placementAppointment: { findMany: vi.fn(), create: vi.fn() },
    lead: { findUnique: vi.fn() },
  },
}));

import { auth } from "@/lib/auth";
import { getCampusScope } from "@/lib/campus-scope";
import { prisma } from "@/lib/prisma";
import { GET, POST } from "@/app/api/admin/placement-appointments/route";

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/admin/placement-appointments", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

const VALID_BODY = { leadId: "l1", campusId: "c1", scheduledFor: "2026-09-01T16:00:00.000Z" };

describe("GET /api/admin/placement-appointments", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 without a session", async () => {
    (auth as any).mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns appointments scoped by campus", async () => {
    (auth as any).mockResolvedValue({ user: { id: "s1", role: "STAFF" } });
    (getCampusScope as any).mockResolvedValue({ type: "CAMPUS_LIST", campusIds: ["c1"] });
    (prisma.placementAppointment.findMany as any).mockResolvedValue([]);

    const res = await GET();
    expect(res.status).toBe(200);
    expect(prisma.placementAppointment.findMany).toHaveBeenCalledWith({
      where: { campusId: { in: ["c1"] } },
      orderBy: { scheduledFor: "asc" },
      include: { lead: true },
    });
  });
});

describe("POST /api/admin/placement-appointments", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 for a nonexistent leadId", async () => {
    (auth as any).mockResolvedValue({ user: { id: "a1", role: "ADMIN" } });
    (prisma.lead.findUnique as any).mockResolvedValue(null);
    const res = await POST(jsonRequest(VALID_BODY));
    expect(res.status).toBe(404);
    expect(prisma.placementAppointment.create).not.toHaveBeenCalled();
  });

  it("returns 400 when the requested slot overlaps an existing appointment at the same campus and time", async () => {
    (auth as any).mockResolvedValue({ user: { id: "a1", role: "ADMIN" } });
    (prisma.lead.findUnique as any).mockResolvedValue({ id: "l1" });
    (prisma.placementAppointment.findMany as any).mockResolvedValue([
      { id: "existing", scheduledFor: new Date(VALID_BODY.scheduledFor) },
    ]);

    const res = await POST(jsonRequest(VALID_BODY));
    expect(res.status).toBe(400);
    expect(prisma.placementAppointment.create).not.toHaveBeenCalled();
  });

  it("creates the appointment on success", async () => {
    (auth as any).mockResolvedValue({ user: { id: "a1", role: "ADMIN" } });
    (prisma.lead.findUnique as any).mockResolvedValue({ id: "l1" });
    (prisma.placementAppointment.findMany as any).mockResolvedValue([]);
    (prisma.placementAppointment.create as any).mockResolvedValue({ id: "pa1" });

    const res = await POST(jsonRequest(VALID_BODY));
    expect(res.status).toBe(201);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/api/admin-placement-appointments.test.ts`
Expected: FAIL — route doesn't exist yet.

- [ ] **Step 3: Implement**

`src/app/api/admin/placement-appointments/route.ts`:
```ts
import { auth } from "@/lib/auth";
import { getCampusScope } from "@/lib/campus-scope";
import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";

const OVERLAP_WINDOW_MS = 30 * 60 * 1000; // 30-minute exams; a new one within this window of an existing one at the same campus is a conflict

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

  const appointments = await prisma.placementAppointment.findMany({
    where,
    orderBy: { scheduledFor: "asc" },
    include: { lead: true },
  });

  return Response.json(appointments);
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

  let body: { leadId?: string; campusId?: string; scheduledFor?: string; notes?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Cuerpo de la solicitud inválido" }, { status: 400 });
  }

  if (!body.leadId || !body.campusId || !body.scheduledFor) {
    return Response.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const scheduledFor = new Date(body.scheduledFor);
  if (Number.isNaN(scheduledFor.getTime())) {
    return Response.json({ error: "Fecha inválida" }, { status: 400 });
  }

  const lead = await prisma.lead.findUnique({ where: { id: body.leadId } });
  if (!lead) {
    return Response.json({ error: "Lead no encontrado" }, { status: 404 });
  }

  const windowStart = new Date(scheduledFor.getTime() - OVERLAP_WINDOW_MS);
  const windowEnd = new Date(scheduledFor.getTime() + OVERLAP_WINDOW_MS);
  const overlapping = await prisma.placementAppointment.findMany({
    where: { campusId: body.campusId, scheduledFor: { gte: windowStart, lte: windowEnd } },
  });
  if (overlapping.length > 0) {
    return Response.json({ error: "Ya existe una cita en ese horario para este plantel" }, { status: 400 });
  }

  const appointment = await prisma.placementAppointment.create({
    data: {
      leadId: body.leadId,
      campusId: body.campusId,
      scheduledFor,
      notes: body.notes?.trim() || null,
    },
  });

  return Response.json(appointment, { status: 201 });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/api/admin-placement-appointments.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/app/api/admin/placement-appointments tests/api/admin-placement-appointments.test.ts
git commit -m "feat: add GET/POST /api/admin/placement-appointments"
```

---

### Task 8: GET/POST /api/admin/reception-log and monthly report

**Files:**
- Create: `src/app/api/admin/reception-log/route.ts`
- Create: `src/app/api/admin/reception-log/monthly-report/route.ts`
- Test: `tests/api/admin-reception-log.test.ts`

**Interfaces:**
- Consumes: `auth`, `getCampusScope`, `prisma`.
- Produces: `GET/POST /api/admin/reception-log`, `GET /api/admin/reception-log/monthly-report` — consumed by Task 10's bitácora page.

- [ ] **Step 1: Write the failing tests**

`tests/api/admin-reception-log.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/campus-scope", () => ({ getCampusScope: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    receptionLogEntry: { findMany: vi.fn(), create: vi.fn() },
    lead: { count: vi.fn() },
    student: { count: vi.fn() },
  },
}));

import { auth } from "@/lib/auth";
import { getCampusScope } from "@/lib/campus-scope";
import { prisma } from "@/lib/prisma";
import { GET, POST } from "@/app/api/admin/reception-log/route";
import { GET as GET_REPORT } from "@/app/api/admin/reception-log/monthly-report/route";

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/admin/reception-log", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/admin/reception-log", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 for a blank note", async () => {
    (auth as any).mockResolvedValue({ user: { id: "s1", role: "STAFF" } });
    const res = await POST(jsonRequest({ campusId: "c1", type: "NOTA", note: "   " }));
    expect(res.status).toBe(400);
    expect(prisma.receptionLogEntry.create).not.toHaveBeenCalled();
  });

  it("creates a log entry on success", async () => {
    (auth as any).mockResolvedValue({ user: { id: "s1", role: "STAFF" } });
    (prisma.receptionLogEntry.create as any).mockResolvedValue({ id: "rl1" });
    const res = await POST(jsonRequest({ campusId: "c1", type: "LLAMADA", note: "Llamó un padre de familia" }));
    expect(res.status).toBe(201);
  });
});

describe("GET /api/admin/reception-log", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 without a session", async () => {
    (auth as any).mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });
});

describe("GET /api/admin/reception-log/monthly-report", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns altas and bajas counts for the current month, scoped by campus", async () => {
    (auth as any).mockResolvedValue({ user: { id: "s1", role: "STAFF" } });
    (getCampusScope as any).mockResolvedValue({ type: "CAMPUS_LIST", campusIds: ["c1"] });
    (prisma.lead.count as any).mockResolvedValue(4);
    (prisma.student.count as any).mockResolvedValue(1);

    const res = await GET_REPORT();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ altas: 4, bajas: 1 });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/api/admin-reception-log.test.ts`
Expected: FAIL — routes don't exist yet.

- [ ] **Step 3: Implement**

`src/app/api/admin/reception-log/route.ts`:
```ts
import { auth } from "@/lib/auth";
import { getCampusScope } from "@/lib/campus-scope";
import { prisma } from "@/lib/prisma";
import type { ReceptionLogType, Role } from "@prisma/client";

const VALID_TYPES: ReceptionLogType[] = ["LLAMADA", "INCIDENCIA", "NOTA"];
const MAX_NOTE_LENGTH = 2000;

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

  const entries = await prisma.receptionLogEntry.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { createdBy: { select: { id: true, name: true } } },
  });
  return Response.json(entries);
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

  let body: { campusId?: string; type?: string; note?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Cuerpo de la solicitud inválido" }, { status: 400 });
  }

  const note = body.note?.trim();
  if (!body.campusId || !body.type || !VALID_TYPES.includes(body.type as ReceptionLogType) || !note || note.length > MAX_NOTE_LENGTH) {
    return Response.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const entry = await prisma.receptionLogEntry.create({
    data: {
      campusId: body.campusId,
      type: body.type as ReceptionLogType,
      note,
      createdById: (session.user as { id: string }).id,
    },
  });

  return Response.json(entry, { status: 201 });
}
```

`src/app/api/admin/reception-log/monthly-report/route.ts`:
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
  const campusFilter =
    scope.type === "ALL" ? {} : scope.type === "CAMPUS_LIST" ? { campusId: { in: scope.campusIds } } : { id: { in: [] } };

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const [altas, bajas] = await Promise.all([
    prisma.lead.count({
      where: { ...campusFilter, status: "ENROLLED", createdAt: { gte: monthStart, lt: monthEnd } },
    }),
    prisma.student.count({
      where: { ...campusFilter, estatusAlumno: "BAJA", createdAt: { gte: monthStart, lt: monthEnd } },
    }),
  ]);

  return Response.json({ altas, bajas });
}
```

Note: counting "altas" by `Lead.createdAt` falling in the current month while also requiring `status: "ENROLLED"` is an approximation (a lead created last month but converted to ENROLLED this month won't count as this month's alta). This is a known, acceptable simplification for a first version — do not try to track a separate `enrolledAt` timestamp in this task; that's a reasonable future refinement, not a defect to fix now.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/api/admin-reception-log.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/api/admin/reception-log tests/api/admin-reception-log.test.ts
git commit -m "feat: add reception log and monthly report endpoints"
```

---

### Task 9: CommandPalette and QuickCreateDrawer

**Files:**
- Create: `src/components/admin/command-palette.tsx`
- Create: `src/components/admin/quick-create-drawer.tsx`
- Modify: the admin layout file that wraps every `/admin/*` page (find it — likely `src/app/admin/layout.tsx`; read it first) to mount `<CommandPalette>` once, globally.

**Interfaces:**
- Consumes: `GET /api/admin/search` (Task 4), `POST /api/admin/students/quick-create` (Task 5).
- Produces: a global Cmd+K/Ctrl+K search overlay and a "Nuevo alumno" drawer trigger, both available from any admin page.

- [ ] **Step 1: Find and read the admin layout**

Run: `find src/app/admin -maxdepth 1 -name "layout.tsx"` and read whatever it finds — this is where `<AdminNav>` is already mounted; `<CommandPalette>` goes in the same place, once.

- [ ] **Step 2: CommandPalette**

`src/components/admin/command-palette.tsx`:
```tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

interface SearchResults {
  students: { id: string; matricula: string; user: { name: string } }[];
  leads: { id: string; name: string; email: string }[];
  groups: { id: string; name: string }[];
}

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === "Escape") {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const runSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults(null);
      return;
    }
    try {
      const res = await fetch(`/api/admin/search?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        setResults(await res.json());
      }
    } catch {
      setResults(null);
    }
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => runSearch(query), 200);
    return () => clearTimeout(timeout);
  }, [query, runSearch]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-24" onClick={() => setOpen(false)}>
      <div
        className="w-full max-w-lg rounded-2xl bg-white p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar alumno, lead o grupo..."
          className="w-full rounded-md border border-border px-3 py-2 text-sm"
        />
        {results && (
          <div className="mt-3 max-h-80 space-y-3 overflow-y-auto">
            {results.students.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted">Alumnos</p>
                {results.students.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      setOpen(false);
                      router.push(`/admin/admisiones?studentId=${s.id}`);
                    }}
                    className="block w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-surface"
                  >
                    {s.user.name} · {s.matricula}
                  </button>
                ))}
              </div>
            )}
            {results.leads.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted">Leads</p>
                {results.leads.map((l) => (
                  <div key={l.id} className="rounded-md px-2 py-1.5 text-sm">
                    {l.name} · {l.email}
                  </div>
                ))}
              </div>
            )}
            {results.groups.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted">Grupos</p>
                {results.groups.map((g) => (
                  <div key={g.id} className="rounded-md px-2 py-1.5 text-sm">
                    {g.name}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
```

Note: the student result's `router.push` target (`/admin/admisiones?studentId=...`) is a placeholder destination since no single "student detail" page exists yet in this codebase — leave it pointing at `/admin/admisiones` (the closest existing page) rather than inventing a route that doesn't exist. This is a known limitation, not a bug to over-engineer around in this task.

- [ ] **Step 3: QuickCreateDrawer**

`src/components/admin/quick-create-drawer.tsx`:
```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function QuickCreateDrawer({ campuses }: { campuses: { id: string; name: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [campusId, setCampusId] = useState(campuses[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/students/quick-create", {
        method: "POST",
        body: JSON.stringify({ name, email, campusId }),
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "No se pudo crear el alumno");
        return;
      }

      setName("");
      setEmail("");
      setOpen(false);
      router.refresh();
    } catch {
      setError("No se pudo crear el alumno");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
      >
        + Nuevo alumno
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={() => setOpen(false)}>
          <div className="h-full w-full max-w-md bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold">Nuevo alumno</h2>
            <form onSubmit={handleSubmit} className="mt-4 space-y-3">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nombre completo"
                required
                className="w-full rounded-md border border-border px-3 py-2 text-sm"
              />
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Correo electrónico"
                required
                type="email"
                className="w-full rounded-md border border-border px-3 py-2 text-sm"
              />
              <select
                value={campusId}
                onChange={(e) => setCampusId(e.target.value)}
                className="w-full rounded-md border border-border px-2 py-2 text-sm"
              >
                {campuses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              {error && <p className="text-sm text-accent-dark">{error}</p>}
              <Button type="submit" disabled={submitting}>
                {submitting ? "Creando..." : "Crear alumno"}
              </Button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 4: Mount both in the admin layout**

In the admin layout file found in Step 1, mount `<CommandPalette />` once, and render `<QuickCreateDrawer campuses={campuses} />` somewhere in the header (fetch `campuses` via `prisma.campus.findMany` in that layout if it's a server component — read the file to see whether it already fetches anything, and follow its existing data-fetching convention).

- [ ] **Step 5: Verify it builds**

Run: kill any running `next dev` (`pgrep -f "next dev" | xargs -r kill`), `rm -rf .next`, then `npm run build`.
Expected: clean build, every `/admin/*` page still compiles (layout change affects all of them).

- [ ] **Step 6: Commit**

```bash
git add src/components/admin/command-palette.tsx src/components/admin/quick-create-drawer.tsx src/app/admin/layout.tsx
git commit -m "feat: add global command palette and quick-create drawer"
```

---

### Task 10: Recepción pages (lista de espera, agenda, bitácora) and nav entries

**Files:**
- Create: `src/app/admin/recepcion/lista-espera/page.tsx`
- Create: `src/app/admin/recepcion/agenda/page.tsx`
- Create: `src/app/admin/recepcion/bitacora/page.tsx`
- Modify: `src/components/admin/admin-nav.tsx`

**Interfaces:**
- Consumes: `GET/PATCH /api/admin/leads/waitlist` (Task 6), `GET/POST /api/admin/placement-appointments` (Task 7), `GET/POST /api/admin/reception-log` + monthly-report (Task 8).
- Produces: three new admin pages, plus three new `AdminNav` entries.

- [ ] **Step 1: Add nav entries**

In `src/components/admin/admin-nav.tsx`, add these three entries to the end of `MODULES`: `{ href: "/admin/recepcion/lista-espera", label: "Lista de Espera" }`, `{ href: "/admin/recepcion/agenda", label: "Agenda" }`, `{ href: "/admin/recepcion/bitacora", label: "Bitácora" }`.

- [ ] **Step 2: Lista de espera (client-side kanban)**

`src/app/admin/recepcion/lista-espera/page.tsx` is a client component (data fetched client-side via `useEffect`/`fetch`, since drag-and-drop status changes need to update local state immediately without a full page reload — this is a deliberate deviation from this project's usual server-component-first pattern, justified by the interactive board UI). Structure:
```tsx
"use client";

import { useEffect, useState } from "react";

const COLUMNS: { status: string; label: string }[] = [
  { status: "NEW", label: "Nuevo" },
  { status: "CONTACTED", label: "Contactado" },
  { status: "PLACEMENT_SCHEDULED", label: "Examen Agendado" },
  { status: "ENROLLED", label: "Inscrito" },
];

interface LeadRow {
  id: string;
  name: string;
  email: string;
  status: string;
}

export default function ListaEsperaPage() {
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/leads/waitlist")
      .then((res) => res.json())
      .then(setLeads)
      .finally(() => setLoading(false));
  }, []);

  async function moveTo(id: string, status: string) {
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, status } : l)));
    const res = await fetch("/api/admin/leads/waitlist", {
      method: "PATCH",
      body: JSON.stringify({ id, status }),
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) {
      // revert on failure
      fetch("/api/admin/leads/waitlist")
        .then((r) => r.json())
        .then(setLeads);
    }
  }

  if (loading) return <p className="text-sm text-muted">Cargando...</p>;

  return (
    <div>
      <h1 className="text-lg font-semibold">Lista de Espera</h1>
      <div className="mt-6 grid gap-4 md:grid-cols-4">
        {COLUMNS.map((col) => (
          <div key={col.status} className="rounded-lg border border-border bg-surface p-3">
            <h2 className="text-sm font-semibold">
              {col.label} ({leads.filter((l) => l.status === col.status).length})
            </h2>
            <div className="mt-3 space-y-2">
              {leads
                .filter((l) => l.status === col.status)
                .map((lead) => (
                  <div key={lead.id} className="rounded-md bg-white p-2 text-sm shadow-sm">
                    <p className="font-medium">{lead.name}</p>
                    <p className="text-xs text-muted">{lead.email}</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {COLUMNS.filter((c) => c.status !== col.status).map((target) => (
                        <button
                          key={target.status}
                          onClick={() => moveTo(lead.id, target.status)}
                          className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted hover:bg-surface"
                        >
                          → {target.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```
(Buttons that move a card to another column stand in for drag-and-drop — implementing real HTML5 drag-and-drop is a UI-polish upgrade for a future pass, not required for this task's functional scope.)

- [ ] **Step 3: Agenda page**

`src/app/admin/recepcion/agenda/page.tsx`: server component, fetches appointments via `prisma.placementAppointment.findMany` directly (following this project's usual server-component pattern — the kanban board in Step 2 is the deliberate exception, this page is not), grouped by day, listing `lead.name` + `scheduledFor` formatted with `toLocaleString("es-MX")`. Include a simple form (`method="post"` won't work for a client mutation — use a small client subcomponent `<PlacementAppointmentForm>` inline in the same file marked `"use client"` at the top of that sub-component only, or as a separate file if cleaner) to create a new appointment against `POST /api/admin/placement-appointments`, with fields: lead selector (fetch leads server-side and pass as a prop), campus (from `getCampusScope`), date/time picker.

- [ ] **Step 4: Bitácora page**

`src/app/admin/recepcion/bitacora/page.tsx`: server component listing today's `ReceptionLogEntry` rows (fetch via `prisma.receptionLogEntry.findMany` filtered to today's date range), a small client form to add a new entry (type selector + note textarea) posting to `POST /api/admin/reception-log`, and a button "Generar reporte mensual" that calls `GET /api/admin/reception-log/monthly-report` client-side and displays the `{ altas, bajas }` result in a simple alert-style callout on the page (no PDF/export in this version — just on-screen numbers).

- [ ] **Step 5: Verify it builds**

Run: `npm run build`
Expected: all three new routes compile.

- [ ] **Step 6: Commit**

```bash
git add src/app/admin/recepcion src/components/admin/admin-nav.tsx
git commit -m "feat: add recepción pages (lista de espera, agenda, bitácora)"
```

---

## Post-plan checklist

- [ ] `npm test` — all suites pass
- [ ] `npx tsc --noEmit` — no type errors
- [ ] `npm run build` — production build succeeds, all new routes listed
- [ ] Manual smoke test: press Cmd+K on any admin page and search for the seeded student; open the quick-create drawer and register a test student, confirm a matrícula like `BRI-2026-00003` was generated; move a lead across the lista de espera columns; schedule a placement appointment; log a bitácora entry and generate the monthly report
