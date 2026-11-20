const INTERNAL_ORIGIN = 'http://internal.invalid';

// Back to sign-in would loop (the proxy redirects signed-in users away from it),
// and API routes are not pages.
const BLOCKED_PATH = /^\/(sign-in|sign-up|api)(\/|$)/;

/**
 * Resolves `value` against a dummy origin the way a browser or `new URL(next, request.url)`
 * would, and returns it only when it stays on that origin as a plain path.
 */
function resolveSameOrigin(value: string): URL | null {
  // One leading slash, no protocol-relative (//host) or backslash tricks (/\host).
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return null;
  // Control characters (tabs, newlines) are stripped by URL parsers and can hide a second slash.
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index);
    if (code < 0x20 || code === 0x7f) return null;
  }
  let url: URL;
  try {
    url = new URL(value, INTERNAL_ORIGIN);
  } catch {
    return null;
  }
  if (url.origin !== INTERNAL_ORIGIN) return null;
  // Parsing removes dot segments, so `/..//host` or `/%2e%2e//host` comes out as `//host`,
  // which a browser reads as another site.
  if (url.pathname.startsWith('//') || url.pathname.startsWith('/\\')) return null;
  return url;
}

/**
 * Where to go after signing in or up (`?next=/invite/abc`). Only same-site paths are allowed,
 * so the parameter cannot send someone to another site (open redirect).
 */
export function getSafeRedirectPath(
  raw: string | null | undefined,
  fallback = '/dashboard'
): string {
  if (!raw || raw.length > 512) return fallback;
  const url = resolveSameOrigin(raw);
  if (!url) return fallback;

  // Encoded slashes, dots and backslashes (`/%2F%2Fhost`, `/%5Chost`, `/..%2F/host`) stay
  // encoded here, but another layer may decode them, so the decoded path must be safe too.
  let decodedPath: string;
  try {
    decodedPath = decodeURIComponent(url.pathname);
  } catch {
    return fallback;
  }
  const decoded = resolveSameOrigin(decodedPath);
  if (!decoded) return fallback;

  if (BLOCKED_PATH.test(url.pathname) || BLOCKED_PATH.test(decoded.pathname)) return fallback;
  return `${url.pathname}${url.search}${url.hash}`;
}

/** `/sign-in?next=…` style link that brings the user back to `path` afterwards. */
export function withNextPath(authPath: '/sign-in' | '/sign-up', path: string): string {
  return `${authPath}?next=${encodeURIComponent(path)}`;
}
