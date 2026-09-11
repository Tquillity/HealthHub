import { Prisma } from '@prisma/client';
import { createSeedPrisma } from '@/lib/admin-credentials';

const url = new URL(process.env.DATABASE_URL ?? '');
if (
  !['localhost', '127.0.0.1'].includes(url.hostname) ||
  url.pathname !== '/healthhub_e2e'
) {
  throw new Error(
    'E2E fixtures require a local disposable healthhub_e2e database'
  );
}
const { prisma, pool } = createSeedPrisma();
try {
  const user = await prisma.user.findUniqueOrThrow({
    where: {
      email: process.env.PLAYWRIGHT_TEST_EMAIL ?? 'admin@healthhub.com',
    },
  });
  await prisma.organization.upsert({
    where: { id: 'hh-e2e-household' },
    create: {
      id: 'hh-e2e-household',
      name: 'E2E household',
      slug: 'hh-e2e-household',
    },
    update: {},
  });
  await prisma.member.upsert({
    where: { id: 'hh-e2e-membership' },
    create: {
      id: 'hh-e2e-membership',
      userId: user.id,
      organizationId: 'hh-e2e-household',
      role: 'owner',
    },
    update: { userId: user.id },
  });
  for (const recipe of [
    {
      id: 'hh-e2e-visibility',
      name: 'E2E visibility recipe',
      isSystem: true,
      isSecret: false,
    },
    { id: 'hh-e2e-public', name: 'E2E public recipe', isSystem: true },
    {
      id: 'hh-e2e-household',
      name: 'E2E household recipe',
      organizationId: 'hh-e2e-household',
    },
    { id: 'hh-e2e-secret', name: 'E2E secret recipe', isSecret: true },
    {
      id: 'hh-e2e-private',
      name: 'E2E private recipe',
      isPrivate: true,
      isSystem: true,
    },
  ]) {
    await prisma.recipe.upsert({
      where: { id: recipe.id },
      create: {
        ...recipe,
        tags: [],
        dietaryTags: [],
        imageUrls: [],
        ingredients: { create: { name: 'Lentils', quantity: 1, unit: 'cup' } },
        instructions: { create: { stepNumber: 1, text: 'Rinse the lentils.' } },
      },
      update: recipe,
    });
  }
  for (const article of [
    {
      id: 'hh-e2e-tldr',
      title: 'E2E quick facts',
      tldr: {
        summary: 'A short fixture summary.',
        keyPoints: ['One fixture fact.'],
      },
    },
    {
      id: 'hh-e2e-no-tldr',
      title: 'E2E full article only',
      tldr: Prisma.DbNull,
    },
    {
      id: 'hh-e2e-invalid-tldr',
      title: 'E2E invalid quick facts',
      tldr: { keyPoints: [42] },
    },
  ]) {
    await prisma.educationalResource.upsert({
      where: { id: article.id },
      create: {
        ...article,
        category: 'wellness',
        tags: [],
        content: '<p>Complete fixture article.</p>',
      },
      update: article,
    });
  }
} finally {
  await prisma.$disconnect();
  await pool.end();
}
