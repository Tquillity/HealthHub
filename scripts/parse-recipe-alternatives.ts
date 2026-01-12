// Script to parse existing recipes and extract ingredient alternatives
// Run with: npx tsx scripts/parse-recipe-alternatives.ts

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { parseIngredientAlternatives, normalizePatternKey } from '../src/lib/ingredient-alternatives';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ DATABASE_URL is not set in your .env file');
  process.exit(1);
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function parseRecipeAlternatives() {
  try {
    console.log('🔍 Finding recipes with ingredient alternatives...\n');

    // Get all ingredients
    const ingredients = await prisma.ingredient.findMany({
      include: {
        recipe: {
          select: {
            name: true,
          },
        },
        alternatives: true,
      },
    });

    let processedCount = 0;
    let createdCount = 0;
    let skippedCount = 0;

    for (const ingredient of ingredients) {
      // Skip if already has alternatives stored
      if (ingredient.alternatives.length > 0) {
        skippedCount++;
        continue;
      }

      // Parse ingredient name for alternatives
      const parsed = parseIngredientAlternatives(ingredient.name);

      if (parsed.alternatives.length > 0) {
        console.log(`📝 Found: "${ingredient.name}"`);
        console.log(`   Recipe: ${ingredient.recipe.name}`);
        console.log(`   Main: "${parsed.name}"`);
        console.log(`   Alternatives: ${parsed.alternatives.join(', ')}`);

        // Create alternatives in database
        await prisma.ingredientAlternative.createMany({
          data: parsed.alternatives.map((alt, index) => ({
            ingredientId: ingredient.id,
            name: alt,
            order: index + 1,
          })),
        });

        // Update ingredient name to the main name (without alternatives)
        await prisma.ingredient.update({
          where: { id: ingredient.id },
          data: { name: parsed.name },
        });

        createdCount += parsed.alternatives.length;
        processedCount++;
        console.log(`   ✅ Created ${parsed.alternatives.length} alternative(s)\n`);
      }
    }

    console.log('\n📊 Summary:');
    console.log(`   Processed: ${processedCount} ingredients with alternatives`);
    console.log(`   Created: ${createdCount} alternative entries`);
    console.log(`   Skipped: ${skippedCount} ingredients (already processed or no alternatives)`);
    console.log('\n✅ Done!');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

parseRecipeAlternatives();

