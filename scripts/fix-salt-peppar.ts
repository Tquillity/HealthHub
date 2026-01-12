// Script to fix "Salt och peppar" ingredient in "Asiatisk marinad med krispig tofu och tempeh"
// Run with: npx tsx scripts/fix-salt-peppar.ts

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
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function fixRecipe() {
  try {
    console.log('🔍 Finding recipe...');
    
    const recipe = await prisma.recipe.findFirst({
      where: {
        name: {
          contains: 'Asiatisk marinad med krispig tofu och tempeh',
          mode: 'insensitive',
        },
      },
      include: {
        ingredients: true,
        instructions: true,
      },
    });

    if (!recipe) {
      console.error('❌ Recipe not found');
      process.exit(1);
    }

    console.log(`✅ Found recipe: ${recipe.name}`);

    // Find the "Salt och peppar" ingredient
    const saltPepparIngredient = recipe.ingredients.find(
      (ing) => ing.name.toLowerCase().includes('salt och peppar')
    );

    if (!saltPepparIngredient) {
      console.log('⚠️  "Salt och peppar" ingredient not found - may already be fixed');
      process.exit(0);
    }

    console.log(`🔧 Found ingredient to fix: "${saltPepparIngredient.name}"`);

    // Get all other ingredients
    const otherIngredients = recipe.ingredients.filter(
      (ing) => ing.id !== saltPepparIngredient.id
    );

    // Update recipe with split ingredients
    await prisma.$transaction(async (tx) => {
      // Delete the old "Salt och peppar" ingredient
      await tx.ingredient.delete({
        where: { id: saltPepparIngredient.id },
      });

      // Add two new ingredients: Salt and Peppar
      await tx.ingredient.createMany({
        data: [
          {
            recipeId: recipe.id,
            name: 'Salt',
            quantity: saltPepparIngredient.quantity,
            unit: saltPepparIngredient.unit,
            notes: saltPepparIngredient.notes,
          },
          {
            recipeId: recipe.id,
            name: 'Peppar',
            quantity: saltPepparIngredient.quantity,
            unit: saltPepparIngredient.unit,
            notes: saltPepparIngredient.notes,
          },
        ],
      });
    });

    console.log('✅ Successfully split "Salt och peppar" into "Salt" and "Peppar"');
    console.log(`   - Deleted: "${saltPepparIngredient.name}"`);
    console.log(`   - Created: "Salt" (${saltPepparIngredient.quantity} ${saltPepparIngredient.unit})`);
    console.log(`   - Created: "Peppar" (${saltPepparIngredient.quantity} ${saltPepparIngredient.unit})`);

    // Verify
    const updatedRecipe = await prisma.recipe.findUnique({
      where: { id: recipe.id },
      include: {
        ingredients: {
          where: {
            name: {
              in: ['Salt', 'Peppar'],
            },
          },
        },
      },
    });

    console.log('\n📋 Verification:');
    updatedRecipe?.ingredients.forEach((ing) => {
      console.log(`   - ${ing.name}: ${ing.quantity} ${ing.unit}`);
    });
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

fixRecipe();

