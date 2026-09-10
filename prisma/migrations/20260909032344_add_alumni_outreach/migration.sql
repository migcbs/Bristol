-- CreateEnum
CREATE TYPE "AlumniOutreachType" AS ENUM ('LLAMADA', 'MENSAJE', 'VISITA', 'OTRO');

-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "interesadoEnVolver" BOOLEAN;

-- CreateTable
CREATE TABLE "AlumniOutreachLog" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "type" "AlumniOutreachType" NOT NULL,
    "note" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlumniOutreachLog_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "AlumniOutreachLog" ADD CONSTRAINT "AlumniOutreachLog_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlumniOutreachLog" ADD CONSTRAINT "AlumniOutreachLog_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

