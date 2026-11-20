import { format } from 'date-fns';
import type { CyclePhase } from '@/lib/cycle-calculator';
import { addDaysToDateOnly, dateOnlyToLocalDate } from '@/lib/date-only';
import { getDietaryRecommendations } from '@/lib/dietary-recommendations';
import { RECOVERY_ZONE_LABELS } from '@/lib/recovery';
import { isTakeItEasyDay, recentLogsSayTakeItEasy } from './rules';
import type { BriefingSignals, Comparison } from './signals';
import type {
  BriefingDetail,
  BriefingSuggestion,
  SuggestionKey,
} from './types';

/**
 * Step 4 of the briefing: wording. Turns a suggestion key plus the structured signals
 * into a title, body, evidence lines and a link.
 *
 * This is the only place that writes text, and it reads only the signals, so a
 * language-model phrasing layer could later take the same (key, signals, detail) and
 * rewrite the text, with these templates as the fallback. Nothing here calls out.
 *
 * Tone: friendly, encouraging and non-medical. Suggestions are general wellness ideas
 * that agree with the phase guidance already in the app (lib/dietary-recommendations,
 * the expert phase recommendations seeded in src/db/seed.ts, and the cycle disclaimer:
 * readiness and how you feel come first). No diagnoses, no promises.
 *
 * "brief" keeps each body to one or two sentences; "detailed" adds the how-to.
 */

type Phrased = Pick<
  BriefingSuggestion,
  'title' | 'body' | 'evidence' | 'action'
>;

/** 6.5 → "6.5", 6.04 → "6". */
export function formatNumber(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function phaseName(phase: CyclePhase): string {
  return `${phase} phase`;
}

/** "today", "yesterday" or "Nov 18". */
export function dayLabel(date: string, today: string): string {
  if (date === today) return 'today';
  if (date === addDaysToDateOnly(today, -1)) return 'yesterday';
  return format(dateOnlyToLocalDate(date), 'MMM d');
}

/** What a comparison was made against, for the middle of a sentence. */
export function baselinePhrase(comparison: Comparison): string {
  const where = comparison.phase
    ? `the ${phaseName(comparison.phase)}`
    : 'these days of your cycle';
  switch (comparison.source) {
    case 'phase':
      return `your usual for ${where}`;
    case 'typical':
      return `the typical pattern for ${where}`;
    case 'overall':
      return 'your usual';
  }
}

function energyEvidence(comparison: Comparison): string[] {
  const lines = [
    `Energy: ${formatNumber(comparison.actual)}/10 on average over your last ${comparison.days} check-ins.`,
  ];
  if (comparison.source === 'typical') {
    lines.push(
      `Compared with ${baselinePhrase(comparison)} (about ${formatNumber(comparison.expected)}/10). It becomes personal once you have 3 check-ins in a phase.`
    );
  } else {
    lines.push(
      `${capitalize(baselinePhrase(comparison))}: about ${formatNumber(comparison.expected)}/10.`
    );
  }
  return lines;
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function phaseEvidence(signals: BriefingSignals): string[] {
  const phase = signals.phase;
  if (!phase) return [];
  if (!phase.phase) {
    return [
      `Cycle day ${phase.cycleDay}, longer than your usual ${phase.typicalCycleLength} days, so no phase is estimated.`,
    ];
  }
  const confirmed = phase.temperatureConfirmed
    ? ', confirmed by your temperature shift'
    : '';
  return [
    `Cycle day ${phase.cycleDay}, ${phaseName(phase.phase)}${confirmed}.`,
  ];
}

function recoveryEvidence(signals: BriefingSignals): string[] {
  const recovery = signals.recovery;
  if (!recovery) return [];
  const { latest } = recovery;
  const lines = [
    `Recovery ${dayLabel(latest.date, signals.today)}: ${latest.score}/100 (${RECOVERY_ZONE_LABELS[latest.zone]}).`,
  ];
  if (latest.usualScore !== null) {
    const where =
      latest.comparedWith === 'phase' && latest.phase && signals.phase?.phase
        ? ` in the ${phaseName(latest.phase)}`
        : '';
    lines.push(`Your usual recovery${where}: about ${latest.usualScore}.`);
  }
  return lines;
}

function symptomEvidence(signals: BriefingSignals): string[] {
  const symptoms = signals.symptoms;
  if (!symptoms) return [];
  const { comparison } = symptoms;
  const lines = [
    `About ${formatNumber(comparison.actual)} symptoms a day over your last ${comparison.days} check-ins; ${baselinePhrase(comparison)} is about ${formatNumber(comparison.expected)}.`,
  ];
  if (symptoms.top.length > 0) {
    lines.push(`Most logged: ${symptoms.top.join(', ')}.`);
  }
  return lines;
}

function sleepEvidence(signals: BriefingSignals): string[] {
  const sleep = signals.sleep;
  if (!sleep) return [];
  return [
    `Sleep: ${formatNumber(sleep.meanHours)} hours a night on average over your last ${sleep.nights} logged nights.`,
  ];
}

function mealEvidence(signals: BriefingSignals): string[] {
  const meals = signals.meals;
  if (!meals) return [];
  if (meals.adherence !== null) {
    return [
      `${meals.recent.cooked} of ${meals.recent.planned} planned meals cooked in the last 3 days.`,
    ];
  }
  return [];
}

function phaseFoodHint(phase: CyclePhase | null | undefined): string {
  if (!phase) return '';
  const focus = getDietaryRecommendations(phase)?.focus ?? [];
  if (focus.length < 2) return '';
  return ` For your ${phaseName(phase)}, think ${focus[0]} and ${focus[1]}.`;
}

function withDetail(
  detail: BriefingDetail,
  brief: string,
  more: string
): string {
  return detail === 'detailed' ? `${brief} ${more}` : brief;
}

const ROUTINES_MODERATE = {
  href: '/routines?energy=medium',
  label: 'Browse moderate routines',
};
const ROUTINES_GENTLE = {
  href: '/routines?energy=low',
  label: 'Browse gentle routines',
};
const ROUTINES_ENERGIZING = {
  href: '/routines?energy=high',
  label: 'Browse energizing routines',
};
const MEAL_PLANNER = { href: '/meal-planner', label: 'Open meal planner' };
const RECIPES = { href: '/recipes', label: 'Browse recipes' };

const GO_FOR_IT_BODY: Record<CyclePhase | 'none', string> = {
  follicular:
    'Your energy has been strong, and many people feel their best in the follicular phase as estrogen rises. If you feel up for it, this is a good week for that more challenging routine.',
  ovulation:
    "Your energy has been high. Many people feel strong around ovulation, so if you do too, it's a good time for a demanding session.",
  menstrual:
    "Your energy has been good during your period. If you're comfortable, there's no need to hold back: some people feel strong now. Let how you feel lead.",
  luteal:
    'Your energy has held up well. If training feels good, keep going as usual and give yourself a little extra recovery time.',
  none: "Your energy has been above your usual. If you feel up for it, it's a good time for a more challenging routine.",
};

export function phraseSuggestion(
  key: SuggestionKey,
  signals: BriefingSignals,
  detail: BriefingDetail
): Phrased {
  const phase = signals.phase?.phase;
  switch (key) {
    case 'routine.ease-intensity': {
      const comparison = signals.energy?.comparison;
      const against = comparison ? baselinePhrase(comparison) : 'your usual';
      return {
        title: 'Swap high intensity for moderate this week',
        body: withDetail(
          detail,
          `Your energy has been lower than ${against}. Moderate routines like a brisk walk, pilates or a lighter strength session may suit you better right now.`,
          'Matching effort to how you feel helps you stay consistent. Build back up when your energy returns.'
        ),
        evidence: [
          ...(comparison ? energyEvidence(comparison) : []),
          ...(signals.mood?.low
            ? [
                `Mood: ${formatNumber(signals.mood.comparison.actual)}/10, below ${baselinePhrase(signals.mood.comparison)} (about ${formatNumber(signals.mood.comparison.expected)}).`,
              ]
            : []),
          ...phaseEvidence(signals),
        ],
        action: ROUTINES_MODERATE,
      };
    }
    case 'routine.go-for-it':
      return {
        title: 'Good energy: try a more challenging routine',
        body: withDetail(
          detail,
          GO_FOR_IT_BODY[phase ?? 'none'],
          'Warm up well and ease off if something does not feel right.'
        ),
        evidence: [
          ...(signals.energy ? energyEvidence(signals.energy.comparison) : []),
          ...(signals.recovery?.good ? recoveryEvidence(signals) : []),
          ...phaseEvidence(signals),
        ],
        action: ROUTINES_ENERGIZING,
      };
    case 'recovery.rest-day': {
      const recovery = signals.recovery;
      // The phase is named only while the briefing shows one (cycle source on, phase known).
      const forPhase =
        recovery?.latest.comparedWith === 'phase' && phase
          ? ' for this phase'
          : '';
      return {
        title: 'Consider adding a rest day',
        body: withDetail(
          detail,
          `Your recovery scores have been below your usual${forPhase}. A rest day or gentle movement like walking or stretching, plus an early night, can help you bounce back.`,
          "Your recovery score compares your heart rate, HRV and sleep with your own usual levels. It's a nudge to listen to your body, not a medical measure."
        ),
        evidence: recoveryEvidence(signals),
        action: ROUTINES_GENTLE,
      };
    }
    case 'recovery.well-recovered':
      return {
        title: 'Great recovery this week',
        body: withDetail(
          detail,
          "Your recovery scores are at or above your usual. You're well placed for higher-intensity training if you feel like it.",
          'Keep doing what is working: steady sleep and regular meals make a real difference.'
        ),
        evidence: recoveryEvidence(signals),
        action: null,
      };
    case 'recovery.sleep': {
      const sleep = signals.sleep;
      const hours = sleep ? formatNumber(sleep.meanHours) : 'fewer than 7';
      return {
        title: 'Protect your sleep tonight',
        body: withDetail(
          detail,
          `You've averaged ${hours} hours of sleep over the last few nights. Most adults feel and recover best with at least 7, so an earlier, regular bedtime can help.`,
          'A short wind-down without screens and a cool, dark room make it easier to fall asleep.'
        ),
        evidence: sleepEvidence(signals),
        action: null,
      };
    }
    case 'recovery.gentle-symptoms': {
      const comparison = signals.symptoms?.comparison;
      const against = comparison
        ? ` than ${baselinePhrase(comparison)}`
        : ' than usual';
      return {
        title: 'Go gently: more symptoms than usual',
        body: withDetail(
          detail,
          `You've logged more symptoms${against}. Gentle movement, warmth, rest and regular meals may help you feel more comfortable. If symptoms worry you or keep getting worse, check in with a healthcare professional.`,
          "Your journal keeps a record of them, so it's easy to share the pattern with a professional if you'd like to."
        ),
        evidence: [...symptomEvidence(signals), ...phaseEvidence(signals)],
        action: ROUTINES_GENTLE,
      };
    }
    case 'meal.iron': {
      const duringPeriod = phase === 'menstrual';
      return {
        title: duringPeriod
          ? 'Add iron-rich foods'
          : 'Prioritise iron-rich recipes this week',
        body: withDetail(
          detail,
          duringPeriod
            ? 'Your body loses some iron with your period. Iron-rich foods like lentils, beans, spinach, tofu, eggs or red meat help replace it.'
            : 'Your period has just ended, so this is a good week for iron-rich recipes like lentil stews, bean chilli, spinach dishes or red meat.',
          'Pair plant sources with vitamin C (citrus, peppers, tomatoes) to absorb more of their iron.'
        ),
        evidence: [
          ...phaseEvidence(signals),
          ...(signals.energy?.low
            ? energyEvidence(signals.energy.comparison)
            : []),
        ],
        action: RECIPES,
      };
    }
    case 'meal.magnesium':
      return {
        title: 'Lean on magnesium-rich foods',
        body: withDetail(
          detail,
          'In the luteal phase, magnesium-rich foods like leafy greens, nuts, seeds, beans, whole grains and dark chocolate are an easy way to support your mood and energy. Complex carbs can help with cravings too.',
          'Try a handful of pumpkin seeds or almonds as a snack, or a side of greens with dinner.'
        ),
        evidence: [
          ...phaseEvidence(signals),
          ...(signals.symptoms?.elevated ? symptomEvidence(signals) : []),
        ],
        action: RECIPES,
      };
    case 'meal.follicular-foods':
      return {
        title: 'Fresh, light meals suit the follicular phase',
        body: withDetail(
          detail,
          'Light proteins, fermented foods like yogurt or kimchi, and leafy greens fit this phase well as your energy builds.',
          'Plenty of water helps too.'
        ),
        evidence: phaseEvidence(signals),
        action: MEAL_PLANNER,
      };
    case 'meal.ovulation-foods':
      return {
        title: 'Fibre and fluids around ovulation',
        body: withDetail(
          detail,
          'Raw vegetables, seeds and fermented foods are a good fit around ovulation. Keep a water bottle handy too.',
          'A big salad with seeds and a protein makes an easy lunch.'
        ),
        evidence: phaseEvidence(signals),
        action: MEAL_PLANNER,
      };
    case 'meal.plan-ahead':
      return {
        title: 'Plan a few meals for the next days',
        body: withDetail(
          detail,
          "There's nothing on your meal plan for today or the next 2 days. Planning 2-3 simple meals makes it easier to eat well when you're busy.",
          phaseFoodHint(phase).trim() ||
            'Pick recipes you can cook in under 30 minutes.'
        ),
        evidence: ['No meals planned for today or the next 2 days.'],
        action: MEAL_PLANNER,
      };
    case 'meal.adherence-slipping':
      return {
        title: 'Make your meal plan easier to follow',
        body: withDetail(
          detail,
          `You cooked ${signals.meals?.recent.cooked ?? 0} of ${signals.meals?.recent.planned ?? 0} planned meals over the last 3 days. Swapping in a couple of quicker recipes can make the plan easier to stick to.`,
          'Planning fewer, simpler meals still counts as a win.'
        ),
        evidence: mealEvidence(signals),
        action: MEAL_PLANNER,
      };
    case 'meal.adherence-good':
      return {
        title: 'Nice work sticking to your meal plan',
        body: withDetail(
          detail,
          `You cooked ${signals.meals?.recent.cooked ?? 0} of ${signals.meals?.recent.planned ?? 0} planned meals over the last 3 days. Keep it up!`,
          'Planning ahead like this makes busy days easier.'
        ),
        evidence: mealEvidence(signals),
        action: null,
      };
  }
}

/**
 * One friendly sentence at the top of the card. Its tone follows `isTakeItEasyDay`, the
 * same check that keeps "train harder" suggestions off a gentler day.
 */
export function buildHeadline(signals: BriefingSignals): string {
  if (isTakeItEasyDay(signals)) {
    if (recentLogsSayTakeItEasy(signals)) {
      return "A gentler day may suit you. Here's what your recent logs suggest.";
    }
    // A low check-in adds no suggestion of its own, so the headline says why. Only the
    // current slot's rating is "right now": an earlier one can be hours old.
    return signals.lowEnergyToday === 'now'
      ? 'You rated your energy as low right now, so this briefing keeps things gentle.'
      : 'You rated your energy as low earlier today, so this briefing keeps things gentle.';
  }
  if ((signals.energy?.good ?? false) || (signals.recovery?.good ?? false)) {
    return "You've been doing well lately. Here's how to make the most of it.";
  }
  if (signals.checkInDays === 0) {
    return 'Check in with your journal to make your briefing more personal.';
  }
  if (signals.phase?.phase) {
    return `Here are a few ideas for your ${phaseName(signals.phase.phase)}.`;
  }
  return 'Here are a few ideas for today.';
}

/**
 * The caveat shown next to the cycle day when the current cycle is longer than usual.
 * Always visible (not only in the details), because the phase and the phase-based ideas
 * depend on it.
 */
export function buildPhaseNote(signals: BriefingSignals): string | null {
  const phase = signals.phase;
  if (!phase?.pastTypicalLength) return null;
  if (!phase.phase) {
    return `Day ${phase.cycleDay} is longer than your usual ${phase.typicalCycleLength}-day cycle, so phase-based ideas are paused. If your period has started, log it on the cycle page.`;
  }
  return `You're on cycle day ${phase.cycleDay}, past your usual ${phase.typicalCycleLength}-day cycle. When your period starts, log it on the cycle page so your phases stay accurate.`;
}

/** Notes about missing or limited data (shown in the card's details; see buildPhaseNote). */
export function buildNotes(signals: BriefingSignals): string[] {
  const notes: string[] = [];
  if (signals.checkInDays === 0) {
    notes.push(
      (signals.energyCheckInDays ?? 0) > 0
        ? 'Your last 3 days have only energy check-ins by time of day, so mood, sleep, symptoms and your daily energy are not part of this briefing. Log them in your journal to make it more personal.'
        : 'No journal check-ins in the last 3 days, so energy, sleep and symptoms are not part of this briefing. Log how you feel to make it more personal.'
    );
  }
  if (signals.energy?.comparison.source === 'typical') {
    notes.push(
      'Energy is compared with a typical pattern until you have 3 journal check-ins in a phase; after that, with your own usual.'
    );
  }
  return notes;
}
