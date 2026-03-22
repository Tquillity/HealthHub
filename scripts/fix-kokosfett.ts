// Script to fix "Kokosfett (smält" ingredient name
// Run with: npx tsx scripts/fix-kokosfett.ts

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

async function fixKokosfett() {
  try {
    console.log('🔍 Finding corrupted "Kokosfett (smält" ingredient...\n');
    
    // Find the corrupted ingredient
    const ingredient = await prisma.ingredient.findFirst({
      where: {
        name: {
          contains: 'Kokosfett (smält',
        },
      },
      include: {
        recipe: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!ingredient) {
      console.log('⚠️  Corrupted ingredient not found - may already be fixed');
      process.exit(0);
    }

    console.log(`✅ Found recipe: ${ingredient.recipe.name}`);
    console.log(`🔧 Found ingredient to fix: "${ingredient.name}"`);

    // Update the ingredient name to remove the corrupted parenthetical
    await prisma.ingredient.update({
      where: { id: ingredient.id },
      data: { name: 'Kokosfett' },
    });

    console.log('\n✅ Successfully fixed ingredient:');
    console.log(`   - Changed: "Kokosfett (smält" → "Kokosfett"`);

    // Check if instructions mention melting
    const recipe = await prisma.recipe.findUnique({
      where: { id: ingredient.recipeId },
      include: {
        instructions: {
          orderBy: { stepNumber: 'asc' },
        },
      },
    });

    if (recipe) {
      const hasMeltingInstruction = recipe.instructions.some(inst => 
        inst.text.toLowerCase().includes('smält') || 
        inst.text.toLowerCase().includes('melt') ||
        inst.text.toLowerCase().includes('värm')
      );

      if (!hasMeltingInstruction) {
        console.log('\n⚠️  Recipe instructions do not explicitly mention melting the coconut fat.');
        console.log('   Consider adding a note about melting it before use.');
      } else {
        console.log('\n✅ Recipe instructions already mention melting.');
      }
    }

    // Verify
    const updatedIngredient = await prisma.ingredient.findUnique({
      where: { id: ingredient.id },
    });

    console.log('\n📋 Verification:');
    console.log(`   - Ingredient name: "${updatedIngredient?.name}"`);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

fixKokosfett();

