-- CreateEnum
CREATE TYPE "PlacementAppointmentStatus" AS ENUM ('PROGRAMADA', 'REALIZADA', 'CANCELADA', 'NO_ASISTIO');

-- DropIndex
DROP INDEX "PlacementAppointment_leadId_key";

-- AlterTable
ALTER TABLE "PlacementAppointment" ADD COLUMN     "resultado" TEXT,
ADD COLUMN     "status" "PlacementAppointmentStatus" NOT NULL DEFAULT 'PROGRAMADA';

