import { prisma } from '@/lib/db';

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
