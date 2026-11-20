-- AlterTable
ALTER TABLE "recipe" ADD COLUMN     "activeTime" INTEGER,
ADD COLUMN     "batchEfficiency" TEXT,
ADD COLUMN     "passiveTime" INTEGER,
ADD COLUMN     "yieldAmount" DOUBLE PRECISION,
ADD COLUMN     "yieldUnit" TEXT;
