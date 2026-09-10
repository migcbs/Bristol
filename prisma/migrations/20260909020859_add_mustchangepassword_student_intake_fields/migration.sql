-- CreateEnum
CREATE TYPE "Sexo" AS ENUM ('MASCULINO', 'FEMENINO');

-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "contactoEmergenciaNombre" TEXT,
ADD COLUMN     "contactoEmergenciaTelefono" TEXT,
ADD COLUMN     "domicilioCP" TEXT,
ADD COLUMN     "domicilioCalle" TEXT,
ADD COLUMN     "domicilioCiudad" TEXT,
ADD COLUMN     "domicilioColonia" TEXT,
ADD COLUMN     "domicilioNumero" TEXT,
ADD COLUMN     "sexo" "Sexo";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;

