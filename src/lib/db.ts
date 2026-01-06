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
    connectionTimeoutMillis: 20000, // Increased timeout for Neon connections (20s)
    statement_timeout: 30000, // 30 second statement timeout
    // Add retry and error handling
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
  });

  // Handle pool errors gracefully
  pool.on('error', (err) => {
    console.error('❌ [Prisma Pool] Unexpected error on idle client:', err);
  });

  const adapter = new PrismaPg(pool);

  console.log('🔌 [Prisma] Initializing client with standard PG adapter');

  const client = new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

  // Add connection health check
  client.$connect().catch((err) => {
    console.error('❌ [Prisma] Failed to connect to database:', err.message);
    // Don't throw here - let individual queries handle errors
  });

  return client;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
