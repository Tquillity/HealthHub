-- Migration: Add IngredientAlternative and UserIngredientPreference tables
-- Run with: psql $DATABASE_URL -f prisma/migrations/add-ingredient-alternatives.sql

-- Create IngredientAlternative table
CREATE TABLE IF NOT EXISTS "ingredient_alternative" (
    "id" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ingredient_alternative_pkey" PRIMARY KEY ("id")
);

-- Create UserIngredientPreference table
CREATE TABLE IF NOT EXISTS "user_ingredient_preference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pattern" TEXT NOT NULL,
    "preferred" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_ingredient_preference_pkey" PRIMARY KEY ("id")
);

-- Create indexes
CREATE INDEX IF NOT EXISTS "ingredient_alternative_ingredientId_idx" ON "ingredient_alternative"("ingredientId");
CREATE INDEX IF NOT EXISTS "user_ingredient_preference_userId_idx" ON "user_ingredient_preference"("userId");

-- Create unique constraint for user preferences
CREATE UNIQUE INDEX IF NOT EXISTS "user_ingredient_preference_userId_pattern_key" ON "user_ingredient_preference"("userId", "pattern");

-- Add foreign key constraints
ALTER TABLE "ingredient_alternative" ADD CONSTRAINT "ingredient_alternative_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "ingredient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_ingredient_preference" ADD CONSTRAINT "user_ingredient_preference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

