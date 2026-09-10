-- CreateEnum
CREATE TYPE "CashMovementType" AS ENUM ('ENTRADA', 'SALIDA');

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "reciboFiscalEnviado" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reciboFiscalEnviadoAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "RecursoMaterial" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "campusId" TEXT NOT NULL,
    "cantidadDisponible" INTEGER NOT NULL DEFAULT 0,
    "precioUnitarioCents" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecursoMaterial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashMovement" (
    "id" TEXT NOT NULL,
    "campusId" TEXT NOT NULL,
    "tipo" "CashMovementType" NOT NULL,
    "concepto" TEXT NOT NULL,
    "montoCents" INTEGER NOT NULL,
    "invoiceId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CashMovement_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "RecursoMaterial" ADD CONSTRAINT "RecursoMaterial_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "Campus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "Campus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

