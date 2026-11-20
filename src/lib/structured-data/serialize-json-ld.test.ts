import { describe, expect, it } from 'vitest';
import { serializeJsonLd } from '@/lib/structured-data/serialize-json-ld';

describe('serializeJsonLd', () => {
  const hostile = {
    '@type': 'Article',
    headline: '</script><script>alert(1)</script> & <!-- x -->',
    description: 'line\u2028sep\u2029para',
  };

  it('escapes characters that could break out of the script tag', () => {
    const out = serializeJsonLd(hostile);
    expect(out).not.toMatch(/[<>&\u2028\u2029]/);
    expect(out).toContain('\\u003c/script\\u003e');
    expect(out).toContain('\\u0026');
    expect(out).toContain('\\u2028');
    expect(out).toContain('\\u2029');
  });

  it('round-trips to the same value', () => {
    expect(JSON.parse(serializeJsonLd(hostile))).toEqual(hostile);
  });

  it('leaves plain data unchanged', () => {
    expect(serializeJsonLd({ name: 'Oatmeal', servings: 2 })).toBe(
      '{"name":"Oatmeal","servings":2}'
    );
  });
});
