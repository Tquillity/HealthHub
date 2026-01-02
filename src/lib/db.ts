// src/lib/db.ts
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const createPrismaClient = () => {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('❌ DATABASE_URL is not defined in .env');
  }

  // Use standard 'pg' Pool - more stable for local Next.js dev
  const pool = new Pool({ 
    connectionString,
    max: 10, // Limit connections to prevent Neon exhaustion
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000, // Increased timeout for Neon connections
    statement_timeout: 30000, // 30 second statement timeout
  });

  const adapter = new PrismaPg(pool);

  console.log('🔌 [Prisma] Initializing client with standard PG adapter');

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
