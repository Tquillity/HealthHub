import { describe, expect, it } from 'vitest';
import { getSocialProviderFlags } from '@/lib/social-providers';

describe('getSocialProviderFlags', () => {
  it('is false for every provider when nothing is configured', () => {
    expect(getSocialProviderFlags({})).toEqual({
      google: false,
      twitter: false,
    });
  });

  it('requires both client id and secret', () => {
    expect(
      getSocialProviderFlags({ GOOGLE_CLIENT_ID: 'id', X_CLIENT_SECRET: 's' })
    ).toEqual({ google: false, twitter: false });
    expect(
      getSocialProviderFlags({
        GOOGLE_CLIENT_ID: 'id',
        GOOGLE_CLIENT_SECRET: '  ',
      }).google
    ).toBe(false);
  });

  it('enables configured providers', () => {
    expect(
      getSocialProviderFlags({
        GOOGLE_CLIENT_ID: 'gid',
        GOOGLE_CLIENT_SECRET: 'gsecret',
        X_CLIENT_ID: 'xid',
        X_CLIENT_SECRET: 'xsecret',
      })
    ).toEqual({ google: true, twitter: true });
  });
});
