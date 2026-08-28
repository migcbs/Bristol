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
