import { describe, it, expect } from 'vitest';
import { buildLearnArticleJsonLd } from '@/lib/structured-data/learn-jsonld';

const baseResource = {
  id: 'learn-1',
  title: 'Sleep and Recovery',
  excerpt: 'How rest supports your cycle.',
  content: 'Long form article content here.',
  author: 'HealthHub Team',
  imageUrl: '/images/sleep.jpg',
  readTime: 8,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-05-01T00:00:00.000Z'),
};

describe('buildLearnArticleJsonLd', () => {
  it('builds Article schema with canonical URL', () => {
    const jsonLd = buildLearnArticleJsonLd(baseResource, {
      baseUrl: 'https://healthhub.example',
    });

    expect(jsonLd['@type']).toBe('Article');
    expect(jsonLd.headline).toBe('Sleep and Recovery');
    expect(jsonLd.url).toBe('https://healthhub.example/learn/learn-1');
    expect(jsonLd.isAccessibleForFree).toBe(true);
    expect(jsonLd.image).toBe('https://healthhub.example/images/sleep.jpg');
    expect(jsonLd.timeRequired).toBe('PT8M');
  });

  it('falls back to content snippet when excerpt is missing', () => {
    const jsonLd = buildLearnArticleJsonLd(
      { ...baseResource, excerpt: null },
      { baseUrl: 'https://healthhub.example' }
    );
    expect(jsonLd.description).toContain('Long form');
  });
});
