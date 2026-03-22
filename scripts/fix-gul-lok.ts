// Script to fix "Gul" ingredient that should be "Gul lök"
// Run with: npx tsx scripts/fix-gul-lok.ts

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ DATABASE_URL is not set in your .env file');
  process.exit(1);
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool as ConstructorParameters<typeof PrismaPg>[0]);
const prisma = new PrismaClient({ adapter });

async function fixGulLok() {
  try {
    console.log('🔍 Finding "Gul" ingredient...\n');
    
    // Find the ingredient "Gul" in "Mejerifri zucchinilasagne"
    const recipe = await prisma.recipe.findFirst({
      where: {
        name: {
          contains: 'Mejerifri zucchinilasagne',
          mode: 'insensitive',
        },
      },
      include: {
        ingredients: {
          include: {
            alternatives: true,
          },
        },
      },
    });

    if (!recipe) {
      console.error('❌ Recipe not found');
      process.exit(1);
    }

    const gulIngredient = recipe.ingredients.find(
      (ing) => ing.name.toLowerCase() === 'gul'
    );

    if (!gulIngredient) {
      console.log('⚠️  "Gul" ingredient not found - may already be fixed');
      process.exit(0);
    }

    console.log(`✅ Found recipe: ${recipe.name}`);
    console.log(`🔧 Found ingredient to fix: "${gulIngredient.name}"`);
    console.log(`   Current alternative: "${gulIngredient.alternatives[0]?.name || 'none'}"`);

    // Update the ingredient name and alternative
    await prisma.$transaction(async (tx) => {
      // Update the main ingredient name
      await tx.ingredient.update({
        where: { id: gulIngredient.id },
        data: { name: 'Gul lök' },
      });

      // Update the alternative name if it exists
      if (gulIngredient.alternatives.length > 0) {
        await tx.ingredientAlternative.update({
          where: { id: gulIngredient.alternatives[0].id },
          data: { name: 'Röd lök' },
        });
      }
    });

    console.log('\n✅ Successfully fixed ingredient:');
    console.log(`   - Changed: "Gul" → "Gul lök"`);
    console.log(`   - Changed alternative: "röd lök" → "Röd lök"`);

    // Verify
    const updatedIngredient = await prisma.ingredient.findUnique({
      where: { id: gulIngredient.id },
      include: {
        alternatives: true,
      },
    });

    console.log('\n📋 Verification:');
    console.log(`   - Main ingredient: "${updatedIngredient?.name}"`);
    if (updatedIngredient?.alternatives.length) {
      console.log(`   - Alternative: "${updatedIngredient.alternatives[0].name}"`);
    }
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

fixGulLok();

