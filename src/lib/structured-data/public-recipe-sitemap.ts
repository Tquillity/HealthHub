import { prisma } from '@/lib/db';

/** IDs for public system recipes only — safe for `generateStaticParams` (no org-scoped leakage). */
export async function getPublicSystemRecipeIds(): Promise<{ id: string }[]> {
  return prisma.recipe.findMany({
    where: {
      isSystem: true,
      isSecret: false,
      isPrivate: false,
    },
    select: { id: true },
    orderBy: { updatedAt: 'desc' },
    take: 200,
  });
}

export async function getPublicRecipeSitemapEntries() {
  return prisma.recipe.findMany({
    where: {
      isSystem: true,
      isSecret: false,
      isPrivate: false,
    },
    select: {
      id: true,
      updatedAt: true,
    },
    orderBy: {
      updatedAt: 'desc',
    },
  });
}
