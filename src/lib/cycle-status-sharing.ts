import { z } from 'zod';
import type { CycleShareLevel } from '@prisma/client';
import type { CyclePhase, CyclePhaseResult } from '@/lib/cycle-calculator';
import { PHASE_THEMES } from '@/lib/phase-theme';
import type { FocusPreference } from '@/types/cycle';

/**
 * Partner sync (issue #3): what household members may see of someone's current cycle status.
 *
 * Sharing is off by default. It is effective only while the master switch is on, the level is
 * not NONE and the person has cycle tracking set up (see getEffectiveShareLevel). Where it may
 * be shown is decided by org-policy (households only).
 *
 * `projectCycleStatus` is the single definition of what each level reveals. The dashboard
 * widget and the Profile preview both use it, so the preview is exactly what others see:
 * - PHASE: first name, current phase (name and color) and a supportive suggestion.
 * - ENERGY: PHASE + the typical energy pattern for that phase + today's self-logged energy.
 * - FULL: ENERGY + cycle day, days until the next period and the personal support message.
 * Journal notes, symptoms, mood, sleep, body temperature and every other field are never part
 * of any level. Pure and client-safe; unit-tested in cycle-status-sharing.test.ts.
 */

export const CYCLE_SHARE_LEVELS = [
  'NONE',
  'PHASE',
  'ENERGY',
  'FULL',
] as const satisfies readonly CycleShareLevel[];

const LEVEL_RANK: Record<CycleShareLevel, number> = { NONE: 0, PHASE: 1, ENERGY: 2, FULL: 3 };

/** True when `level` reveals at least as much as `minimum`. */
export function levelIncludes(level: CycleShareLevel, minimum: CycleShareLevel): boolean {
  return LEVEL_RANK[level] >= LEVEL_RANK[minimum];
}

export const SUPPORT_MESSAGE_MAX_LENGTH = 280;

export const CYCLE_SHARE_LEVEL_INFO: Record<
  CycleShareLevel,
  { label: string; description: string }
> = {
  NONE: {
    label: 'Nothing',
    description: 'Household members see nothing about your cycle.',
  },
  PHASE: {
    label: 'Phase only',
    description:
      'Your first name, your current phase and its color, and a supportive idea for them.',
  },
  ENERGY: {
    label: 'Phase and energy',
    description:
      'Phase only, plus the typical energy pattern for your phase and the energy you logged in your journal today, if you did.',
  },
  FULL: {
    label: 'Full status',
    description:
      'Phase and energy, plus your cycle day, roughly how many days until your next period, and your personal message.',
  },
};

export const NEVER_SHARED_NOTE =
  'Your journal notes, symptoms, mood, sleep, temperature and other health details are never shared at any level.';

/** Settings update from Profile. Only the fields that are sent change. */
export const UpdateCycleSharingSchema = z
  .object({
    shareCycleStatus: z.boolean().optional(),
    shareCycleLevel: z.enum(CYCLE_SHARE_LEVELS).optional(),
    /** Plain text; '' or null clears it. Stored encrypted. */
    supportMessage: z
      .string()
      .trim()
      .max(
        SUPPORT_MESSAGE_MAX_LENGTH,
        `Keep your message to ${SUPPORT_MESSAGE_MAX_LENGTH} characters or fewer`
      )
      .nullable()
      .optional(),
  })
  .strict()
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: 'Nothing to update',
  });

export type UpdateCycleSharingInput = z.infer<typeof UpdateCycleSharingSchema>;

/**
 * The level that actually applies: NONE unless the master switch is on and cycle tracking is
 * set up (tracking enabled and a last period date), whatever level is stored.
 */
export function getEffectiveShareLevel(settings: {
  shareCycleStatus: boolean;
  shareCycleLevel: CycleShareLevel;
  cycleConfigured: boolean;
}): CycleShareLevel {
  if (!settings.shareCycleStatus || !settings.cycleConfigured) return 'NONE';
  return settings.shareCycleLevel;
}

export const PHASE_LABELS: Record<CyclePhase, string> = {
  menstrual: 'Menstrual',
  follicular: 'Follicular',
  ovulation: 'Ovulation',
  luteal: 'Luteal',
};

/**
 * Typical energy per phase, in words. Same shape as the app's existing phase model: the
 * Energy series of the cycle chart (src/components/cycle/cycle-chart.tsx, generateEnergyData:
 * lower while menstruating, rising through the follicular phase, highest around ovulation,
 * easing off through the luteal phase) and "What's happening" in the phase deep dive
 * (src/components/cycle/phase-deep-dive.tsx). A typical pattern, not a measurement.
 */
export const TYPICAL_PHASE_ENERGY: Record<CyclePhase, { summary: string; detail: string }> = {
  menstrual: {
    summary: 'Often lower',
    detail: 'Energy is often lower during a period, though some people still feel strong.',
  },
  follicular: {
    summary: 'Often building',
    detail: 'Energy and motivation often build through this phase.',
  },
  ovulation: {
    summary: 'Often highest',
    detail: 'Energy is often at its highest around now, though it varies from person to person.',
  },
  luteal: {
    summary: 'May fluctuate',
    detail: 'Energy may change from day to day and often eases off toward the end of this phase.',
  },
};

export type CycleSnapshot = {
  phase: CyclePhase;
  /** 1-based day of the current cycle. */
  cycleDay: number;
  /** 1 means the next period is expected tomorrow. */
  daysUntilNextPeriod: number;
};

/** The parts of calculateCyclePhase's result that partner sync uses. */
export function toCycleSnapshot(result: CyclePhaseResult, cycleLength: number): CycleSnapshot {
  return {
    phase: result.currentPhase,
    cycleDay: result.daysIntoCycle,
    daysUntilNextPeriod: Math.max(1, cycleLength - result.daysIntoCycle + 1),
  };
}

export type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'night';

export function getTimeOfDay(hour: number): TimeOfDay {
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 22) return 'evening';
  return 'night';
}

/** "Mikael Andersson" -> "Mikael". Other members only ever see the first name. */
export function firstNameOf(name: string | null | undefined): string {
  const first = (name ?? '').trim().split(/\s+/)[0];
  return first || 'Someone';
}

/** Journal energy is a whole number from 1 to 10 (src/actions/journal-actions.ts). */
function validEnergy(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 10
    ? value
    : null;
}

const WHEN: Record<Exclude<TimeOfDay, 'night'>, string> = {
  morning: 'today',
  afternoon: 'this afternoon',
  evening: 'this evening',
};

/**
 * Support ideas by phase and the viewer's own focus preference. Kept in line with the expert
 * content the app already shows, and phrased as invitations, never instructions:
 * - Movement ("workout"): Dr. Stacy Sims's exercise recommendations seeded in src/db/seed.ts
 *   (menstrual: can be a strong window when comfortable, follow readiness; follicular:
 *   higher intensity suits rising estrogen; ovulation: responses vary, check readiness;
 *   luteal: lower intensity, steady-state cardio, yoga). Huberman Lab, Dr. Stacy Sims
 *   episode (Jul 2024).
 * - Food ("hormonal"): Dr. Mindy Pelz's nutrition recommendations in src/db/seed.ts and
 *   src/lib/dietary-recommendations.ts (menstrual: iron-rich, comforting foods; follicular:
 *   light proteins, leafy greens, fermented foods; ovulation: balanced meals, vegetables,
 *   seeds; luteal: complex carbs and magnesium-rich foods).
 */
const DAYTIME_IDEAS: Record<CyclePhase, Record<FocusPreference, (when: string) => string>> = {
  menstrual: {
    workout: (when) =>
      `Let them set the pace ${when}: some people feel strong enough for a hard session during their period, others prefer a walk or gentle stretching.`,
    hormonal: (when) => `A comforting, iron-rich meal ${when} could be a kind gesture.`,
    both: (when) =>
      `Ask how they feel ${when}. A comforting, iron-rich meal and letting them choose how active to be can both help.`,
  },
  follicular: {
    workout: (when) =>
      `Energy often builds in this phase, so trying something new or more challenging together ${when} could be fun, if they are up for it.`,
    hormonal: (when) =>
      `Cooking something fresh together ${when}, with light protein, leafy greens or fermented foods, could be a nice idea.`,
    both: (when) =>
      `Energy often builds in this phase. Planning something new together ${when}, like an active outing or a fresh meal, could feel good.`,
  },
  ovulation: {
    workout: (when) =>
      `Many people feel strong and social now, but it varies. Check in before suggesting an intense session together ${when}.`,
    hormonal: (when) =>
      `A balanced meal with plenty of vegetables and some seeds ${when} could help keep energy steady.`,
    both: (when) =>
      `Many people feel social and energetic now, though it varies. An active plan together ${when} could be fun if they are up for it.`,
  },
  luteal: {
    workout: (when) =>
      `A low-intensity routine together could feel good ${when}, like a walk, steady cardio or yoga.`,
    hormonal: (when) =>
      `A comforting meal with complex carbs and magnesium-rich foods, like whole grains, leafy greens or nuts, could be a thoughtful gesture ${when}.`,
    both: (when) =>
      `A low-intensity routine together could feel good ${when}, and a comforting home-cooked meal is a kind extra.`,
  },
};

/**
 * Late at night every focus gets a wind-down idea instead. Luteal: sleep is more often
 * disturbed in the late luteal phase (Baker FC, Driver HS. "Circadian rhythms, sleep, and the
 * menstrual cycle." Sleep Med. 2007;8(6):613-622).
 */
const NIGHT_IDEAS: Record<CyclePhase, string> = {
  menstrual: 'Some quiet time and an early night could feel good tonight.',
  follicular: 'Winding down together could be a nice end to the day.',
  ovulation: 'A relaxed wind-down together could be a nice end to the day.',
  luteal:
    'Some people sleep a little lighter in this phase, so a calm wind-down together could help tonight.',
};

/**
 * Self-logged energy on the journal's 1-10 scale. Product thresholds (roughly the bottom and
 * top fifth of the scale), not physiological ones.
 */
const LOW_ENERGY_MAX = 3;
const HIGH_ENERGY_MIN = 8;

export type SupportSuggestionInput = {
  firstName: string;
  phase: CyclePhase;
  /** The viewer's own focus preference, so the idea fits what they like to do. */
  viewerFocus: FocusPreference;
  timeOfDay: TimeOfDay;
  /**
   * Today's self-logged energy. Pass it only when the sharer shares energy (ENERGY or FULL),
   * otherwise the suggestion would hint at a value they did not share.
   */
  todayEnergy?: number | null;
};

/** One short, empathetic, non-medical idea for the people around them. */
export function buildSupportSuggestion(input: SupportSuggestionInput): string {
  const { firstName, phase, viewerFocus, timeOfDay } = input;
  const opener = `${firstName} is in the ${PHASE_LABELS[phase].toLowerCase()} phase.`;
  const idea =
    timeOfDay === 'night' ? NIGHT_IDEAS[phase] : DAYTIME_IDEAS[phase][viewerFocus](WHEN[timeOfDay]);

  const energy = validEnergy(input.todayEnergy);
  let energyNote = '';
  if (energy !== null && energy <= LOW_ENERGY_MAX) {
    energyNote = ` ${firstName} logged low energy today, so keeping plans easy could mean a lot.`;
  } else if (energy !== null && energy >= HIGH_ENERGY_MIN) {
    energyNote = ` ${firstName} logged plenty of energy today.`;
  }
  return `${opener} ${idea}${energyNote}`;
}

export type SharedPhase = {
  key: CyclePhase;
  name: string;
  /** Hex from PHASE_THEMES, for an inline color dot. */
  color: string;
};

type PhaseLevelStatus = {
  id: string;
  firstName: string;
  phase: SharedPhase;
  suggestion: string;
};

type EnergyLevelFields = {
  typicalEnergy: { summary: string; detail: string };
  /** Today's self-logged energy (1-10), or null when nothing was logged today. */
  todayEnergy: number | null;
};

type FullLevelFields = {
  cycleDay: number;
  daysUntilNextPeriod: number;
  supportMessage: string | null;
};

export type ProjectedCycleStatus =
  | ({ level: 'PHASE' } & PhaseLevelStatus)
  | ({ level: 'ENERGY' } & PhaseLevelStatus & EnergyLevelFields)
  | ({ level: 'FULL' } & PhaseLevelStatus & EnergyLevelFields & FullLevelFields);

/** Everything the server knows about one sharer. The projection decides what leaves. */
export type CycleStatusSource = {
  /** Opaque key for the list (the sharer's user id). */
  id: string;
  name: string;
  /** Effective level (getEffectiveShareLevel). */
  level: CycleShareLevel;
  /** Null when cycle tracking is not set up. */
  snapshot: CycleSnapshot | null;
  todayEnergy: number | null;
  /** Decrypted support message. */
  supportMessage: string | null;
};

export type SupportViewer = { focus: FocusPreference; timeOfDay: TimeOfDay };

/**
 * What a household member sees of `source`, or null when nothing is shared. Every returned
 * field is chosen explicitly here; nothing is spread from the source.
 */
export function projectCycleStatus(
  source: CycleStatusSource,
  viewer: SupportViewer
): ProjectedCycleStatus | null {
  const { snapshot } = source;
  if (source.level === 'NONE' || !snapshot) return null;

  const firstName = firstNameOf(source.name);
  const sharesEnergy = levelIncludes(source.level, 'ENERGY');
  const todayEnergy = sharesEnergy ? validEnergy(source.todayEnergy) : null;
  const base: PhaseLevelStatus = {
    id: source.id,
    firstName,
    phase: {
      key: snapshot.phase,
      name: PHASE_LABELS[snapshot.phase],
      color: PHASE_THEMES[snapshot.phase].color.primary,
    },
    suggestion: buildSupportSuggestion({
      firstName,
      phase: snapshot.phase,
      viewerFocus: viewer.focus,
      timeOfDay: viewer.timeOfDay,
      todayEnergy: sharesEnergy ? todayEnergy : undefined,
    }),
  };
  if (source.level === 'PHASE') return { level: 'PHASE', ...base };

  const energy: EnergyLevelFields = {
    typicalEnergy: { ...TYPICAL_PHASE_ENERGY[snapshot.phase] },
    todayEnergy,
  };
  if (source.level === 'ENERGY') return { level: 'ENERGY', ...base, ...energy };

  const message = source.supportMessage?.trim().slice(0, SUPPORT_MESSAGE_MAX_LENGTH);
  return {
    level: 'FULL',
    ...base,
    ...energy,
    cycleDay: snapshot.cycleDay,
    daysUntilNextPeriod: snapshot.daysUntilNextPeriod,
    supportMessage: message || null,
  };
}

/** Parses a stored focus preference; anything unknown means "both". */
export function parseFocusPreference(value: string | null | undefined): FocusPreference {
  return value === 'hormonal' || value === 'workout' || value === 'both' ? value : 'both';
}
