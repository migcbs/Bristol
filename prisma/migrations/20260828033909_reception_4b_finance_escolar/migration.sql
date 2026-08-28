-- CreateEnum
CREATE TYPE "GroupChangeRequestType" AS ENUM ('BAJA', 'CAMBIO_GRUPO');

-- CreateEnum
CREATE TYPE "GroupChangeRequestStatus" AS ENUM ('PENDIENTE', 'APROBADA', 'RECHAZADA');

-- AlterTable
ALTER TABLE "Group" ADD COLUMN     "cupoMaximo" INTEGER NOT NULL DEFAULT 20;

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "baseCents" INTEGER,
ADD COLUMN     "earlyPaymentDiscountCents" INTEGER,
ADD COLUMN     "scholarshipPercent" DECIMAL(5,2);

-- CreateTable
CREATE TABLE "BlockEvaluation" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "bloqueNumero" INTEGER NOT NULL,
    "notaListening" DECIMAL(4,2) NOT NULL,
    "notaSpeaking" DECIMAL(4,2) NOT NULL,
    "notaReading" DECIMAL(4,2) NOT NULL,
    "notaWriting" DECIMAL(4,2) NOT NULL,
    "notaGrammar" DECIMAL(4,2) NOT NULL,
    "promedioBloque" DECIMAL(4,2) NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BlockEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupChangeRequest" (
    "id" TEXT NOT NULL,
    "type" "GroupChangeRequestType" NOT NULL,
    "studentId" TEXT NOT NULL,
    "currentGroupId" TEXT NOT NULL,
    "requestedGroupId" TEXT,
    "reason" TEXT NOT NULL,
    "status" "GroupChangeRequestStatus" NOT NULL DEFAULT 'PENDIENTE',
    "requestedById" TEXT NOT NULL,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupChangeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BlockEvaluation_enrollmentId_bloqueNumero_key" ON "BlockEvaluation"("enrollmentId", "bloqueNumero");

-- AddForeignKey
ALTER TABLE "BlockEvaluation" ADD CONSTRAINT "BlockEvaluation_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlockEvaluation" ADD CONSTRAINT "BlockEvaluation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupChangeRequest" ADD CONSTRAINT "GroupChangeRequest_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupChangeRequest" ADD CONSTRAINT "GroupChangeRequest_currentGroupId_fkey" FOREIGN KEY ("currentGroupId") REFERENCES "Group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupChangeRequest" ADD CONSTRAINT "GroupChangeRequest_requestedGroupId_fkey" FOREIGN KEY ("requestedGroupId") REFERENCES "Group"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupChangeRequest" ADD CONSTRAINT "GroupChangeRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupChangeRequest" ADD CONSTRAINT "GroupChangeRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
