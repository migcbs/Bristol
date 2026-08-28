import type { Prisma } from "@prisma/client";

type TxClient = Prisma.TransactionClient;

/**
 * Generates a race-safe matrícula of the form BRI-<year>-<00001>. Must be
 * called from within the same transaction that creates the Student row —
 * the find-max-then-create pattern only avoids collisions when both happen
 * atomically relative to other concurrent calls. If two callers ever do
 * race despite this, the unique constraint on Student.matricula will
 * reject the second insert with a P2002, which the caller must handle by
 * retrying (see Task 3's quick-create route for the retry loop).
 *
 * Derives the next sequence from the highest existing suffix for the
 * current year's prefix, NOT from a row count — a row count would
 * regenerate an already-used matrícula if any Student row for the year was
 * ever deleted (e.g. cascaded from a User delete).
 */
export async function generateMatricula(tx: TxClient, asOf: Date = new Date()): Promise<string> {
  const year = asOf.getFullYear();
  const prefix = `BRI-${year}-`;
  const existing = await tx.student.findMany({
    where: { matricula: { startsWith: prefix } },
    select: { matricula: true },
    orderBy: { matricula: "desc" },
    take: 1,
  });
  const lastSuffix = existing[0] ? parseInt(existing[0].matricula.slice(prefix.length), 10) : 0;
  const sequence = String(lastSuffix + 1).padStart(5, "0");
  return `${prefix}${sequence}`;
}
