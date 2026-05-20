import { SITE_NAME } from '@/lib/site-metadata';

export interface LearnResourceForJsonLd {
  id: string;
  title: string;
  excerpt: string | null;
  content: string;
  author: string | null;
  imageUrl: string | null;
  readTime: number | null;
  createdAt: Date;
  updatedAt: Date;
}

function resolveAbsoluteUrl(url: string, baseUrl: string): string {
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  return new URL(url.startsWith('/') ? url : `/${url}`, baseUrl).toString();
}

export function buildLearnArticleJsonLd(
  resource: LearnResourceForJsonLd,
  options: { baseUrl: string }
): Record<string, unknown> {
  const { baseUrl } = options;
  const canonicalUrl = new URL(`/learn/${resource.id}`, baseUrl).toString();

  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    '@id': canonicalUrl,
    headline: resource.title,
    url: canonicalUrl,
    isAccessibleForFree: true,
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
    },
  };

  const description =
    resource.excerpt?.trim() ||
    resource.content.replace(/\s+/g, ' ').trim().slice(0, 200);
  if (description) {
    jsonLd.description = description;
  }

  if (resource.author?.trim()) {
    jsonLd.author = {
      '@type': 'Person',
      name: resource.author.trim(),
    };
  }

  if (resource.imageUrl?.trim()) {
    jsonLd.image = resolveAbsoluteUrl(resource.imageUrl.trim(), baseUrl);
  }

  if (resource.readTime != null && resource.readTime > 0) {
    jsonLd.timeRequired = `PT${resource.readTime}M`;
  }

  jsonLd.datePublished = new Date(resource.createdAt).toISOString();
  jsonLd.dateModified = new Date(resource.updatedAt).toISOString();

  return jsonLd;
}
