-- Add isHhChefsVerified field to recipe table
ALTER TABLE "recipe" ADD COLUMN IF NOT EXISTS "isHhChefsVerified" BOOLEAN NOT NULL DEFAULT false;

-- Set all existing recipes to unverified
UPDATE "recipe" SET "isHhChefsVerified" = false WHERE "isHhChefsVerified" IS NULL;

