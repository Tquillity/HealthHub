import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import {
  DEFAULT_ADMIN_PASSWORD,
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
