-- AlterTable
ALTER TABLE "journal_entry" ADD COLUMN     "energyAfternoon" INTEGER,
ADD COLUMN     "energyEvening" INTEGER,
ADD COLUMN     "energyMorning" INTEGER;

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "enableCircadianInsights" BOOLEAN NOT NULL DEFAULT false;
