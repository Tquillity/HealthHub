/**
 * Which social sign-in providers are configured. Booleans only — safe to pass
 * to client components. X is Better-Auth's `twitter` provider.
 */
export type SocialProviderFlags = { google: boolean; twitter: boolean };

type ProviderEnv = Readonly<Record<string, string | undefined>>;

export function getSocialProviderFlags(
  env: ProviderEnv = process.env
): SocialProviderFlags {
  return {
    google: !!(
      env.GOOGLE_CLIENT_ID?.trim() && env.GOOGLE_CLIENT_SECRET?.trim()
    ),
    twitter: !!(env.X_CLIENT_ID?.trim() && env.X_CLIENT_SECRET?.trim()),
  };
}
