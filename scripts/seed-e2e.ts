import { Prisma } from '@prisma/client';
import { createSeedPrisma } from '@/lib/admin-credentials';
import { encrypt } from '@/lib/encryption';

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
  // Partner sync (#3): the signed-in user tracks their cycle and shares with no household;
  // a second household member shares their full status with everyone in it.
  const daysAgo = (days: number) => {
    const date = new Date();
    date.setUTCHours(0, 0, 0, 0);
    date.setUTCDate(date.getUTCDate() - days);
    return date;
  };
  await prisma.user.update({
    where: { id: user.id },
    data: {
      enableCycleTracking: true,
      cycleLength: 28,
      lastPeriodDate: daysAgo(9),
      supportMessage: null,
    },
  });
  await prisma.cycleStatusShare.deleteMany({ where: { userId: user.id } });
  const partner = {
    name: 'Robin Partner',
    enableCycleTracking: true,
    cycleLength: 28,
    lastPeriodDate: daysAgo(20),
    supportMessage: encrypt('Tea and a short walk would be lovely.'),
  };
  await prisma.user.upsert({
    where: { id: 'hh-e2e-partner' },
    create: { id: 'hh-e2e-partner', email: 'e2e-partner@example.com', ...partner },
    update: partner,
  });
  await prisma.member.upsert({
    where: { id: 'hh-e2e-partner-membership' },
    create: {
      id: 'hh-e2e-partner-membership',
      userId: 'hh-e2e-partner',
      organizationId: 'hh-e2e-household',
      role: 'member',
    },
    update: { organizationId: 'hh-e2e-household' },
  });
  // Covers everyone who is in the household now, the signed-in user included.
  const partnerShare = {
    level: 'FULL' as const,
    coversMembersJoinedBy: new Date(),
  };
  await prisma.cycleStatusShare.upsert({
    where: {
      userId_organizationId: {
        userId: 'hh-e2e-partner',
        organizationId: 'hh-e2e-household',
      },
    },
    create: {
      id: 'hh-e2e-partner-cycle-share',
      userId: 'hh-e2e-partner',
      organizationId: 'hh-e2e-household',
      ...partnerShare,
    },
    update: partnerShare,
  });
  for (const recipe of [
    {
      id: 'hh-e2e-visibility',
      name: 'E2E visibility recipe',
      isSystem: true,
      isSecret: false,
    },
    {
      id: 'hh-e2e-public',
      name: 'E2E public recipe',
      isSystem: true,
      leanRole: 'Process',
      activeTime: 10,
      passiveTime: 0,
    },
    {
      id: 'hh-e2e-lean',
      name: 'E2E batch bread',
      isSystem: true,
      leanRole: 'Infrastructure',
      activeTime: 40,
      passiveTime: 120,
      yieldAmount: 12,
      yieldUnit: 'rolls',
      batchEfficiency: 'High',
    },
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
  // A system routine that matches the lottery's default filters (medium energy, 30 minutes),
  // so e2e/routine-lottery.spec.ts always has something to draw.
  const lotteryRoutine = {
    id: 'hh-e2e-lottery-routine',
    name: 'E2E lottery routine',
    description: 'Three slow breaths before the next task.',
    isSystem: true,
    energyLevel: 'medium',
    estimatedTime: 5,
  };
  await prisma.routine.upsert({
    where: { id: lotteryRoutine.id },
    create: lotteryRoutine,
    update: lotteryRoutine,
  });
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
