-- CreateEnum
CREATE TYPE "CashRegisterSessionStatus" AS ENUM ('ABIERTA', 'CERRADA');

-- AlterTable
ALTER TABLE "CashMovement" ADD COLUMN     "cantidad" INTEGER,
ADD COLUMN     "cashRegisterSessionId" TEXT,
ADD COLUMN     "recursoMaterialId" TEXT;

-- AlterTable
ALTER TABLE "RecursoMaterial" ADD COLUMN     "stockMinimo" INTEGER NOT NULL DEFAULT 5;

-- CreateTable
CREATE TABLE "CashRegisterSession" (
    "id" TEXT NOT NULL,
    "campusId" TEXT NOT NULL,
    "openedById" TEXT NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "openingCents" INTEGER NOT NULL,
    "closedById" TEXT,
    "closedAt" TIMESTAMP(3),
    "closingCountedCents" INTEGER,
    "status" "CashRegisterSessionStatus" NOT NULL DEFAULT 'ABIERTA',

    CONSTRAINT "CashRegisterSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CashRegisterSession_campusId_status_idx" ON "CashRegisterSession"("campusId", "status");

-- AddForeignKey
ALTER TABLE "CashRegisterSession" ADD CONSTRAINT "CashRegisterSession_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "Campus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashRegisterSession" ADD CONSTRAINT "CashRegisterSession_openedById_fkey" FOREIGN KEY ("openedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashRegisterSession" ADD CONSTRAINT "CashRegisterSession_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_recursoMaterialId_fkey" FOREIGN KEY ("recursoMaterialId") REFERENCES "RecursoMaterial"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_cashRegisterSessionId_fkey" FOREIGN KEY ("cashRegisterSessionId") REFERENCES "CashRegisterSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

