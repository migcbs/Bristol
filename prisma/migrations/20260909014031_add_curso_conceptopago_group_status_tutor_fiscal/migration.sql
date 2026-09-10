-- CreateEnum
CREATE TYPE "GroupStatus" AS ENUM ('ABIERTO', 'EN_CURSO', 'CONCLUIDO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "StudentCategory" AS ENUM ('NINOS', 'ADOLESCENTES', 'ADULTOS');

-- AlterTable
ALTER TABLE "Group" ADD COLUMN     "codigoGrupo" TEXT,
ADD COLUMN     "cursoId" TEXT,
ADD COLUMN     "estatusGrupo" "GroupStatus" NOT NULL DEFAULT 'ABIERTO',
ADD COLUMN     "fechaFin" TIMESTAMP(3),
ADD COLUMN     "fechaInicio" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "conceptoPagoId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "codigoPostalFiscal" TEXT,
ADD COLUMN     "razonSocial" TEXT,
ADD COLUMN     "regimenFiscal" TEXT,
ADD COLUMN     "rfc" TEXT,
ADD COLUMN     "usoCfdi" TEXT;

-- CreateTable
CREATE TABLE "ConceptoPago" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "montoDefaultCents" INTEGER,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConceptoPago_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Curso" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "categoria" "StudentCategory" NOT NULL,
    "esCertificacion" BOOLEAN NOT NULL DEFAULT false,
    "levelId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Curso_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ConceptoPago_nombre_key" ON "ConceptoPago"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "Group_codigoGrupo_key" ON "Group"("codigoGrupo");

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_conceptoPagoId_fkey" FOREIGN KEY ("conceptoPagoId") REFERENCES "ConceptoPago"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Group" ADD CONSTRAINT "Group_cursoId_fkey" FOREIGN KEY ("cursoId") REFERENCES "Curso"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Curso" ADD CONSTRAINT "Curso_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES "Level"("id") ON DELETE SET NULL ON UPDATE CASCADE;

