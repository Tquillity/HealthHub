import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import {
  DEFAULT_ADMIN_PASSWORD,
  checkAdminSeedTarget,
  isLocalDatabaseUrl,
  isSeedOwnedAdmin,
  resolveAdminEmail,
  resolveAdminPassword,
} from '@/lib/admin-credentials';

describe('admin credentials', () => {
  const env = process.env;

  beforeEach(() => {
    process.env = { ...env };
  });

  afterEach(() => {
    process.env = env;
  });

  it('resolveAdminEmail uses default', () => {
    delete process.env.ADMIN_EMAIL;
    expect(resolveAdminEmail()).toBe('admin@healthhub.com');
  });

  it('resolveAdminPassword uses default when env unset', () => {
    delete process.env.ADMIN_PASSWORD;
    const { password, source } = resolveAdminPassword();
    expect(password).toBe(DEFAULT_ADMIN_PASSWORD);
    expect(source).toContain('default');
  });

  it('resolveAdminPassword uses ADMIN_PASSWORD when set', () => {
    process.env.ADMIN_PASSWORD = 'custom-secret';
    const { password, source } = resolveAdminPassword();
    expect(password).toBe('custom-secret');
    expect(source).toContain('.env');
  });

  it('resolveAdminPassword --useDefault ignores env', () => {
    process.env.ADMIN_PASSWORD = 'custom-secret';
    const { password } = resolveAdminPassword({ useDefault: true });
    expect(password).toBe(DEFAULT_ADMIN_PASSWORD);
  });
});

describe('checkAdminSeedTarget', () => {
  const local = 'postgresql://ci:ci@localhost:5432/ci?sslmode=disable';
  const loopback = 'postgresql://ci:ci@127.0.0.1:5432/ci';
  const remote = 'postgresql://u:p@ep-cool-name.eu-central-1.aws.neon.tech/db';

  it('refuses when DATABASE_URL is missing', () => {
    expect(
      checkAdminSeedTarget({
        databaseUrl: undefined,
        allowProdSeed: undefined,
        adminPassword: undefined,
      }).ok
    ).toBe(false);
  });

  it('allows localhost and 127.0.0.1 with the default password', () => {
    for (const databaseUrl of [local, loopback]) {
      expect(
        checkAdminSeedTarget({
          databaseUrl,
          allowProdSeed: undefined,
          adminPassword: undefined,
          useDefault: true,
        })
      ).toEqual({ ok: true, isLocal: true });
    }
  });

  it('refuses a remote DB without ALLOW_PROD_SEED', () => {
    const result = checkAdminSeedTarget({
      databaseUrl: remote,
      allowProdSeed: undefined,
      adminPassword: 'strong-secret',
    });
    expect(result.ok).toBe(false);
  });

  it('refuses a remote DB without ADMIN_PASSWORD', () => {
    for (const adminPassword of [undefined, '', '   ']) {
      expect(
        checkAdminSeedTarget({
          databaseUrl: remote,
          allowProdSeed: '1',
          adminPassword,
        }).ok
      ).toBe(false);
    }
  });

  it('refuses the default password against a remote DB', () => {
    expect(
      checkAdminSeedTarget({
        databaseUrl: remote,
        allowProdSeed: '1',
        adminPassword: DEFAULT_ADMIN_PASSWORD,
      }).ok
    ).toBe(false);
    expect(
      checkAdminSeedTarget({
        databaseUrl: remote,
        allowProdSeed: '1',
        adminPassword: 'strong-secret',
        useDefault: true,
      }).ok
    ).toBe(false);
  });

  it('allows a remote DB with ALLOW_PROD_SEED=1 and a custom password', () => {
    expect(
      checkAdminSeedTarget({
        databaseUrl: remote,
        allowProdSeed: '1',
        adminPassword: 'strong-secret',
      })
    ).toEqual({ ok: true, isLocal: false });
  });

  it('does not treat look-alike hosts as local', () => {
    expect(isLocalDatabaseUrl('postgresql://u:p@localhost.evil.com/db')).toBe(
      false
    );
    expect(isLocalDatabaseUrl('not a url')).toBe(false);
  });

  it('never includes the password in the source label', () => {
    process.env.ADMIN_PASSWORD = 'custom-secret';
    expect(resolveAdminPassword().source).not.toContain('custom-secret');
    delete process.env.ADMIN_PASSWORD;
    expect(resolveAdminPassword().source).not.toContain(DEFAULT_ADMIN_PASSWORD);
    expect(resolveAdminPassword({ useDefault: true }).source).not.toContain(
      DEFAULT_ADMIN_PASSWORD
    );
  });
});

describe('isSeedOwnedAdmin', () => {
  it('accepts an existing superadmin', () => {
    expect(isSeedOwnedAdmin({ id: 'u1', role: 'superadmin' }, [])).toBe(true);
  });

  it('accepts the record carrying the seed credential account id', () => {
    expect(isSeedOwnedAdmin({ id: 'u1', role: 'user' }, ['account_u1'])).toBe(
      true
    );
  });

  it('refuses a pre-existing regular user', () => {
    expect(
      isSeedOwnedAdmin({ id: 'u1', role: 'user' }, ['acc-google-123'])
    ).toBe(false);
    expect(isSeedOwnedAdmin({ id: 'u1', role: 'user' }, ['account_u2'])).toBe(
      false
    );
  });
});
