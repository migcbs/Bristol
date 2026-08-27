-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'CONTACTED', 'ENROLLED', 'LOST');

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "status" "LeadStatus" NOT NULL DEFAULT 'NEW';
