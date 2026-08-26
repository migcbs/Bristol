# Bristol Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the shared foundation for Bristol — auth, roles, core data model, campus scoping, and a shared design shell — so Spec 1 (Landing), Spec 2 (Admin), and Spec 3 (Academic Portal) can be built on top without retrofitting.

**Architecture:** A single Next.js App Router project with Prisma/PostgreSQL, Auth.js v5 (Credentials provider, JWT sessions), Resend for transactional email, and Tailwind CSS with brand tokens. The `admin/` and `portal/` route segments are protected by a `proxy.ts` route guard (Next.js 16's renamed `middleware.ts`) that reads the session role; a `getCampusScope` helper centralizes plantel-based query filtering for reuse by later specs.

**Tech Stack:** Next.js 15 (App Router, TypeScript), Prisma + PostgreSQL, next-auth v5 (beta), bcryptjs, Resend, Tailwind CSS, Vitest.

## Global Constraints

- Single Next.js app (no monorepo) — per approved architecture (Spec 0 design, "Opción A").
- 5 roles exactly: `ADMIN`, `STAFF`, `TEACHER`, `STUDENT`, `PARENT` — no others.
- `Student.campusId` is a direct FK (one campus per student); `StaffCampus`/`TeacherCampus`/`ParentStudent` are join tables (many-to-many).
- Light mode only — no dark mode tokens in this spec.
- No public self-registration screens — users are created via seed/admin scripts only. The forgot/reset-password flow IS in scope (core auth).
- Brand colors are placeholders pending final assets: primary `#2B2B7A` (navy), accent `#E63329` (red) — centralized in one token file so they're a one-line change later.
- Every task must leave `npm run build`, `npm test`, and `npx tsc --noEmit` passing.
- **Node ≥20.9 required.** Next.js 16 does not run on this machine's default Node 18. Run `nvm use 22` (or select any Node ≥20.9) before any `npm run build` / `npm test` / `npx tsc --noEmit` in every task — `.nvmrc` (`22`) is already committed.
- **Tailwind CSS v4 is CSS-first — there is no `tailwind.config.ts`.** Design tokens live in a `@theme` block inside `src/app/globals.css` (see Task 10, updated from the original plan text). Do not create a `tailwind.config.ts`.
- **AppleDouble junk files.** This repo lives on a network volume that spawns `._<filename>` shadow files on write, which can break lint/build with a parse error. If that happens, run `find . -name "._*" -not -path "./node_modules/*" -not -path "./.git/*" -delete` (`._*` is already gitignored).

---

## File Structure

```
prisma/
  schema.prisma
  seed.ts
src/
  lib/
    prisma.ts            # PrismaClient singleton
    password.ts           # hash/verify helpers
    campus-scope.ts        # getCampusScope helper
    email.ts              # Resend send helpers
    auth.ts               # NextAuth config (authorize, callbacks)
    tokens.ts             # verification/reset token create+consume helpers
  components/ui/
    button.tsx
    card.tsx
    input.tsx
    badge.tsx
    table.tsx
  app/
    layout.tsx
    globals.css            # Tailwind + CSS variable tokens
    api/
      auth/[...nextauth]/route.ts
      auth/forgot-password/route.ts
      auth/reset-password/route.ts
      students/route.ts     # example scoped endpoint
    (public)/
      login/page.tsx
      forgot-password/page.tsx
      reset-password/page.tsx
    admin/
      layout.tsx            # role guard shell for ADMIN/STAFF
      page.tsx              # placeholder dashboard
    portal/
      layout.tsx            # role guard shell for TEACHER/STUDENT/PARENT
      page.tsx              # placeholder dashboard
  proxy.ts
tests/
  lib/password.test.ts
  lib/campus-scope.test.ts
  lib/auth.test.ts
  api/students.test.ts
```

Each `lib/` file has one responsibility (hashing, scoping, tokens, email, auth wiring) so later specs can import exactly what they need without pulling in unrelated code.

---

### Task 1: Project scaffolding

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `.gitignore`, `.env.example`, `vitest.config.ts` (Tailwind v4 is CSS-first — no `tailwind.config.ts`)
- Create: `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`

**Interfaces:**
- Produces: a runnable Next.js app (`npm run dev`), Tailwind wired, Vitest wired (`npm test`).

- [ ] **Step 1: Scaffold Next.js app**

```bash
npx create-next-app@latest . --typescript --tailwind --app --src-dir --import-alias "@/*" --eslint --no-turbopack --use-npm
```

Answer "Yes" if prompted to use existing directory (it already has `README.md`).

- [ ] **Step 2: Install foundation dependencies**

```bash
npm install prisma @prisma/client next-auth@beta bcryptjs resend
npm install -D vitest @vitejs/plugin-react vite-tsconfig-paths tsx
```

- [ ] **Step 3: Add Vitest config**

`vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
```

- [ ] **Step 4: Add test script to package.json**

Edit `package.json` scripts block to include:
```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "eslint",
  "test": "vitest run",
  "db:seed": "tsx prisma/seed.ts"
}
```

- [ ] **Step 5: Verify the app builds and boots**

Run: `npm run build`
Expected: build completes with no errors.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js app with Tailwind and Vitest"
```

---

### Task 2: Prisma schema and client

**Files:**
- Create: `prisma/schema.prisma`
- Create: `src/lib/prisma.ts`
- Create: `.env` (local, gitignored) and update `.env.example`

**Interfaces:**
- Produces: `prisma` (default export, `PrismaClient` instance) from `src/lib/prisma.ts`, and generated Prisma types (`Role`, `TokenPurpose`, `User`, `Campus`, `Student`, etc.) from `@prisma/client`.

- [ ] **Step 1: Write the schema**

`prisma/schema.prisma`:
```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Role {
  ADMIN
  STAFF
  TEACHER
  STUDENT
  PARENT
}

enum TokenPurpose {
  EMAIL_VERIFY
  PASSWORD_RESET
}

model Campus {
  id        String   @id @default(cuid())
  name      String
  address   String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  staff    StaffCampus[]
  teachers TeacherCampus[]
  students Student[]
  groups   Group[]
}

model User {
  id              String    @id @default(cuid())
  email           String    @unique
  passwordHash    String
  name            String
  role            Role
  emailVerifiedAt DateTime?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  staffCampuses   StaffCampus[]
  teacherCampuses TeacherCampus[]
  student         Student?
  parentLinks     ParentStudent[]
  tokens          VerificationToken[]
  teachingGroups  Group[]              @relation("GroupTeacher")
}

model StaffCampus {
  id       String @id @default(cuid())
  userId   String
  campusId String
  user     User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  campus   Campus @relation(fields: [campusId], references: [id], onDelete: Cascade)

  @@unique([userId, campusId])
}

model TeacherCampus {
  id       String @id @default(cuid())
  userId   String
  campusId String
  user     User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  campus   Campus @relation(fields: [campusId], references: [id], onDelete: Cascade)

  @@unique([userId, campusId])
}

model Student {
  id        String   @id @default(cuid())
  userId    String   @unique
  campusId  String
  createdAt DateTime @default(now())
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  campus    Campus   @relation(fields: [campusId], references: [id])

  parentLinks ParentStudent[]
  enrollments Enrollment[]
}

model ParentStudent {
  id            String  @id @default(cuid())
  parentUserId  String
  studentId     String
  parent        User    @relation(fields: [parentUserId], references: [id], onDelete: Cascade)
  student       Student @relation(fields: [studentId], references: [id], onDelete: Cascade)

  @@unique([parentUserId, studentId])
}

model Level {
  id   String @id @default(cuid())
  code String @unique
  name String

  groups Group[]
}

model Group {
  id        String   @id @default(cuid())
  campusId  String
  levelId   String
  teacherId String
  name      String
  createdAt DateTime @default(now())

  campus      Campus       @relation(fields: [campusId], references: [id])
  level       Level        @relation(fields: [levelId], references: [id])
  teacher     User         @relation("GroupTeacher", fields: [teacherId], references: [id])
  enrollments Enrollment[]
}

model Enrollment {
  id         String   @id @default(cuid())
  studentId  String
  groupId    String
  enrolledAt DateTime @default(now())

  student Student @relation(fields: [studentId], references: [id], onDelete: Cascade)
  group   Group   @relation(fields: [groupId], references: [id], onDelete: Cascade)

  @@unique([studentId, groupId])
}

model VerificationToken {
  id        String       @id @default(cuid())
  userId    String
  token     String       @unique
  purpose   TokenPurpose
  expiresAt DateTime
  createdAt DateTime     @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

- [ ] **Step 2: Add env vars**

`.env.example` (append):
```
DATABASE_URL="postgresql://user:password@localhost:5432/bristol"
NEXTAUTH_SECRET="replace-with-openssl-rand-base64-32"
NEXTAUTH_URL="http://localhost:3000"
RESEND_API_KEY="replace-me"
EMAIL_FROM="Bristol <no-reply@bristol-ingles.com>"
```

Copy `.env.example` to `.env` and fill in a real local `DATABASE_URL` (or a Neon connection string).

- [ ] **Step 3: Create the Prisma client singleton**

`src/lib/prisma.ts`:
```ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
```

- [ ] **Step 4: Run the initial migration**

Run: `npx prisma migrate dev --name init`
Expected: migration applies cleanly against the local `DATABASE_URL`, `Prisma Client` regenerates.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add Prisma schema and client singleton"
```

---

### Task 3: Password hashing utility

**Files:**
- Create: `src/lib/password.ts`
- Test: `tests/lib/password.test.ts`

**Interfaces:**
- Produces: `hashPassword(plain: string): Promise<string>`, `verifyPassword(plain: string, hash: string): Promise<boolean>`

- [ ] **Step 1: Write the failing test**

`tests/lib/password.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/password";

describe("password", () => {
  it("hashes a password and verifies the correct plaintext", async () => {
    const hash = await hashPassword("correct-horse-battery-staple");
    expect(hash).not.toBe("correct-horse-battery-staple");
    expect(await verifyPassword("correct-horse-battery-staple", hash)).toBe(true);
  });

  it("rejects an incorrect plaintext", async () => {
    const hash = await hashPassword("correct-horse-battery-staple");
    expect(await verifyPassword("wrong-password", hash)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/lib/password.test.ts`
Expected: FAIL — `Cannot find module '@/lib/password'`

- [ ] **Step 3: Implement**

`src/lib/password.ts`:
```ts
import bcrypt from "bcryptjs";

const SALT_ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/lib/password.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/password.ts tests/lib/password.test.ts
git commit -m "feat: add password hashing utility"
```

---

### Task 4: Campus scope helper

**Files:**
- Create: `src/lib/campus-scope.ts`
- Test: `tests/lib/campus-scope.test.ts`

**Interfaces:**
- Consumes: `prisma` from `src/lib/prisma.ts` (mocked in tests), `Role` from `@prisma/client`.
- Produces:
  ```ts
  export type CampusScope =
    | { type: "ALL" }
    | { type: "CAMPUS_LIST"; campusIds: string[] }
    | { type: "SINGLE_CAMPUS"; campusId: string }
    | { type: "NONE" };

  export async function getCampusScope(user: { id: string; role: Role }): Promise<CampusScope>
  ```
  Later specs (Admin, Academic) call `getCampusScope(sessionUser)` to build Prisma `where` clauses filtered by campus.

- [ ] **Step 1: Write the failing tests**

`tests/lib/campus-scope.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    staffCampus: { findMany: vi.fn() },
    teacherCampus: { findMany: vi.fn() },
    student: { findUnique: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { getCampusScope } from "@/lib/campus-scope";

describe("getCampusScope", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns ALL for ADMIN", async () => {
    const scope = await getCampusScope({ id: "u1", role: "ADMIN" });
    expect(scope).toEqual({ type: "ALL" });
  });

  it("returns CAMPUS_LIST for STAFF from StaffCampus", async () => {
    (prisma.staffCampus.findMany as any).mockResolvedValue([
      { campusId: "c1" },
      { campusId: "c2" },
    ]);
    const scope = await getCampusScope({ id: "u2", role: "STAFF" });
    expect(scope).toEqual({ type: "CAMPUS_LIST", campusIds: ["c1", "c2"] });
  });

  it("returns CAMPUS_LIST for TEACHER from TeacherCampus", async () => {
    (prisma.teacherCampus.findMany as any).mockResolvedValue([{ campusId: "c3" }]);
    const scope = await getCampusScope({ id: "u3", role: "TEACHER" });
    expect(scope).toEqual({ type: "CAMPUS_LIST", campusIds: ["c3"] });
  });

  it("returns SINGLE_CAMPUS for STUDENT from Student.campusId", async () => {
    (prisma.student.findUnique as any).mockResolvedValue({ campusId: "c4" });
    const scope = await getCampusScope({ id: "u4", role: "STUDENT" });
    expect(scope).toEqual({ type: "SINGLE_CAMPUS", campusId: "c4" });
  });

  it("returns NONE for PARENT", async () => {
    const scope = await getCampusScope({ id: "u5", role: "PARENT" });
    expect(scope).toEqual({ type: "NONE" });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/lib/campus-scope.test.ts`
Expected: FAIL — `Cannot find module '@/lib/campus-scope'`

- [ ] **Step 3: Implement**

`src/lib/campus-scope.ts`:
```ts
import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";

export type CampusScope =
  | { type: "ALL" }
  | { type: "CAMPUS_LIST"; campusIds: string[] }
  | { type: "SINGLE_CAMPUS"; campusId: string }
  | { type: "NONE" };

export async function getCampusScope(user: { id: string; role: Role }): Promise<CampusScope> {
  switch (user.role) {
    case "ADMIN":
      return { type: "ALL" };

    case "STAFF": {
      const rows = await prisma.staffCampus.findMany({
        where: { userId: user.id },
        select: { campusId: true },
      });
      return { type: "CAMPUS_LIST", campusIds: rows.map((r) => r.campusId) };
    }

    case "TEACHER": {
      const rows = await prisma.teacherCampus.findMany({
        where: { userId: user.id },
        select: { campusId: true },
      });
      return { type: "CAMPUS_LIST", campusIds: rows.map((r) => r.campusId) };
    }

    case "STUDENT": {
      const student = await prisma.student.findUnique({
        where: { userId: user.id },
        select: { campusId: true },
      });
      if (!student) return { type: "CAMPUS_LIST", campusIds: [] };
      return { type: "SINGLE_CAMPUS", campusId: student.campusId };
    }

    case "PARENT":
    default:
      return { type: "NONE" };
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/lib/campus-scope.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/campus-scope.ts tests/lib/campus-scope.test.ts
git commit -m "feat: add campus scoping helper"
```

---

### Task 5: Verification/reset tokens

**Files:**
- Create: `src/lib/tokens.ts`
- Test: `tests/lib/tokens.test.ts`

**Interfaces:**
- Consumes: `prisma` (mocked in tests), `TokenPurpose` from `@prisma/client`.
- Produces:
  ```ts
  export async function createToken(userId: string, purpose: TokenPurpose, ttlMinutes: number): Promise<string>
  export async function consumeToken(token: string, purpose: TokenPurpose): Promise<{ userId: string } | null>
  ```
  Task 6 (auth) and Task 7 (email flows) both call these.

- [ ] **Step 1: Write the failing tests**

`tests/lib/tokens.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    verificationToken: {
      create: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import { createToken, consumeToken } from "@/lib/tokens";

describe("tokens", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a token record and returns the raw token", async () => {
    (prisma.verificationToken.create as any).mockResolvedValue({});
    const token = await createToken("user-1", "EMAIL_VERIFY", 60);
    expect(typeof token).toBe("string");
    expect(token.length).toBeGreaterThan(10);
    expect(prisma.verificationToken.create).toHaveBeenCalledOnce();
  });

  it("consumes a valid, unexpired token and deletes it", async () => {
    (prisma.verificationToken.findUnique as any).mockResolvedValue({
      id: "t1",
      userId: "user-1",
      purpose: "PASSWORD_RESET",
      expiresAt: new Date(Date.now() + 60_000),
    });
    (prisma.verificationToken.delete as any).mockResolvedValue({});

    const result = await consumeToken("raw-token", "PASSWORD_RESET");
    expect(result).toEqual({ userId: "user-1" });
    expect(prisma.verificationToken.delete).toHaveBeenCalledWith({ where: { id: "t1" } });
  });

  it("rejects an expired token", async () => {
    (prisma.verificationToken.findUnique as any).mockResolvedValue({
      id: "t2",
      userId: "user-1",
      purpose: "PASSWORD_RESET",
      expiresAt: new Date(Date.now() - 1_000),
    });

    const result = await consumeToken("raw-token", "PASSWORD_RESET");
    expect(result).toBeNull();
    expect(prisma.verificationToken.delete).toHaveBeenCalledWith({ where: { id: "t2" } });
  });

  it("rejects a token with the wrong purpose", async () => {
    (prisma.verificationToken.findUnique as any).mockResolvedValue({
      id: "t3",
      userId: "user-1",
      purpose: "EMAIL_VERIFY",
      expiresAt: new Date(Date.now() + 60_000),
    });

    const result = await consumeToken("raw-token", "PASSWORD_RESET");
    expect(result).toBeNull();
  });

  it("returns null for a token that does not exist", async () => {
    (prisma.verificationToken.findUnique as any).mockResolvedValue(null);
    const result = await consumeToken("missing", "EMAIL_VERIFY");
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/lib/tokens.test.ts`
Expected: FAIL — `Cannot find module '@/lib/tokens'`

- [ ] **Step 3: Implement**

`src/lib/tokens.ts`:
```ts
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import type { TokenPurpose } from "@prisma/client";

export async function createToken(
  userId: string,
  purpose: TokenPurpose,
  ttlMinutes: number
): Promise<string> {
  const token = crypto.randomBytes(32).toString("hex");
  await prisma.verificationToken.create({
    data: {
      userId,
      token,
      purpose,
      expiresAt: new Date(Date.now() + ttlMinutes * 60_000),
    },
  });
  return token;
}

export async function consumeToken(
  token: string,
  purpose: TokenPurpose
): Promise<{ userId: string } | null> {
  const record = await prisma.verificationToken.findUnique({ where: { token } });
  if (!record) return null;

  await prisma.verificationToken.delete({ where: { id: record.id } });

  if (record.purpose !== purpose) return null;
  if (record.expiresAt.getTime() < Date.now()) return null;

  return { userId: record.userId };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/lib/tokens.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/tokens.ts tests/lib/tokens.test.ts
git commit -m "feat: add verification/reset token helpers"
```

---

### Task 6: Email sending (Resend)

**Files:**
- Create: `src/lib/email.ts`

**Interfaces:**
- Produces:
  ```ts
  export async function sendVerificationEmail(to: string, token: string): Promise<void>
  export async function sendPasswordResetEmail(to: string, token: string): Promise<void>
  ```
  Consumed by the API routes in Task 8.

- [ ] **Step 1: Implement (no unit test — thin wrapper around a third-party network call; covered indirectly by the route tests in Task 8, which mock this module)**

`src/lib/email.ts`:
```ts
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.EMAIL_FROM ?? "Bristol <no-reply@bristol-ingles.com>";

function appUrl(path: string): string {
  const base = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  return `${base}${path}`;
}

export async function sendVerificationEmail(to: string, token: string): Promise<void> {
  const url = appUrl(`/verify-email?token=${token}`);
  await resend.emails.send({
    from: FROM,
    to,
    subject: "Verifica tu cuenta de Bristol",
    html: `<p>Confirma tu cuenta de Bristol dando clic <a href="${url}">aquí</a>.</p>`,
  });
}

export async function sendPasswordResetEmail(to: string, token: string): Promise<void> {
  const url = appUrl(`/reset-password?token=${token}`);
  await resend.emails.send({
    from: FROM,
    to,
    subject: "Restablece tu contraseña de Bristol",
    html: `<p>Restablece tu contraseña dando clic <a href="${url}">aquí</a>. Este enlace expira en 1 hora.</p>`,
  });
}
```

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/email.ts
git commit -m "feat: add Resend email helpers for verification and reset flows"
```

---

### Task 7: Auth.js configuration

**Files:**
- Create: `src/lib/auth.ts`
- Create: `src/app/api/auth/[...nextauth]/route.ts`
- Test: `tests/lib/auth.test.ts`

**Interfaces:**
- Consumes: `prisma`, `verifyPassword` from `src/lib/password.ts`.
- Produces: `handlers`, `auth`, `signIn`, `signOut` exported from `src/lib/auth.ts` (NextAuth v5 pattern); the exported `authorize` logic is what Task 7's tests exercise directly.

- [ ] **Step 1: Write the failing tests**

`tests/lib/auth.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { user: { findUnique: vi.fn() } },
}));
vi.mock("@/lib/password", () => ({
  verifyPassword: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { authorizeCredentials } from "@/lib/auth";

describe("authorizeCredentials", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the user for valid, verified credentials", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({
      id: "u1",
      email: "a@b.com",
      passwordHash: "hash",
      name: "Ana",
      role: "STUDENT",
      emailVerifiedAt: new Date(),
    });
    (verifyPassword as any).mockResolvedValue(true);

    const user = await authorizeCredentials({ email: "a@b.com", password: "secret" });
    expect(user).toEqual({ id: "u1", email: "a@b.com", name: "Ana", role: "STUDENT" });
  });

  it("returns null for a nonexistent user", async () => {
    (prisma.user.findUnique as any).mockResolvedValue(null);
    const user = await authorizeCredentials({ email: "missing@b.com", password: "secret" });
    expect(user).toBeNull();
  });

  it("returns null for an incorrect password", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({
      id: "u1",
      email: "a@b.com",
      passwordHash: "hash",
      name: "Ana",
      role: "STUDENT",
      emailVerifiedAt: new Date(),
    });
    (verifyPassword as any).mockResolvedValue(false);

    const user = await authorizeCredentials({ email: "a@b.com", password: "wrong" });
    expect(user).toBeNull();
  });

  it("returns null when the email is not verified", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({
      id: "u1",
      email: "a@b.com",
      passwordHash: "hash",
      name: "Ana",
      role: "STUDENT",
      emailVerifiedAt: null,
    });
    (verifyPassword as any).mockResolvedValue(true);

    const user = await authorizeCredentials({ email: "a@b.com", password: "secret" });
    expect(user).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/lib/auth.test.ts`
Expected: FAIL — `Cannot find module '@/lib/auth'`

- [ ] **Step 3: Implement**

`src/lib/auth.ts`:
```ts
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import type { Role } from "@prisma/client";

export type AuthorizedUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
};

export async function authorizeCredentials(credentials: {
  email: string;
  password: string;
}): Promise<AuthorizedUser | null> {
  const user = await prisma.user.findUnique({ where: { email: credentials.email } });
  if (!user) return null;
  if (!user.emailVerifiedAt) return null;

  const valid = await verifyPassword(credentials.password, user.passwordHash);
  if (!valid) return null;

  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (raw) => {
        const email = raw?.email as string | undefined;
        const password = raw?.password as string | undefined;
        if (!email || !password) return null;
        return authorizeCredentials({ email, password });
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = (user as AuthorizedUser).id;
        token.role = (user as AuthorizedUser).role;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        (session.user as { id?: string; role?: Role }).id = token.id as string;
        (session.user as { id?: string; role?: Role }).role = token.role as Role;
      }
      return session;
    },
  },
});
```

- [ ] **Step 4: Wire the API route**

`src/app/api/auth/[...nextauth]/route.ts`:
```ts
import { handlers } from "@/lib/auth";

export const { GET, POST } = handlers;
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- tests/lib/auth.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 6: Commit**

```bash
git add src/lib/auth.ts src/app/api/auth tests/lib/auth.test.ts
git commit -m "feat: configure Auth.js credentials provider with JWT sessions"
```

---

### Task 8: Forgot/reset password and email verification API routes

**Files:**
- Create: `src/app/api/auth/forgot-password/route.ts`
- Create: `src/app/api/auth/reset-password/route.ts`
- Create: `src/app/api/auth/verify-email/route.ts`
- Test: `tests/api/forgot-reset-password.test.ts`
- Test: `tests/api/verify-email.test.ts`

**Interfaces:**
- Consumes: `prisma`, `createToken`/`consumeToken` from `src/lib/tokens.ts`, `sendPasswordResetEmail` from `src/lib/email.ts`, `hashPassword` from `src/lib/password.ts`.
- Produces: `POST /api/auth/forgot-password` (body `{ email }`, always 200), `POST /api/auth/reset-password` (body `{ token, password }`, 200 or 400), `POST /api/auth/verify-email` (body `{ token }`, 200 or 400). Spec 2's future "create user" flow will call `createToken(userId, "EMAIL_VERIFY", ...)` + `sendVerificationEmail` and link here — that wiring is out of scope for Foundation since there's no user-creation UI yet, but the consuming endpoint must exist and be tested now so the round-trip is provable.

- [ ] **Step 1: Write the failing tests**

`tests/api/forgot-reset-password.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn(), update: vi.fn() },
  },
}));
vi.mock("@/lib/tokens", () => ({
  createToken: vi.fn(),
  consumeToken: vi.fn(),
}));
vi.mock("@/lib/email", () => ({
  sendPasswordResetEmail: vi.fn(),
}));
vi.mock("@/lib/password", () => ({
  hashPassword: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { createToken, consumeToken } from "@/lib/tokens";
import { sendPasswordResetEmail } from "@/lib/email";
import { hashPassword } from "@/lib/password";
import { POST as forgotPassword } from "@/app/api/auth/forgot-password/route";
import { POST as resetPassword } from "@/app/api/auth/reset-password/route";

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("forgot-password", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sends a reset email for an existing user", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({ id: "u1", email: "a@b.com" });
    (createToken as any).mockResolvedValue("raw-token");

    const res = await forgotPassword(jsonRequest({ email: "a@b.com" }));
    expect(res.status).toBe(200);
    expect(sendPasswordResetEmail).toHaveBeenCalledWith("a@b.com", "raw-token");
  });

  it("returns 200 without sending email for a nonexistent user (no account enumeration)", async () => {
    (prisma.user.findUnique as any).mockResolvedValue(null);

    const res = await forgotPassword(jsonRequest({ email: "missing@b.com" }));
    expect(res.status).toBe(200);
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
  });
});

describe("reset-password", () => {
  beforeEach(() => vi.clearAllMocks());

  it("updates the password for a valid token", async () => {
    (consumeToken as any).mockResolvedValue({ userId: "u1" });
    (hashPassword as any).mockResolvedValue("new-hash");

    const res = await resetPassword(jsonRequest({ token: "valid", password: "new-secret" }));
    expect(res.status).toBe(200);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { passwordHash: "new-hash" },
    });
  });

  it("returns 400 for an invalid or expired token", async () => {
    (consumeToken as any).mockResolvedValue(null);

    const res = await resetPassword(jsonRequest({ token: "bad", password: "new-secret" }));
    expect(res.status).toBe(400);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/api/forgot-reset-password.test.ts`
Expected: FAIL — routes don't exist yet.

- [ ] **Step 3: Implement forgot-password route**

`src/app/api/auth/forgot-password/route.ts`:
```ts
import { prisma } from "@/lib/prisma";
import { createToken } from "@/lib/tokens";
import { sendPasswordResetEmail } from "@/lib/email";

export async function POST(request: Request) {
  const { email } = (await request.json()) as { email: string };

  const user = await prisma.user.findUnique({ where: { email } });
  if (user) {
    const token = await createToken(user.id, "PASSWORD_RESET", 60);
    await sendPasswordResetEmail(user.email, token);
  }

  return Response.json({ ok: true });
}
```

- [ ] **Step 4: Implement reset-password route**

`src/app/api/auth/reset-password/route.ts`:
```ts
import { prisma } from "@/lib/prisma";
import { consumeToken } from "@/lib/tokens";
import { hashPassword } from "@/lib/password";

export async function POST(request: Request) {
  const { token, password } = (await request.json()) as { token: string; password: string };

  const consumed = await consumeToken(token, "PASSWORD_RESET");
  if (!consumed) {
    return Response.json({ error: "Token inválido o expirado" }, { status: 400 });
  }

  const passwordHash = await hashPassword(password);
  await prisma.user.update({ where: { id: consumed.userId }, data: { passwordHash } });

  return Response.json({ ok: true });
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- tests/api/forgot-reset-password.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 6: Write the failing test for email verification**

`tests/api/verify-email.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { user: { update: vi.fn() } },
}));
vi.mock("@/lib/tokens", () => ({
  consumeToken: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { consumeToken } from "@/lib/tokens";
import { POST as verifyEmail } from "@/app/api/auth/verify-email/route";

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/auth/verify-email", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("verify-email", () => {
  beforeEach(() => vi.clearAllMocks());

  it("marks the user verified for a valid token", async () => {
    (consumeToken as any).mockResolvedValue({ userId: "u1" });

    const res = await verifyEmail(jsonRequest({ token: "valid" }));
    expect(res.status).toBe(200);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { emailVerifiedAt: expect.any(Date) },
    });
  });

  it("returns 400 for an invalid or expired token", async () => {
    (consumeToken as any).mockResolvedValue(null);

    const res = await verifyEmail(jsonRequest({ token: "bad" }));
    expect(res.status).toBe(400);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 7: Run test to verify it fails**

Run: `npm test -- tests/api/verify-email.test.ts`
Expected: FAIL — route doesn't exist yet.

- [ ] **Step 8: Implement verify-email route**

`src/app/api/auth/verify-email/route.ts`:
```ts
import { prisma } from "@/lib/prisma";
import { consumeToken } from "@/lib/tokens";

export async function POST(request: Request) {
  const { token } = (await request.json()) as { token: string };

  const consumed = await consumeToken(token, "EMAIL_VERIFY");
  if (!consumed) {
    return Response.json({ error: "Token inválido o expirado" }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: consumed.userId },
    data: { emailVerifiedAt: new Date() },
  });

  return Response.json({ ok: true });
}
```

- [ ] **Step 9: Run all Task 8 tests to verify they pass**

Run: `npm test -- tests/api/forgot-reset-password.test.ts tests/api/verify-email.test.ts`
Expected: PASS (6 tests total)

- [ ] **Step 10: Commit**

```bash
git add src/app/api/auth tests/api/forgot-reset-password.test.ts tests/api/verify-email.test.ts
git commit -m "feat: add forgot/reset password and email verification API routes"
```

---

### Task 9: Role-based route guard (proxy)

**Files:**
- Create: `src/proxy.ts`

**Interfaces:**
- Consumes: `auth` from `src/lib/auth.ts`.
- Produces: redirects for `/admin/*` and `/portal/*` based on session role.

**Note:** Next.js 16 deprecated the `middleware.ts` file convention and renamed it to `proxy.ts` (function renamed from `middleware` to `proxy`); behavior and the `matcher` config are unchanged. See `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`. Use `proxy.ts`, not `middleware.ts`.

- [ ] **Step 1: Implement**

`src/proxy.ts`:
```ts
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

const ADMIN_ROLES = new Set(["ADMIN", "STAFF"]);
const PORTAL_ROLES = new Set(["TEACHER", "STUDENT", "PARENT"]);

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const role = req.auth?.user ? (req.auth.user as { role?: string }).role : undefined;

  if (!role) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname.startsWith("/admin") && !ADMIN_ROLES.has(role)) {
    return NextResponse.redirect(new URL("/portal", req.nextUrl.origin));
  }

  if (pathname.startsWith("/portal") && !PORTAL_ROLES.has(role)) {
    return NextResponse.redirect(new URL("/admin", req.nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/admin/:path*", "/portal/:path*"],
};
```

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/proxy.ts
git commit -m "feat: add role-based route protection proxy"
```

---

### Task 10: Design tokens and UI shell

**Files:**
- Modify: `src/app/globals.css`
- Create: `src/components/ui/button.tsx`, `src/components/ui/card.tsx`, `src/components/ui/input.tsx`, `src/components/ui/badge.tsx`, `src/components/ui/table.tsx`

**Interfaces:**
- Produces: React components `Button`, `Card`, `Input`, `Badge`, `Table` (and `TableRow`, `TableCell`, `TableHead`) consumed by Task 11's login page and by Specs 1–3.

**Note:** Tailwind CSS v4 (installed by the Task 1 scaffold) is CSS-first — there is no `tailwind.config.ts`. Design tokens are declared directly in an `@theme` block in `globals.css`; any `--color-*` variable declared there automatically generates matching utility classes (`bg-primary`, `text-primary`, `border-border`, etc.). Do not create a `tailwind.config.ts`.

- [ ] **Step 1: Add brand tokens**

`src/app/globals.css` — replace the existing `:root` / `@theme inline` block (currently just `--background`/`--foreground`) with:
```css
@import "tailwindcss";

:root {
  --color-primary: #2b2b7a;
  --color-primary-foreground: #ffffff;
  --color-accent: #e63329;
  --color-accent-foreground: #ffffff;
  --color-bg: #ffffff;
  --color-surface: #f5f5f7;
  --color-text: #1a1a1a;
  --color-border: #e2e2e6;
}

@theme inline {
  --color-primary: var(--color-primary);
  --color-primary-foreground: var(--color-primary-foreground);
  --color-accent: var(--color-accent);
  --color-accent-foreground: var(--color-accent-foreground);
  --color-surface: var(--color-surface);
  --color-border: var(--color-border);
}

body {
  background: var(--color-bg);
  color: var(--color-text);
}
```

This keeps the raw hex values in `:root` (the one-line change point for real brand assets later) and re-exposes them through `@theme inline` so Tailwind generates `bg-primary`, `text-primary`, `bg-accent`, `text-accent`, `bg-surface`, `border-border`, etc.

- [ ] **Step 2: Button component**

`src/components/ui/button.tsx`:
```tsx
import { ButtonHTMLAttributes, forwardRef } from "react";
import { clsx } from "clsx";

type Variant = "primary" | "accent" | "outline";

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }
>(({ className, variant = "primary", ...props }, ref) => (
  <button
    ref={ref}
    className={clsx(
      "inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50 disabled:pointer-events-none",
      variant === "primary" && "bg-primary text-primary-foreground hover:opacity-90",
      variant === "accent" && "bg-accent text-accent-foreground hover:opacity-90",
      variant === "outline" && "border border-border bg-transparent hover:bg-surface",
      className
    )}
    {...props}
  />
));
Button.displayName = "Button";
```

Run: `npm install clsx`

- [ ] **Step 3: Card, Input, Badge, Table components**

`src/components/ui/card.tsx`:
```tsx
import { HTMLAttributes } from "react";
import { clsx } from "clsx";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx("rounded-lg border border-border bg-white p-6 shadow-sm", className)}
      {...props}
    />
  );
}
```

`src/components/ui/input.tsx`:
```tsx
import { InputHTMLAttributes, forwardRef } from "react";
import { clsx } from "clsx";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={clsx(
        "w-full rounded-md border border-border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";
```

`src/components/ui/badge.tsx`:
```tsx
import { HTMLAttributes } from "react";
import { clsx } from "clsx";

type Tone = "primary" | "accent" | "neutral";

export function Badge({
  className,
  tone = "neutral",
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        tone === "primary" && "bg-primary/10 text-primary",
        tone === "accent" && "bg-accent/10 text-accent",
        tone === "neutral" && "bg-surface text-gray-700",
        className
      )}
      {...props}
    />
  );
}
```

`src/components/ui/table.tsx`:
```tsx
import { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from "react";
import { clsx } from "clsx";

export function Table(props: HTMLAttributes<HTMLTableElement>) {
  return (
    <table className="w-full border-collapse text-left text-sm" {...props} />
  );
}

export function TableHead(props: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={clsx("border-b border-border px-4 py-2 font-semibold text-gray-600", props.className)}
      {...props}
    />
  );
}

export function TableRow(props: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className="hover:bg-surface" {...props} />;
}

export function TableCell(props: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={clsx("border-b border-border px-4 py-2", props.className)} {...props} />;
}
```

- [ ] **Step 4: Verify it builds**

Run: `npm run build`
Expected: build succeeds with no errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/globals.css src/components/ui package.json package-lock.json
git commit -m "feat: add brand design tokens and base UI components"
```

---

### Task 11: Login, forgot-password, reset-password pages

**Files:**
- Create: `src/app/(public)/login/page.tsx`
- Create: `src/app/(public)/forgot-password/page.tsx`
- Create: `src/app/(public)/reset-password/page.tsx`

**Interfaces:**
- Consumes: `Button`, `Card`, `Input` from `src/components/ui`, `signIn` from `next-auth/react`.
- Produces: user-facing auth screens. No new automated tests in this task — form behavior is a thin wrapper over the already-tested `authorizeCredentials`/API routes; visual verification happens in Step 3 below.

- [ ] **Step 1: Login page**

`src/app/(public)/login/page.tsx`:
```tsx
"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("Correo o contraseña incorrectos, o cuenta no verificada.");
      return;
    }

    router.push(params.get("callbackUrl") ?? "/admin");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface px-4">
      <Card className="w-full max-w-sm">
        <h1 className="mb-6 text-xl font-bold text-primary">Bristol — Iniciar sesión</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            type="email"
            placeholder="Correo electrónico"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error && <p className="text-sm text-accent">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Entrando..." : "Entrar"}
          </Button>
        </form>
        <a href="/forgot-password" className="mt-4 block text-center text-sm text-primary">
          ¿Olvidaste tu contraseña?
        </a>
      </Card>
    </main>
  );
}
```

- [ ] **Step 2: Forgot/reset password pages**

`src/app/(public)/forgot-password/page.tsx`:
```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
      headers: { "Content-Type": "application/json" },
    });
    setSent(true);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface px-4">
      <Card className="w-full max-w-sm">
        <h1 className="mb-6 text-xl font-bold text-primary">Recuperar contraseña</h1>
        {sent ? (
          <p className="text-sm text-gray-700">
            Si el correo existe, te enviamos instrucciones para restablecer tu contraseña.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="email"
              placeholder="Correo electrónico"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Button type="submit" className="w-full">
              Enviar instrucciones
            </Button>
          </form>
        )}
      </Card>
    </main>
  );
}
```

`src/app/(public)/reset-password/page.tsx`:
```tsx
"use client";

import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function ResetPasswordPage() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, password }),
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) {
      setError("El enlace es inválido o expiró. Solicita uno nuevo.");
      return;
    }
    router.push("/login");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface px-4">
      <Card className="w-full max-w-sm">
        <h1 className="mb-6 text-xl font-bold text-primary">Nueva contraseña</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            type="password"
            placeholder="Nueva contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
          />
          {error && <p className="text-sm text-accent">{error}</p>}
          <Button type="submit" className="w-full">
            Restablecer contraseña
          </Button>
        </form>
      </Card>
    </main>
  );
}
```

- [ ] **Step 3: Verify it builds**

Run: `npm run build`
Expected: build succeeds with no errors.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(public)"
git commit -m "feat: add login, forgot-password, and reset-password pages"
```

---

### Task 12: Route shells and placeholder dashboards

**Note:** These are plain `src/app/admin/` and `src/app/portal/` directories, NOT parenthesized route groups like `src/app/(public)/` from Task 11. A Next.js route group (`(name)`) is purely organizational and does not add a URL segment — `src/app/(admin)/page.tsx` would resolve to `/`, not `/admin`, colliding with other root pages and never matching `proxy.ts`'s `/admin/:path*` matcher. `(public)` works in Task 11 because every page inside it has its own real segment (`login`, `forgot-password`, `reset-password`); `admin`/`portal` need to BE the segment, so they must be real folder names.

**Files:**
- Create: `src/app/admin/layout.tsx`, `src/app/admin/page.tsx`
- Create: `src/app/portal/layout.tsx`, `src/app/portal/page.tsx`

**Interfaces:**
- Consumes: `auth` from `src/lib/auth.ts` (for reading the session server-side to display the user's name/role).
- Produces: the landing spots that Spec 2 and Spec 3 will build out; the proxy (Task 9) already guards these paths.

- [ ] **Step 1: Admin shell**

`src/app/admin/layout.tsx`:
```tsx
import { auth } from "@/lib/auth";
import { signOut } from "@/lib/auth";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  return (
    <div className="min-h-screen bg-surface">
      <header className="flex items-center justify-between border-b border-border bg-white px-6 py-4">
        <span className="font-bold text-primary">Bristol Admin</span>
        <div className="flex items-center gap-4 text-sm">
          <span>{session?.user?.name}</span>
          <form
            action={async () => {
              "use server";
              await signOut();
            }}
          >
            <button className="text-accent">Salir</button>
          </form>
        </div>
      </header>
      <main className="p-6">{children}</main>
    </div>
  );
}
```

`src/app/admin/page.tsx`:
```tsx
export default function AdminHomePage() {
  return (
    <div>
      <h1 className="text-lg font-semibold">Panel administrativo</h1>
      <p className="text-sm text-gray-600">
        Cobranzas, admisiones, reinscripciones y comunicaciones se agregarán en Spec 2.
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Portal shell**

`src/app/portal/layout.tsx`:
```tsx
import { auth } from "@/lib/auth";
import { signOut } from "@/lib/auth";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  return (
    <div className="min-h-screen bg-surface">
      <header className="flex items-center justify-between border-b border-border bg-white px-6 py-4">
        <span className="font-bold text-primary">Bristol</span>
        <div className="flex items-center gap-4 text-sm">
          <span>{session?.user?.name}</span>
          <form
            action={async () => {
              "use server";
              await signOut();
            }}
          >
            <button className="text-accent">Salir</button>
          </form>
        </div>
      </header>
      <main className="p-6">{children}</main>
    </div>
  );
}
```

`src/app/portal/page.tsx`:
```tsx
export default function PortalHomePage() {
  return (
    <div>
      <h1 className="text-lg font-semibold">Mi portal</h1>
      <p className="text-sm text-gray-600">
        Horarios, material de clase y calificaciones se agregarán en Spec 3.
      </p>
    </div>
  );
}
```

- [ ] **Step 3: Verify it builds**

Run: `npm run build`
Expected: build succeeds with no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/admin src/app/portal
git commit -m "feat: add admin and portal route group shells"
```

---

### Task 13: Seed script

**Files:**
- Create: `prisma/seed.ts`

**Interfaces:**
- Consumes: `prisma`, `hashPassword`.
- Produces: reproducible local test data — 2 campuses, 1 admin, 2 staff (one per campus), 1 teacher covering both campuses, all 6 CEFR levels, a few groups/students/parents/enrollments (6 user accounts total, covering all 5 roles) — used for manual QA now and by Spec 2/3 development later.

- [ ] **Step 1: Implement**

`prisma/seed.ts`:
```ts
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/password";

const prisma = new PrismaClient();

async function main() {
  const [campusNorte, campusSur] = await Promise.all([
    prisma.campus.create({ data: { name: "Bristol Norte", address: "Av. Principal 100" } }),
    prisma.campus.create({ data: { name: "Bristol Sur", address: "Av. Secundaria 200" } }),
  ]);

  const levels = await Promise.all(
    [
      ["A1", "Principiante"],
      ["A2", "Elemental"],
      ["B1", "Intermedio"],
      ["B2", "Intermedio alto"],
      ["C1", "Avanzado"],
      ["C2", "Dominio"],
    ].map(([code, name]) => prisma.level.create({ data: { code, name } }))
  );

  const passwordHash = await hashPassword("Bristol123!");

  const admin = await prisma.user.create({
    data: {
      email: "admin@bristol-ingles.com",
      name: "Admin Bristol",
      role: "ADMIN",
      passwordHash,
      emailVerifiedAt: new Date(),
    },
  });

  const staffNorte = await prisma.user.create({
    data: {
      email: "staff.norte@bristol-ingles.com",
      name: "Staff Norte",
      role: "STAFF",
      passwordHash,
      emailVerifiedAt: new Date(),
      staffCampuses: { create: { campusId: campusNorte.id } },
    },
  });

  const staffSur = await prisma.user.create({
    data: {
      email: "staff.sur@bristol-ingles.com",
      name: "Staff Sur",
      role: "STAFF",
      passwordHash,
      emailVerifiedAt: new Date(),
      staffCampuses: { create: { campusId: campusSur.id } },
    },
  });

  const teacherBoth = await prisma.user.create({
    data: {
      email: "profesor.itinerante@bristol-ingles.com",
      name: "Profesor Itinerante",
      role: "TEACHER",
      passwordHash,
      emailVerifiedAt: new Date(),
      teacherCampuses: {
        create: [{ campusId: campusNorte.id }, { campusId: campusSur.id }],
      },
    },
  });

  const groupA1Norte = await prisma.group.create({
    data: {
      name: "A1 Matutino",
      campusId: campusNorte.id,
      levelId: levels[0].id,
      teacherId: teacherBoth.id,
    },
  });

  const studentUser = await prisma.user.create({
    data: {
      email: "alumno.demo@bristol-ingles.com",
      name: "Alumno Demo",
      role: "STUDENT",
      passwordHash,
      emailVerifiedAt: new Date(),
      student: { create: { campusId: campusNorte.id } },
    },
    include: { student: true },
  });

  await prisma.enrollment.create({
    data: { studentId: studentUser.student!.id, groupId: groupA1Norte.id },
  });

  const parentUser = await prisma.user.create({
    data: {
      email: "padre.demo@bristol-ingles.com",
      name: "Padre Demo",
      role: "PARENT",
      passwordHash,
      emailVerifiedAt: new Date(),
      parentLinks: { create: { studentId: studentUser.student!.id } },
    },
  });

  console.log({
    admin: admin.email,
    staffNorte: staffNorte.email,
    staffSur: staffSur.email,
    teacherBoth: teacherBoth.email,
    student: studentUser.email,
    parent: parentUser.email,
    password: "Bristol123! (para todos los usuarios de seed)",
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
```

- [ ] **Step 2: Run the seed**

Run: `npm run db:seed`
Expected: script completes, prints the 6 seeded accounts and shared password.

- [ ] **Step 3: Manually verify login**

Run: `npm run dev`, open `http://localhost:3000/login`, sign in as `admin@bristol-ingles.com` / `Bristol123!`.
Expected: redirected to `/admin` and see "Panel administrativo" with the admin's name in the header.

- [ ] **Step 4: Commit**

```bash
git add prisma/seed.ts
git commit -m "feat: add seed script with sample campuses, roles, and enrollments"
```

---

### Task 14: Example scoped endpoint

**Files:**
- Create: `src/app/api/students/route.ts`
- Test: `tests/api/students.test.ts`

**Interfaces:**
- Consumes: `auth` from `src/lib/auth.ts`, `getCampusScope` from `src/lib/campus-scope.ts`, `prisma`.
- Produces: `GET /api/students` — returns students filtered by the caller's campus scope. This is the reference implementation Spec 2 and Spec 3 copy for their own scoped list endpoints.

- [ ] **Step 1: Write the failing tests**

`tests/api/students.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/campus-scope", () => ({ getCampusScope: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { student: { findMany: vi.fn() } },
}));

import { auth } from "@/lib/auth";
import { getCampusScope } from "@/lib/campus-scope";
import { prisma } from "@/lib/prisma";
import { GET } from "@/app/api/students/route";

describe("GET /api/students", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when there is no session", async () => {
    (auth as any).mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("queries all students for ADMIN scope", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1", role: "ADMIN" } });
    (getCampusScope as any).mockResolvedValue({ type: "ALL" });
    (prisma.student.findMany as any).mockResolvedValue([{ id: "s1" }]);

    const res = await GET();
    expect(prisma.student.findMany).toHaveBeenCalledWith({ where: {} });
    expect(res.status).toBe(200);
  });

  it("filters by campusIds for CAMPUS_LIST scope", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u2", role: "STAFF" } });
    (getCampusScope as any).mockResolvedValue({ type: "CAMPUS_LIST", campusIds: ["c1", "c2"] });
    (prisma.student.findMany as any).mockResolvedValue([]);

    await GET();
    expect(prisma.student.findMany).toHaveBeenCalledWith({
      where: { campusId: { in: ["c1", "c2"] } },
    });
  });

  it("filters by a single campusId for SINGLE_CAMPUS scope", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u3", role: "STUDENT" } });
    (getCampusScope as any).mockResolvedValue({ type: "SINGLE_CAMPUS", campusId: "c1" });
    (prisma.student.findMany as any).mockResolvedValue([]);

    await GET();
    expect(prisma.student.findMany).toHaveBeenCalledWith({ where: { campusId: "c1" } });
  });

  it("returns an empty list for NONE scope without querying", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u4", role: "PARENT" } });
    (getCampusScope as any).mockResolvedValue({ type: "NONE" });

    const res = await GET();
    const body = await res.json();
    expect(body).toEqual([]);
    expect(prisma.student.findMany).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/api/students.test.ts`
Expected: FAIL — route doesn't exist yet.

- [ ] **Step 3: Implement**

`src/app/api/students/route.ts`:
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

  const scope = await getCampusScope(session.user as { id: string; role: any });

  if (scope.type === "NONE") {
    return Response.json([]);
  }

  const where: Prisma.StudentWhereInput =
    scope.type === "ALL"
      ? {}
      : scope.type === "CAMPUS_LIST"
        ? { campusId: { in: scope.campusIds } }
        : { campusId: scope.campusId };

  const students = await prisma.student.findMany({ where });
  return Response.json(students);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/api/students.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Full verification pass**

Run: `npm test && npx tsc --noEmit && npm run build`
Expected: all tests pass, no type errors, build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/students tests/api/students.test.ts
git commit -m "feat: add campus-scoped students endpoint as reference implementation"
```

---

## Post-plan checklist

- [ ] `npm test` — all suites pass
- [ ] `npx tsc --noEmit` — no type errors
- [ ] `npm run build` — production build succeeds
- [ ] Manual smoke test: seed the DB, log in as each of the 5 seeded roles, confirm `/admin` vs `/portal` redirect behavior matches their role
- [ ] Push branch and open a PR against `main` for review before merging (per repo convention — confirm with user first since this is the initial history of a fresh repo)
