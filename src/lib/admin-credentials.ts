import 'dotenv/config';

import { hashPassword } from 'better-auth/crypto';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

export const DEFAULT_ADMIN_EMAIL = 'admin@healthhub.com';
export const DEFAULT_ADMIN_PASSWORD = 'Admin123!';
export const DEFAULT_ADMIN_NAME = 'Admin User';

export function resolveAdminEmail(): string {
  return process.env.ADMIN_EMAIL?.trim() || DEFAULT_ADMIN_EMAIL;
}

/** Password used by seed/repair. Empty or whitespace ADMIN_PASSWORD → documented default. */
export function resolveAdminPassword(options?: { useDefault?: boolean }): {
  password: string;
  source: string;
} {
  if (options?.useDefault) {
    return {
      password: DEFAULT_ADMIN_PASSWORD,
      source: 'default (Admin123!) via --use-default',
    };
  }

  const fromEnv = process.env.ADMIN_PASSWORD?.trim();
  if (fromEnv) {
    return { password: fromEnv, source: 'ADMIN_PASSWORD in .env' };
  }

  return {
    password: DEFAULT_ADMIN_PASSWORD,
    source: 'default (Admin123!) — set ADMIN_PASSWORD in .env to override',
  };
}

export function createSeedPrisma(): { prisma: PrismaClient; pool: Pool } {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set');
  }

  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool as ConstructorParameters<typeof PrismaPg>[0]);
  const prisma = new PrismaClient({ adapter });
  return { prisma, pool };
}

/**
 * Ensures the seeded admin user has a valid Better-Auth credential password hash.
 * Safe to re-run after sign-in failures or auth library upgrades.
 */
export async function repairAdminAuth(options?: { useDefault?: boolean }): Promise<{
  email: string;
  password: string;
  source: string;
}> {
  const email = resolveAdminEmail();
  const adminName = process.env.ADMIN_NAME?.trim() || DEFAULT_ADMIN_NAME;
  const { password, source } = resolveAdminPassword(options);
  const hashedPassword = await hashPassword(password);

  const { prisma, pool } = createSeedPrisma();

  try {
    const existingAdmin = await prisma.user.findUnique({ where: { email } });

    const adminUser =
      existingAdmin ??
      (await prisma.user.create({
        data: {
          name: adminName,
          email,
          emailVerified: true,
          role: 'superadmin',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      }));

    if (existingAdmin && existingAdmin.role !== 'superadmin') {
      await prisma.user.update({
        where: { id: adminUser.id },
        data: { role: 'superadmin', emailVerified: true },
      });
    }

    await prisma.account.deleteMany({
      where: { userId: adminUser.id, providerId: 'credential' },
    });

    await prisma.account.create({
      data: {
        id: `account_${adminUser.id}`,
        userId: adminUser.id,
        accountId: adminUser.id,
        providerId: 'credential',
        password: hashedPassword,
      },
    });

    return { email, password, source };
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}
