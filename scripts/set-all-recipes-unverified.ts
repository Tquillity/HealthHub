/**
 * Script to set all existing recipes to unverified (isHhChefsVerified = false)
 * Run this after adding the isHhChefsVerified field to ensure all recipes start as unverified
 */

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

async function setAllRecipesUnverified() {
  try {
    console.log('🔄 Setting all recipes to unverified...');
    
    const result = await prisma.recipe.updateMany({
      data: {
        isHhChefsVerified: false,
      },
    });
    
    console.log(`✅ Updated ${result.count} recipes to unverified`);
  } catch (error) {
    console.error('❌ Error setting recipes to unverified:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

setAllRecipesUnverified();

