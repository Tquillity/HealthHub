import { prisma } from '@/lib/db';

export async function getPublicLearnSitemapEntries() {
  return prisma.educationalResource.findMany({
    select: {
      id: true,
      updatedAt: true,
    },
    orderBy: {
      updatedAt: 'desc',
    },
  });
}
