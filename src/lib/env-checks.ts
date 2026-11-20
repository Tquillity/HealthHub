/**
 * Production configuration checks. Pure functions over an env record (no Node-only imports), so
 * they are unit-testable and safe to load from src/instrumentation.ts, which reports the
 * warnings once when a server instance starts.
 *
 * Warnings never throw and never include a variable's value: some of these are secrets.
 */

type Env = Readonly<Record<string, string | undefined>>;

export type EncryptionSecretSource = 'ENCRYPTION_KEY' | 'BETTER_AUTH_SECRET';

/**
 * The secret that journal encryption (src/lib/encryption.ts) derives its AES-256 key from.
 * ENCRYPTION_KEY wins; when it is unset or empty, BETTER_AUTH_SECRET is used instead.
 *
 * Changing the resolved secret makes every stored journal ciphertext undecryptable, and
 * decrypt() then returns the ciphertext as if it were plain text. To decouple the two on an
 * existing deployment, set ENCRYPTION_KEY to the current BETTER_AUTH_SECRET value.
 */
export function resolveEncryptionSecret(
  env: Env
): { secret: string; source: EncryptionSecretSource } | null {
  if (env.ENCRYPTION_KEY) {
    return { secret: env.ENCRYPTION_KEY, source: 'ENCRYPTION_KEY' };
  }
  if (env.BETTER_AUTH_SECRET) {
    return { secret: env.BETTER_AUTH_SECRET, source: 'BETTER_AUTH_SECRET' };
  }
  return null;
}

const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]', '0.0.0.0']);

/** Loopback hosts, where plain http:// is expected (local dev, CI, `pnpm start`). */
export function isLocalHostname(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return (
    LOCAL_HOSTNAMES.has(host) ||
    host.endsWith('.localhost') ||
    /^127(\.\d{1,3}){3}$/.test(host)
  );
}

/** True for an http:// URL that points at a non-loopback host. Unparseable values are ignored. */
export function isInsecureRemoteUrl(value: string | undefined): boolean {
  const trimmed = value?.trim();
  if (!trimmed) return false;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return false;
  }
  return url.protocol === 'http:' && !isLocalHostname(url.hostname);
}

const AUTH_URL_VARIABLES = ['BETTER_AUTH_URL', 'NEXT_PUBLIC_BETTER_AUTH_URL'] as const;

/** Warnings for a production server. Empty outside NODE_ENV=production. */
export function getProductionEnvWarnings(env: Env): string[] {
  if (env.NODE_ENV !== 'production') return [];

  const warnings: string[] = [];

  if (resolveEncryptionSecret(env)?.source !== 'ENCRYPTION_KEY') {
    warnings.push(
      'ENCRYPTION_KEY is not set, so journal encryption derives its key from BETTER_AUTH_SECRET. ' +
        'Set ENCRYPTION_KEY to the current BETTER_AUTH_SECRET value (not a new random key, which ' +
        'would make existing journal entries unreadable). See .env.example.'
    );
  }

  for (const name of AUTH_URL_VARIABLES) {
    if (isInsecureRemoteUrl(env[name])) {
      warnings.push(
        `${name} uses http:// for a non-localhost host. Use the https:// origin so sign-in ` +
          'and session cookies only travel over TLS.'
      );
    }
  }

  return warnings;
}

let reported = false;

/** Logs the production warnings once per process. Never throws. */
export function reportProductionEnvWarnings(
  env: Env = process.env,
  warn: (message: string) => void = console.warn
): void {
  if (reported) return;
  reported = true;
  try {
    for (const message of getProductionEnvWarnings(env)) {
      warn(`[HealthHub config] ${message}`);
    }
  } catch {
    // A configuration check must never take the server down.
  }
}
