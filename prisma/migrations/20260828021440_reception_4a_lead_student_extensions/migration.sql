-- CreateEnum
CREATE TYPE "StudentStatus" AS ENUM ('ACTIVO', 'BAJA', 'GRADUADO');

-- CreateEnum
CREATE TYPE "InterestType" AS ENUM ('CURSO_REGULAR', 'TALLER_CONVERSACION', 'CERTIFICACION');

-- CreateEnum
CREATE TYPE "ReceptionLogType" AS ENUM ('LLAMADA', 'INCIDENCIA', 'NOTA');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "LeadSource" ADD VALUE 'PRESENCIAL_RECEPCION';
ALTER TYPE "LeadSource" ADD VALUE 'VOLANTEO';

-- AlterEnum
ALTER TYPE "LeadStatus" ADD VALUE 'PLACEMENT_SCHEDULED';

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "asesorAsignadoId" TEXT,
ADD COLUMN     "dateOfBirth" TIMESTAMP(3),
ADD COLUMN     "interestType" "InterestType",
ADD COLUMN     "notasBitacora" TEXT;

-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "codigoPostalFiscal" TEXT,
ADD COLUMN     "curp" TEXT,
ADD COLUMN     "emailContacto" TEXT,
ADD COLUMN     "entregaActa" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "entregaComprobante" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "entregaCurp" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "estatusAlumno" "StudentStatus" NOT NULL DEFAULT 'ACTIVO',
ADD COLUMN     "fechaNacimiento" TIMESTAMP(3),
ADD COLUMN     "matricula" TEXT NOT NULL,
ADD COLUMN     "razonSocial" TEXT,
ADD COLUMN     "regimenFiscal" TEXT,
ADD COLUMN     "rfc" TEXT,
ADD COLUMN     "telefonoFijo" TEXT,
ADD COLUMN     "telefonoMovil" TEXT,
ADD COLUMN     "usoCfdi" TEXT;

-- CreateTable
CREATE TABLE "PlacementAppointment" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "campusId" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlacementAppointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReceptionLogEntry" (
    "id" TEXT NOT NULL,
    "campusId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "type" "ReceptionLogType" NOT NULL,
    "note" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReceptionLogEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlacementAppointment_leadId_key" ON "PlacementAppointment"("leadId");

-- CreateIndex
CREATE UNIQUE INDEX "Student_matricula_key" ON "Student"("matricula");

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_asesorAsignadoId_fkey" FOREIGN KEY ("asesorAsignadoId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlacementAppointment" ADD CONSTRAINT "PlacementAppointment_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlacementAppointment" ADD CONSTRAINT "PlacementAppointment_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "Campus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceptionLogEntry" ADD CONSTRAINT "ReceptionLogEntry_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "Campus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceptionLogEntry" ADD CONSTRAINT "ReceptionLogEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
