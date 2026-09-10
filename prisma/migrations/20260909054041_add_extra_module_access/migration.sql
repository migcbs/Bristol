-- AlterTable
ALTER TABLE "User" ADD COLUMN     "extraModuleAccess" TEXT[] DEFAULT ARRAY[]::TEXT[];

