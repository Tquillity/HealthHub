import type { MetadataRoute } from 'next';
import { getMetadataBase } from '@/lib/site-metadata';

const STATIC_PATHS = [
  '/',
  '/timer',
  '/recipes',
  '/learn',
  '/privacy',
  '/terms',
  '/pro',
  '/sign-in',
  '/sign-up',
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = getMetadataBase();
  const lastModified = new Date();

  return STATIC_PATHS.map((path) => ({
    url: new URL(path, baseUrl).toString(),
    lastModified,
    changeFrequency: path === '/' || path === '/timer' ? 'weekly' : 'monthly',
    priority: path === '/' ? 1 : path === '/timer' ? 0.9 : 0.7,
  }));
}
