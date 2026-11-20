import { describe, expect, it, vi } from 'vitest';
import {
  getProductionEnvWarnings,
  isInsecureRemoteUrl,
  isLocalHostname,
  reportProductionEnvWarnings,
  resolveEncryptionSecret,
} from '@/lib/env-checks';

const SECRET = 'auth-secret-value-that-must-never-be-logged';
const KEY = 'encryption-key-value-that-must-never-be-logged';

describe('resolveEncryptionSecret', () => {
  it('prefers ENCRYPTION_KEY', () => {
    expect(
      resolveEncryptionSecret({ ENCRYPTION_KEY: KEY, BETTER_AUTH_SECRET: SECRET })
    ).toEqual({ secret: KEY, source: 'ENCRYPTION_KEY' });
  });

  it('falls back to BETTER_AUTH_SECRET when ENCRYPTION_KEY is unset or empty', () => {
    for (const ENCRYPTION_KEY of [undefined, '']) {
      expect(resolveEncryptionSecret({ ENCRYPTION_KEY, BETTER_AUTH_SECRET: SECRET })).toEqual({
        secret: SECRET,
        source: 'BETTER_AUTH_SECRET',
      });
    }
  });

  it('returns null when neither is set', () => {
    expect(resolveEncryptionSecret({})).toBeNull();
  });
});

describe('isLocalHostname', () => {
  it.each(['localhost', 'LOCALHOST', '127.0.0.1', '127.1.2.3', '[::1]', '0.0.0.0', 'app.localhost'])(
    'treats %s as local',
    (host) => {
      expect(isLocalHostname(host)).toBe(true);
    }
  );

  it.each(['healthhub.example', 'localhost.example.com', '10.0.0.5', '192.168.1.10'])(
    'treats %s as remote',
    (host) => {
      expect(isLocalHostname(host)).toBe(false);
    }
  );
});

describe('isInsecureRemoteUrl', () => {
  it('flags http:// on a public host', () => {
    expect(isInsecureRemoteUrl('http://healthhub.example')).toBe(true);
    expect(isInsecureRemoteUrl(' HTTP://healthhub.example/ ')).toBe(true);
  });

  it('accepts https:// and local http://', () => {
    expect(isInsecureRemoteUrl('https://healthhub.example')).toBe(false);
    expect(isInsecureRemoteUrl('http://localhost:3000')).toBe(false);
    expect(isInsecureRemoteUrl('http://127.0.0.1:3101')).toBe(false);
  });

  it('ignores unset and unparseable values', () => {
    expect(isInsecureRemoteUrl(undefined)).toBe(false);
    expect(isInsecureRemoteUrl('')).toBe(false);
    expect(isInsecureRemoteUrl('not a url')).toBe(false);
  });
});

describe('getProductionEnvWarnings', () => {
  const healthy = {
    NODE_ENV: 'production',
    ENCRYPTION_KEY: KEY,
    BETTER_AUTH_SECRET: SECRET,
    BETTER_AUTH_URL: 'https://healthhub.example',
    NEXT_PUBLIC_BETTER_AUTH_URL: 'https://healthhub.example',
  };

  it('is silent for a correctly configured production server', () => {
    expect(getProductionEnvWarnings(healthy)).toEqual([]);
  });

  it('is silent outside production', () => {
    expect(
      getProductionEnvWarnings({
        NODE_ENV: 'development',
        BETTER_AUTH_SECRET: SECRET,
        BETTER_AUTH_URL: 'http://healthhub.example',
      })
    ).toEqual([]);
  });

  it('warns when journal encryption falls back to BETTER_AUTH_SECRET', () => {
    const warnings = getProductionEnvWarnings({ ...healthy, ENCRYPTION_KEY: '' });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/ENCRYPTION_KEY is not set/);
    // The advice must be to copy the current secret, never to generate a new key.
    expect(warnings[0]).toMatch(/current BETTER_AUTH_SECRET value/);
  });

  it('warns about http:// auth URLs on a public host', () => {
    const warnings = getProductionEnvWarnings({
      ...healthy,
      BETTER_AUTH_URL: 'http://healthhub.example',
      NEXT_PUBLIC_BETTER_AUTH_URL: 'http://healthhub.example',
    });
    expect(warnings).toHaveLength(2);
    expect(warnings[0]).toMatch(/^BETTER_AUTH_URL uses http:\/\//);
    expect(warnings[1]).toMatch(/^NEXT_PUBLIC_BETTER_AUTH_URL uses http:\/\//);
  });

  it('allows http://localhost for a local production build', () => {
    expect(
      getProductionEnvWarnings({ ...healthy, BETTER_AUTH_URL: 'http://localhost:3101' })
    ).toEqual([]);
  });

  it('never includes secret values or URLs in a message', () => {
    const warnings = getProductionEnvWarnings({
      NODE_ENV: 'production',
      BETTER_AUTH_SECRET: SECRET,
      BETTER_AUTH_URL: 'http://user:pass@healthhub.example',
    });
    expect(warnings.length).toBeGreaterThan(0);
    for (const message of warnings) {
      expect(message).not.toContain(SECRET);
      expect(message).not.toContain('healthhub.example');
      expect(message).not.toContain('user:pass');
    }
  });
});

describe('reportProductionEnvWarnings', () => {
  it('logs once per process', () => {
    const warn = vi.fn();
    const env = { NODE_ENV: 'production', BETTER_AUTH_SECRET: SECRET };
    reportProductionEnvWarnings(env, warn);
    reportProductionEnvWarnings(env, warn);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toMatch(/^\[HealthHub config\] ENCRYPTION_KEY is not set/);
  });
});
