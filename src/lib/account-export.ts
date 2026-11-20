import { prisma } from '@/lib/db';
import { decrypt, decryptArray } from '@/lib/encryption';

/**
 * "Download my data" (GDPR data portability): everything HealthHub stores about the
 * signed-in user, as one JSON document.
 *
 * Secrets are left out: password hashes, OAuth tokens and session tokens. Other
 * members of shared households are counted, not listed, because their names and
 * emails are their personal data.
 */

export const ACCOUNT_EXPORT_FORMAT = 'healthhub-account-export';
export const ACCOUNT_EXPORT_VERSION = 1;

/** Date-only values (journal days, period and meal plan dates) are stored as UTC midnight. */
function dateOnly(value: Date | null | undefined): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

export async function buildAccountExport(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      emailVerified: true,
      image: true,
      createdAt: true,
      updatedAt: true,
      role: true,
      energyLevel: true,
      dietaryRestrictions: true,
      healthGoals: true,
      timezone: true,
      enableCycleTracking: true,
      cycleLength: true,
      lastPeriodDate: true,
      alignMealsWithCycle: true,
      focusPreference: true,
      mealPlanDuration: true,
      mealPlanStartDate: true,
      isPremium: true,
      temperatureUnit: true,
      trackVitals: true,
      briefingFrequency: true,
      briefingSources: true,
      briefingDetail: true,
      supportMessage: true,
      enableCircadianInsights: true,
    },
  });

  const [
    accounts,
    sessions,
    journalEntries,
    preferences,
    timer,
    memberships,
    periodStarts,
    briefingFeedback,
    cycleStatusShares,
  ] = await Promise.all([
    prisma.account.findMany({
      where: { userId },
      select: { providerId: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.session.findMany({
      where: { userId },
      select: {
        createdAt: true,
        expiresAt: true,
        ipAddress: true,
        userAgent: true,
      },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.journalEntry.findMany({
      where: { userId },
      include: { sharedOrganization: { select: { id: true, name: true } } },
      orderBy: { date: 'asc' },
    }),
    prisma.userIngredientPreference.findMany({
      where: { userId },
      select: {
        pattern: true,
        preferred: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { pattern: 'asc' },
    }),
    prisma.pomoState.findUnique({
      where: { userId },
      select: { payloadJson: true, updatedAt: true },
    }),
    prisma.member.findMany({
      where: { userId },
      select: { organizationId: true, role: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.periodStart.findMany({
      where: { userId },
      select: { date: true, createdAt: true },
      orderBy: { date: 'asc' },
    }),
    prisma.briefingFeedback.findMany({
      where: { userId },
      select: { date: true, suggestionKey: true, action: true, createdAt: true },
      orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
    }),
    prisma.cycleStatusShare.findMany({
      where: { userId },
      select: {
        level: true,
        coversMembersJoinedBy: true,
        createdAt: true,
        updatedAt: true,
        organization: { select: { id: true, name: true } },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    }),
  ]);

  const households = await Promise.all(
    memberships.map(async (membership) => {
      const organizationId = membership.organizationId;
      const [
        household,
        memberCount,
        recipes,
        routines,
        mealPlans,
        templates,
        groceries,
      ] = await Promise.all([
        prisma.organization.findUnique({
          where: { id: organizationId },
          select: { id: true, name: true, type: true, createdAt: true },
        }),
        prisma.member.count({ where: { organizationId } }),
        prisma.recipe.findMany({
          where: { organizationId },
          include: {
            ingredients: { omit: { recipeId: true } },
            instructions: {
              omit: { recipeId: true },
              orderBy: { stepNumber: 'asc' },
            },
          },
          omit: { organizationId: true },
          orderBy: { createdAt: 'asc' },
        }),
        prisma.routine.findMany({
          where: { organizationId },
          omit: { organizationId: true },
          orderBy: { createdAt: 'asc' },
        }),
        prisma.mealPlan.findMany({
          where: { organizationId },
          include: {
            items: {
              include: { recipe: { select: { name: true } } },
              orderBy: { date: 'asc' },
            },
          },
          orderBy: { startDate: 'asc' },
        }),
        prisma.mealPlanTemplate.findMany({
          where: { organizationId },
          include: {
            items: {
              include: { recipe: { select: { name: true } } },
              orderBy: { dayOffset: 'asc' },
            },
          },
          orderBy: { createdAt: 'asc' },
        }),
        prisma.shoppingListItem.findMany({
          where: { organizationId },
          omit: { organizationId: true },
          orderBy: { createdAt: 'asc' },
        }),
      ]);

      return {
        id: organizationId,
        name: household?.name ?? null,
        /** HOUSEHOLD, COLLECTIVE, COMMUNITY or CORPORATE: decides what the group may see. */
        type: household?.type ?? null,
        createdAt: household?.createdAt ?? null,
        yourRole: membership.role,
        joinedAt: membership.createdAt,
        memberCount,
        recipes,
        routines,
        mealPlans: mealPlans.map((plan) => ({
          id: plan.id,
          startDate: dateOnly(plan.startDate),
          endDate: dateOnly(plan.endDate),
          items: plan.items.map((item) => ({
            date: dateOnly(item.date),
            mealType: item.mealType,
            servings: item.servings,
            isCooked: item.isCooked,
            recipeId: item.recipeId,
            recipeName: item.recipe.name,
          })),
        })),
        mealPlanTemplates: templates.map((template) => ({
          id: template.id,
          name: template.name,
          description: template.description,
          isPublic: template.isPublic,
          createdByYou: template.createdById === userId,
          createdAt: template.createdAt,
          items: template.items.map((item) => ({
            dayOffset: item.dayOffset,
            mealType: item.mealType,
            servings: item.servings,
            recipeId: item.recipeId,
            recipeName: item.recipe.name,
          })),
        })),
        groceryList: groceries,
      };
    })
  );

  return {
    format: ACCOUNT_EXPORT_FORMAT,
    version: ACCOUNT_EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    profile: {
      ...user,
      lastPeriodDate: dateOnly(user.lastPeriodDate),
      mealPlanStartDate: dateOnly(user.mealPlanStartDate),
      // The message for households you share Full cycle status with (#3).
      supportMessage: decrypt(user.supportMessage),
    },
    // Cycle status sharing (#3): each household you share with, how much, and since when.
    // Members who had joined by coversMembersJoinedBy see it.
    cycleStatusSharing: cycleStatusShares.map((share) => ({
      household: share.organization,
      level: share.level,
      coversMembersJoinedBy: share.coversMembersJoinedBy,
      sharedSince: share.createdAt,
      updatedAt: share.updatedAt,
    })),
    signInMethods: accounts.map((account) => ({
      provider: account.providerId,
      addedAt: account.createdAt,
    })),
    sessions,
    journalEntries: journalEntries.map((entry) => ({
      date: dateOnly(entry.date),
      mood: entry.mood,
      energy: entry.energy,
      sleepHours: entry.sleepHours,
      notes: decrypt(entry.notes),
      tags: entry.tags,
      gratitudeEntries: decryptArray(entry.gratitudeEntries),
      gratitudeNotes: decrypt(entry.gratitudeNotes),
      goalsAchieved: decryptArray(entry.goalsAchieved),
      goalsProgress: decryptArray(entry.goalsProgress),
      goalsNotes: decrypt(entry.goalsNotes),
      symptomsPhysical: decryptArray(entry.symptomsPhysical),
      symptomsMental: decryptArray(entry.symptomsMental),
      symptomsNotes: decrypt(entry.symptomsNotes),
      // Basal body temperature in °C (the unit preference is in the profile).
      temperature: entry.temperature,
      cervicalMucus: decrypt(entry.cervicalMucus),
      restingHeartRate: entry.restingHeartRate,
      heartRateVariability: entry.heartRateVariability,
      sleepQuality: entry.sleepQuality,
      // PRIVATE, or ORGANIZATION when you shared this day with a household or collective.
      visibility: entry.sharedOrganization ? entry.visibility : 'PRIVATE',
      sharedWith: entry.sharedOrganization,
      // Energy check-ins by time of day (circadian insights), 1-10.
      energyMorning: entry.energyMorning,
      energyAfternoon: entry.energyAfternoon,
      energyEvening: entry.energyEvening,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
    })),
    periodStarts: periodStarts.map((start) => ({
      date: dateOnly(start.date),
      loggedAt: start.createdAt,
    })),
    // Daily briefing feedback (preferences are in the profile). Keys are stored encrypted.
    briefingFeedback: briefingFeedback.map((entry) => ({
      date: dateOnly(entry.date),
      suggestion: decrypt(entry.suggestionKey),
      action: entry.action,
      createdAt: entry.createdAt,
    })),
    ingredientPreferences: preferences,
    timerState: timer,
    households,
  };
}

export type AccountExport = Awaited<ReturnType<typeof buildAccountExport>>;
