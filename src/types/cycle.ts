import type { Prisma } from '@prisma/client';

export type FocusPreference = 'hormonal' | 'workout' | 'both';

export type CyclePhase = 'menstrual' | 'follicular' | 'ovulation' | 'luteal';

const expertSelect = {
  id: true,
  name: true,
  credentials: true,
  website: true,
  focusAreas: true,
} as const;

export const phaseRecommendationWithExpertInclude = {
  expert: {
    select: expertSelect,
  },
} satisfies Prisma.PhaseRecommendationInclude;

export type PhaseRecommendationWithExpert = Prisma.PhaseRecommendationGetPayload<{
  include: typeof phaseRecommendationWithExpertInclude;
}>;

export type ExpertSummary = Prisma.ExpertGetPayload<{
  select: typeof expertSelect;
}>;
