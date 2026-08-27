-- Drop the old constraint that blocked legitimate re-entry into a past group.
-- NOTE: the original constraint was created via `CREATE UNIQUE INDEX
-- "Enrollment_studentId_groupId_key" ON "Enrollment"("studentId", "groupId")`
-- (see prisma/migrations/20260826203110_init/migration.sql), i.e. a bare unique
-- index rather than a table CONSTRAINT, so it must be dropped with DROP INDEX
-- (ALTER TABLE ... DROP CONSTRAINT would fail against a bare index in Postgres).
DROP INDEX IF EXISTS "Enrollment_studentId_groupId_key";

-- Enforce at most one ACTIVE enrollment per student (completedAt IS NULL),
-- while allowing a student to have multiple historical (completed) enrollments
-- in the same group over time (e.g. repeating a level).
CREATE UNIQUE INDEX "Enrollment_one_active_per_student" ON "Enrollment"("studentId") WHERE "completedAt" IS NULL;
