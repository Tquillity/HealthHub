import type { MetadataRoute } from 'next';
import { getMetadataBase } from '@/lib/site-metadata';
import { getPublicRecipeSitemapEntries } from '@/lib/structured-data/public-recipe-sitemap';

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

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getMetadataBase();
  const lastModified = new Date();

  const staticEntries: MetadataRoute.Sitemap = STATIC_PATHS.map((path) => ({
    url: new URL(path, baseUrl).toString(),
    lastModified,
    changeFrequency: path === '/' || path === '/timer' ? 'weekly' : 'monthly',
    priority: path === '/' ? 1 : path === '/timer' ? 0.9 : 0.7,
  }));

  const publicRecipes = await getPublicRecipeSitemapEntries();
  const recipeEntries: MetadataRoute.Sitemap = publicRecipes.map((recipe) => ({
    url: new URL(`/recipes/${recipe.id}`, baseUrl).toString(),
    lastModified: recipe.updatedAt,
    changeFrequency: 'monthly',
    priority: 0.6,
  }));

  return [...staticEntries, ...recipeEntries];
}
