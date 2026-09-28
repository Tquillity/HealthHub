import 'dotenv/config';

import { hashPassword } from 'better-auth/crypto';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

export const DEFAULT_ADMIN_EMAIL = 'admin@healthhub.com';
export const DEFAULT_ADMIN_PASSWORD = 'Admin123!';
export const DEFAULT_ADMIN_NAME = 'Admin User';

const LOCAL_DB_HOSTS = new Set(['localhost', '127.0.0.1']);

export function resolveAdminEmail(): string {
  return process.env.ADMIN_EMAIL?.trim() || DEFAULT_ADMIN_EMAIL;
}

/**
 * Password used by seed/repair. Empty or whitespace ADMIN_PASSWORD → documented
 * default. The default is only accepted against a local DB (see
 * `checkAdminSeedTarget`). `source` never contains the password itself.
 */
export function resolveAdminPassword(options?: { useDefault?: boolean }): {
  password: string;
  source: string;
} {
  if (options?.useDefault) {
    return {
      password: DEFAULT_ADMIN_PASSWORD,
      source: 'documented default via --use-default (local DB only)',
    };
  }

  const fromEnv = process.env.ADMIN_PASSWORD?.trim();
  if (fromEnv) {
    return { password: fromEnv, source: 'ADMIN_PASSWORD in .env' };
  }

  return {
    password: DEFAULT_ADMIN_PASSWORD,
    source:
      'documented default (local DB only) — set ADMIN_PASSWORD in .env to override',
  };
}

export type AdminSeedTargetCheck =
  | { ok: true; isLocal: boolean }
  | { ok: false; error: string };

/** True when the DATABASE_URL host is localhost / 127.0.0.1. */
export function isLocalDatabaseUrl(databaseUrl: string): boolean {
  try {
    return LOCAL_DB_HOSTS.has(new URL(databaseUrl).hostname);
  } catch {
    return false;
  }
}

/**
 * Pure guard for seed / admin repair (AUTH-2 / DATA-9).
 * - Local DB (localhost / 127.0.0.1): always allowed.
 * - Anything else: requires ALLOW_PROD_SEED=1 AND a non-empty ADMIN_PASSWORD
 *   that is not the documented default, and `--use-default` is refused.
 */
export function checkAdminSeedTarget(input: {
  databaseUrl: string | undefined;
  allowProdSeed: string | undefined;
  adminPassword: string | undefined;
  useDefault?: boolean;
}): AdminSeedTargetCheck {
  if (!input.databaseUrl) {
    return { ok: false, error: 'DATABASE_URL is not set' };
  }

  if (isLocalDatabaseUrl(input.databaseUrl)) {
    return { ok: true, isLocal: true };
  }

  const password = input.adminPassword?.trim();
  if (input.allowProdSeed !== '1' || !password) {
    return {
      ok: false,
      error:
        'Refusing to seed a non-local database. Set ALLOW_PROD_SEED=1 and a non-empty ADMIN_PASSWORD to proceed.',
    };
  }

  if (input.useDefault || password === DEFAULT_ADMIN_PASSWORD) {
    return {
      ok: false,
      error:
        'The default admin password may only be used against a local database.',
    };
  }

  return { ok: true, isLocal: false };
}

/** Throws when the current env must not be seeded. */
export function assertAdminSeedTargetAllowed(options?: {
  useDefault?: boolean;
}): void {
  const check = checkAdminSeedTarget({
    databaseUrl: process.env.DATABASE_URL,
    allowProdSeed: process.env.ALLOW_PROD_SEED,
    adminPassword: process.env.ADMIN_PASSWORD,
    useDefault: options?.useDefault,
  });
  if (!check.ok) {
    throw new Error(check.error);
  }
}

/**
 * A pre-existing user may only be (re)configured as admin when it is the
 * seed's own admin record: already a superadmin, or carrying the credential
 * account id the seed/repair writes (`account_<userId>`).
 */
export function isSeedOwnedAdmin(
  user: { id: string; role: string | null },
  accountIds: readonly string[]
): boolean {
  return (
    user.role === 'superadmin' || accountIds.includes(`account_${user.id}`)
  );
}

export function createSeedPrisma(): { prisma: PrismaClient; pool: Pool } {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set');
  }

  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(
    pool as ConstructorParameters<typeof PrismaPg>[0]
  );
  const prisma = new PrismaClient({ adapter });
  return { prisma, pool };
}

/**
 * Creates the seed admin, or repairs the seed's own admin record (role +
 * credential hash). Refuses to touch any other pre-existing account.
 */
export async function ensureSeedAdmin(
  prisma: PrismaClient,
  input: { email: string; name: string; password: string }
): Promise<{ id: string; created: boolean }> {
  const hashedPassword = await hashPassword(input.password);

  const existing = await prisma.user.findUnique({
    where: { email: input.email },
    select: { id: true, role: true, accounts: { select: { id: true } } },
  });

  if (
    existing &&
    !isSeedOwnedAdmin(
      existing,
      existing.accounts.map((account) => account.id)
    )
  ) {
    throw new Error(
      `A non-admin user already exists with ${input.email}. Refusing to promote it; set ADMIN_EMAIL to a different address.`
    );
  }

  const adminUser =
    existing ??
    (await prisma.user.create({
      data: {
        name: input.name,
        email: input.email,
        emailVerified: true,
        role: 'superadmin',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }));

  if (existing && existing.role !== 'superadmin') {
    await prisma.user.update({
      where: { id: adminUser.id },
      data: { role: 'superadmin', emailVerified: true },
    });
  }

  /**
   * Force-replace credential accounts to avoid duplicates (Better-Auth may
   * read the "wrong" one if multiple exist).
   */
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

  return { id: adminUser.id, created: !existing };
}

/**
 * Ensures the seeded admin user has a valid Better-Auth credential password hash.
 * Safe to re-run after sign-in failures or auth library upgrades.
 */
export async function repairAdminAuth(options?: {
  useDefault?: boolean;
}): Promise<{ email: string; source: string }> {
  assertAdminSeedTargetAllowed(options);

  const email = resolveAdminEmail();
  const name = process.env.ADMIN_NAME?.trim() || DEFAULT_ADMIN_NAME;
  const { password, source } = resolveAdminPassword(options);

  const { prisma, pool } = createSeedPrisma();

  try {
    await ensureSeedAdmin(prisma, { email, name, password });
    return { email, source };
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}
