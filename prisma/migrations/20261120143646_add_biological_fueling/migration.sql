-- AlterTable
ALTER TABLE "recipe" ADD COLUMN     "nutrientHighlights" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "phaseTags" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "alignMealsWithCycle" BOOLEAN NOT NULL DEFAULT true;
