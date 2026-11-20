-- CreateEnum
CREATE TYPE "CycleShareLevel" AS ENUM ('NONE', 'PHASE', 'ENERGY', 'FULL');

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "supportMessage" TEXT;

-- CreateTable
CREATE TABLE "cycle_status_share" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "level" "CycleShareLevel" NOT NULL,
    "coversMembersJoinedBy" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cycle_status_share_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cycle_status_share_organizationId_idx" ON "cycle_status_share"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "cycle_status_share_userId_organizationId_key" ON "cycle_status_share"("userId", "organizationId");

-- AddForeignKey
ALTER TABLE "cycle_status_share" ADD CONSTRAINT "cycle_status_share_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cycle_status_share" ADD CONSTRAINT "cycle_status_share_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

