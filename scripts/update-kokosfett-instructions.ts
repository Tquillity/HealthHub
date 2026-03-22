// Script to update recipe instructions to mention melting coconut fat
// Run with: npx tsx scripts/update-kokosfett-instructions.ts

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

async function updateInstructions() {
  try {
    console.log('🔍 Finding recipe with kokosfett...\n');
    
    const recipe = await prisma.recipe.findFirst({
      where: {
        name: {
          contains: 'Chocolate Chip Cookies',
          mode: 'insensitive',
        },
      },
      include: {
        instructions: {
          orderBy: { stepNumber: 'asc' },
        },
      },
    });

    if (!recipe) {
      console.error('❌ Recipe not found');
      process.exit(1);
    }

    const step3 = recipe.instructions.find(inst => inst.stepNumber === 3);
    if (!step3) {
      console.error('❌ Step 3 not found');
      process.exit(1);
    }

    console.log(`✅ Found recipe: ${recipe.name}`);
    console.log(`📝 Current step 3: "${step3.text}"`);

    const newText = 'Smält kokosfettet (eller låt det bli mjukt vid rumstemperatur). Blanda i en bunke: nötmjöl, sötning, vanilj, smält/mjukt kokosfett och salt. Arbeta ihop till en deg.';

    await prisma.instruction.update({
      where: { id: step3.id },
      data: { text: newText },
    });

    console.log('\n✅ Successfully updated step 3:');
    console.log(`   New text: "${newText}"`);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

updateInstructions();

