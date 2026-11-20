-- CreateEnum
CREATE TYPE "CycleShareLevel" AS ENUM ('NONE', 'PHASE', 'ENERGY', 'FULL');

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "shareCycleLevel" "CycleShareLevel" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "shareCycleStatus" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "supportMessage" TEXT;
