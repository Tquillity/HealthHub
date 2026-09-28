/**
 * Serializes JSON-LD for an inline `<script type="application/ld+json">`.
 * Escapes `<`, `>` and `&` so content cannot close the script tag or open an
 * HTML comment, and U+2028 / U+2029 so the output is also valid JavaScript.
 * The result is still valid JSON that parses back to the same value.
 */
export function serializeJsonLd(data: unknown): string {
  return (JSON.stringify(data) ?? 'null')
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}
