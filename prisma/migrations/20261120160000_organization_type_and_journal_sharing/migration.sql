-- CreateEnum
CREATE TYPE "OrganizationType" AS ENUM ('HOUSEHOLD', 'COLLECTIVE', 'COMMUNITY', 'CORPORATE');

-- CreateEnum
CREATE TYPE "JournalVisibility" AS ENUM ('PRIVATE', 'ORGANIZATION');

-- AlterTable
ALTER TABLE "journal_entry" ADD COLUMN     "sharedOrganizationId" TEXT,
ADD COLUMN     "visibility" "JournalVisibility" NOT NULL DEFAULT 'PRIVATE';

-- AlterTable
ALTER TABLE "organization" ADD COLUMN     "type" "OrganizationType" NOT NULL DEFAULT 'HOUSEHOLD';

-- CreateIndex
CREATE INDEX "journal_entry_sharedOrganizationId_idx" ON "journal_entry"("sharedOrganizationId");

-- AddForeignKey
ALTER TABLE "journal_entry" ADD CONSTRAINT "journal_entry_sharedOrganizationId_fkey" FOREIGN KEY ("sharedOrganizationId") REFERENCES "organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
