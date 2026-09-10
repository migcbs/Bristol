-- CreateEnum
CREATE TYPE "MaterialAccessStatus" AS ENUM ('PENDIENTE', 'APROBADA', 'RECHAZADA');

-- CreateTable
CREATE TABLE "MaterialCarpeta" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaterialCarpeta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialLibraryItem" (
    "id" TEXT NOT NULL,
    "carpetaId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "descripcion" TEXT,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaterialLibraryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialAccessRequest" (
    "id" TEXT NOT NULL,
    "carpetaId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "motivo" TEXT,
    "status" "MaterialAccessStatus" NOT NULL DEFAULT 'PENDIENTE',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaterialAccessRequest_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "MaterialCarpeta" ADD CONSTRAINT "MaterialCarpeta_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialLibraryItem" ADD CONSTRAINT "MaterialLibraryItem_carpetaId_fkey" FOREIGN KEY ("carpetaId") REFERENCES "MaterialCarpeta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialLibraryItem" ADD CONSTRAINT "MaterialLibraryItem_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialAccessRequest" ADD CONSTRAINT "MaterialAccessRequest_carpetaId_fkey" FOREIGN KEY ("carpetaId") REFERENCES "MaterialCarpeta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialAccessRequest" ADD CONSTRAINT "MaterialAccessRequest_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialAccessRequest" ADD CONSTRAINT "MaterialAccessRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

