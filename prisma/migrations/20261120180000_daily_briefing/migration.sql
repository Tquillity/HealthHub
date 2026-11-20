-- AlterTable
ALTER TABLE "user" ADD COLUMN     "briefingDetail" TEXT NOT NULL DEFAULT 'brief',
ADD COLUMN     "briefingFrequency" TEXT NOT NULL DEFAULT 'daily',
ADD COLUMN     "briefingSources" TEXT[] DEFAULT ARRAY['journal', 'cycle', 'meals', 'vitals']::TEXT[];

-- CreateTable
CREATE TABLE "briefing_feedback" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "suggestionKey" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "briefing_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "briefing_feedback_userId_date_idx" ON "briefing_feedback"("userId", "date");

-- AddForeignKey
ALTER TABLE "briefing_feedback" ADD CONSTRAINT "briefing_feedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
