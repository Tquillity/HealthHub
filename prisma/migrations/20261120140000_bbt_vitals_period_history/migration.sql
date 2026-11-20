-- AlterTable
ALTER TABLE "journal_entry" ADD COLUMN     "cervicalMucus" TEXT,
ADD COLUMN     "heartRateVariability" DOUBLE PRECISION,
ADD COLUMN     "restingHeartRate" INTEGER,
ADD COLUMN     "sleepQuality" INTEGER,
ADD COLUMN     "temperature" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "temperatureUnit" TEXT NOT NULL DEFAULT 'C',
ADD COLUMN     "trackVitals" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "period_start" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "period_start_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "period_start_userId_date_key" ON "period_start"("userId", "date");

-- AddForeignKey
ALTER TABLE "period_start" ADD CONSTRAINT "period_start_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: users who already set "Last period start date" get it as their first logged
-- period start, so per-cycle history (BBT analysis, cycle lengths) works for them at once.
-- Done here rather than lazily on first read: it runs once, inside the migration's
-- transaction, and keeps page loads free of writes. date_trunc keeps the UTC calendar
-- day, the same day the app shows for lastPeriodDate (lib/date-only).
INSERT INTO "period_start" ("id", "userId", "date", "createdAt")
SELECT gen_random_uuid()::text, u."id", date_trunc('day', u."lastPeriodDate"), CURRENT_TIMESTAMP
FROM "user" u
WHERE u."lastPeriodDate" IS NOT NULL
ON CONFLICT ("userId", "date") DO NOTHING;
