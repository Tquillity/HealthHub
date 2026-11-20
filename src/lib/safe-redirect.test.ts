import { describe, expect, it } from 'vitest';
import { getSafeRedirectPath, withNextPath } from './safe-redirect';

describe('getSafeRedirectPath', () => {
  it('keeps same-site paths with their query and hash', () => {
    expect(getSafeRedirectPath('/invite/inv_abc')).toBe('/invite/inv_abc');
    expect(getSafeRedirectPath('/dashboard?org=org_1')).toBe('/dashboard?org=org_1');
    expect(getSafeRedirectPath('/journal?date=2026-01-02#notes')).toBe(
      '/journal?date=2026-01-02#notes'
    );
  });

  it('returns the normalized path, not the raw value', () => {
    expect(getSafeRedirectPath('/recipes/../journal')).toBe('/journal');
    expect(getSafeRedirectPath('/./dashboard')).toBe('/dashboard');
    expect(getSafeRedirectPath('/https://evil.example')).toBe('/https://evil.example');
  });

  it('falls back for anything that could leave the site', () => {
    for (const value of [
      'https://evil.example/x',
      'http:evil.example',
      'javascript:alert(1)',
      'evil.example',
      // Protocol-relative
      '//evil.example/x',
      '///evil.example/x',
      // Backslashes (browsers read `\` as `/`)
      '/\\evil.example',
      '\\/evil.example',
      '/a\\..\\..\\/evil.example',
      // Dot segments that collapse to `//host`
      '/..//evil.example',
      '/..//evil.example/login',
      '/.//evil.example',
      '/%2e%2e//evil.example',
      '/%2E%2E//evil.example',
      '/.%2e//evil.example',
      '/%2e.//evil.example',
      '/%2e//evil.example',
      '/a/..//evil.example',
      '/a/b/../..//evil.example',
      '/../..//evil.example',
      // Tabs and newlines are stripped by URL parsers
      '/\t/evil.example',
      '/\n/evil.example',
      '/.\r\n.//evil.example',
      // Encoded slashes and backslashes that another layer may decode
      '/%2F/evil.example',
      '/%2f%2fevil.example',
      '/%5Cevil.example',
      '/..%2F/evil.example',
      '/%2e%2e%2f%2fevil.example',
      '/%09/evil.example',
      // Malformed encoding
      '/%E0%A4%A',
      '',
      null,
      undefined,
    ]) {
      expect(getSafeRedirectPath(value), JSON.stringify(value)).toBe('/dashboard');
    }
  });

  it('only ever returns a single-slash path', () => {
    for (const value of ['/..//evil.example', '/%2e%2e//evil.example', '/a/..//evil.example']) {
      const result = getSafeRedirectPath(value, '/');
      expect(result.startsWith('//')).toBe(false);
      expect(new URL(result, 'https://healthhub.example').origin).toBe('https://healthhub.example');
    }
  });

  it('does not loop back to sign-in or open API routes', () => {
    expect(getSafeRedirectPath('/sign-in?next=/x')).toBe('/dashboard');
    expect(getSafeRedirectPath('/sign-up')).toBe('/dashboard');
    expect(getSafeRedirectPath('/api/account/export')).toBe('/dashboard');
    expect(getSafeRedirectPath('/sign-inside')).toBe('/sign-inside');
    // Also when dot segments or encoding lead there
    expect(getSafeRedirectPath('/journal/../sign-in')).toBe('/dashboard');
    expect(getSafeRedirectPath('/%2e%2e/api/account/export')).toBe('/dashboard');
    expect(getSafeRedirectPath('/%73ign-in')).toBe('/dashboard');
  });

  it('builds sign-in links that come back', () => {
    expect(withNextPath('/sign-in', '/invite/inv_a')).toBe('/sign-in?next=%2Finvite%2Finv_a');
  });
});
