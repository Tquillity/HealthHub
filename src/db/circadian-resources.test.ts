import { describe, expect, it } from 'vitest';
import { parseLearnTldr } from '@/lib/validation/education-schemas';
import { CIRCADIAN_CATEGORY, CIRCADIAN_RESOURCES } from './circadian-resources';

describe('circadian Learn resources', () => {
  it('has 3-5 articles in the circadian category with unique titles', () => {
    expect(CIRCADIAN_RESOURCES.length).toBeGreaterThanOrEqual(3);
    expect(CIRCADIAN_RESOURCES.length).toBeLessThanOrEqual(5);
    expect(new Set(CIRCADIAN_RESOURCES.map((r) => r.title)).size).toBe(
      CIRCADIAN_RESOURCES.length
    );
    for (const resource of CIRCADIAN_RESOURCES) {
      expect(resource.category).toBe(CIRCADIAN_CATEGORY);
      expect(resource.tags).toContain('circadian insights');
      expect(resource.excerpt.length).toBeGreaterThan(40);
      expect(resource.readTime).toBeGreaterThan(0);
    }
  });

  it('gives every article a valid TLDR card', () => {
    for (const resource of CIRCADIAN_RESOURCES) {
      const tldr = parseLearnTldr(resource.tldr);
      expect(tldr, resource.title).not.toBeNull();
      expect(tldr?.summary).toBeTruthy();
      expect(tldr?.cautions.length).toBeGreaterThan(0);
    }
  });

  it('cites peer-reviewed sources and carries the wellness note', () => {
    for (const resource of CIRCADIAN_RESOURCES) {
      expect(resource.content).toContain('<h3>Sources</h3>');
      const citations = resource.content.match(/<li>[^<]+\. .*?\d{4};/g) ?? [];
      expect(citations.length, resource.title).toBeGreaterThanOrEqual(3);
      expect(resource.content).toContain('not medical advice');
    }
  });

  it('covers the topics from the issue', () => {
    const all = CIRCADIAN_RESOURCES.map((r) => r.content).join('\n');
    expect(all).toContain('Brambilla DJ');
    expect(all).toContain('Leproult R, Van Cauter E');
    expect(all).toContain('Clow A');
    expect(all).toMatch(/growth hormone/i);
    expect(all).toMatch(/light/i);
    expect(all).toMatch(/protein/i);
  });

  it('never makes diagnostic or treatment claims', () => {
    for (const resource of CIRCADIAN_RESOURCES) {
      const text = [
        resource.excerpt,
        resource.content.replace(/<h3>Sources<\/h3>[\s\S]*?<\/ol>/, ''),
        JSON.stringify(resource.tldr),
      ].join('\n');
      // "rather than trying to self-diagnose" in the wellness note is fine.
      expect(text).not.toMatch(
        /\b(cure|cures|boost your testosterone|deficiency)\b|(?<!self-)\bdiagnose[sd]?\b/i
      );
    }
  });
});
