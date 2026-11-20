/**
 * Where to go after signing in or up (`?next=/invite/abc`). Only same-site paths are allowed,
 * so the parameter cannot send someone to another site (open redirect).
 */
export function getSafeRedirectPath(
  raw: string | null | undefined,
  fallback = '/dashboard'
): string {
  if (!raw || raw.length > 512) return fallback;
  // One leading slash, no protocol-relative (//host) or backslash tricks (/\host).
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) {
    return fallback;
  }
  // Control characters (tabs, newlines) are stripped by browsers and can hide a second slash.
  for (let index = 0; index < raw.length; index++) {
    const code = raw.charCodeAt(index);
    if (code < 0x20 || code === 0x7f) return fallback;
  }
  try {
    const url = new URL(raw, 'https://healthhub.invalid');
    if (url.origin !== 'https://healthhub.invalid') return fallback;
    // Back to sign-in would loop (the proxy redirects signed-in users away from it),
    // and API routes are not pages.
    if (/^\/(sign-in|sign-up|api)(\/|$)/.test(url.pathname)) return fallback;
    return `${url.pathname}${url.search}`;
  } catch {
    return fallback;
  }
}

/** `/sign-in?next=…` style link that brings the user back to `path` afterwards. */
export function withNextPath(authPath: '/sign-in' | '/sign-up', path: string): string {
  return `${authPath}?next=${encodeURIComponent(path)}`;
}
