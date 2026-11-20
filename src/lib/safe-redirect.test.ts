import { describe, expect, it } from 'vitest';
import { getSafeRedirectPath, withNextPath } from './safe-redirect';

describe('getSafeRedirectPath', () => {
  it('keeps same-site paths with their query', () => {
    expect(getSafeRedirectPath('/invite/inv_abc')).toBe('/invite/inv_abc');
    expect(getSafeRedirectPath('/dashboard?org=org_1')).toBe('/dashboard?org=org_1');
  });

  it('falls back for anything that could leave the site', () => {
    for (const value of [
      'https://evil.example/x',
      '//evil.example/x',
      '/\\evil.example',
      'evil.example',
      'javascript:alert(1)',
      '/\t/evil.example',
      '',
      null,
      undefined,
    ]) {
      expect(getSafeRedirectPath(value)).toBe('/dashboard');
    }
  });

  it('does not loop back to sign-in or open API routes', () => {
    expect(getSafeRedirectPath('/sign-in?next=/x')).toBe('/dashboard');
    expect(getSafeRedirectPath('/sign-up')).toBe('/dashboard');
    expect(getSafeRedirectPath('/api/account/export')).toBe('/dashboard');
    expect(getSafeRedirectPath('/sign-inside')).toBe('/sign-inside');
  });

  it('builds sign-in links that come back', () => {
    expect(withNextPath('/sign-in', '/invite/inv_a')).toBe('/sign-in?next=%2Finvite%2Finv_a');
  });
});
