-- CreateEnum
CREATE TYPE "StaffPosition" AS ENUM ('RECEPCION', 'CAJA', 'CONTROL_ESCOLAR', 'COMERCIAL', 'CALIDAD_CONTROL', 'DIRECCION_CAMPUS');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "staffPosition" "StaffPosition";
