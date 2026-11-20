import { prisma } from '@/lib/db';
import { dateOnlyToUtcDate } from '@/lib/date-only';
import { takeItEasyOf } from '@/lib/briefing/engine';
import {
  briefingUserSelect,
  loadSignalInputs,
  type BriefingUser,
  type SignalInputs,
} from '@/lib/briefing/inputs';
import { dateKeyInTimeZone } from '@/lib/briefing/schedule';
import {
  parseBriefingPreferences,
  type BriefingSource,
  type LowEnergyCheckIn,
  type TakeItEasy,
} from '@/lib/briefing/types';
import { localTimeIn, lowCheckInToday } from '@/lib/circadian-recommendations';

/**
 * "Take it easy today": the one notion the daily briefing and the circadian card share, so
 * the dashboard never says "go gently" in one card and "train harder" in the other.
 *
 * - The day is easy by the briefing's own rule (rules.ts `isTakeItEasyDay`): energy or
 *   recovery below usual, more symptoms than usual or short sleep, or, with circadian
 *   insights on, a low time-of-day energy check-in today by the rule the circadian card
 *   holds back on (lib/circadian-recommendations `lowCheckInToday`, in the profile time
 *   zone): for right now, or for an earlier slot while the current one is not rated yet.
 * - The briefing (lib/briefing/data) gets its inputs from `loadEasyDayInputs`, and the
 *   circadian card (lib/circadian-data) asks `loadEasyDay`, which runs the same check on
 *   the same inputs, so both cards always agree.
 *
 * Only the user's own rows are read, only from the sources the user lets the briefing read
 * (the briefing's own source switches), and nothing is stored. The one exception is the
 * low check-in today, which the circadian opt-in covers (see the notes in
 * lib/briefing/data). This module sits outside lib/briefing and lib/circadian-* so that
 * neither data layer imports the other.
 */

export type EasyDayInputs = SignalInputs & {
  lowEnergyToday: LowEnergyCheckIn | null;
};

/**
 * Today's low time-of-day energy check-in (`lowCheckInToday`): the same check-ins and the
 * same rule the circadian card holds back on.
 */
export async function loadLowCheckInToday(
  userId: string,
  timeZone: string,
  now: Date
): Promise<LowEnergyCheckIn | null> {
  const today = localTimeIn(now, timeZone).dateKey;
  const row = await prisma.journalEntry.findUnique({
    where: { userId_date: { userId, date: dateOnlyToUtcDate(today) } },
    select: { energyMorning: true, energyAfternoon: true, energyEvening: true },
  });
  return row ? lowCheckInToday([{ date: today, ...row }], now, timeZone) : null;
}

/**
 * Everything the take-it-easy check reads, for the briefing day `date`: the briefing's
 * journal, cycle and vitals inputs, and today's low energy check-in, if any. The check-in
 * is read while circadian insights are on, whatever the journal source, so the briefing
 * never pushes harder training next to the circadian card's "Running low right now".
 */
export async function loadEasyDayInputs(
  userId: string,
  user: BriefingUser,
  sources: ReadonlySet<BriefingSource>,
  date: string,
  now: Date
): Promise<EasyDayInputs> {
  const [inputs, lowEnergyToday] = await Promise.all([
    loadSignalInputs(userId, user, sources, date),
    user.enableCircadianInsights
      ? loadLowCheckInToday(userId, user.timezone, now)
      : null,
  ]);
  return { ...inputs, lowEnergyToday };
}

/**
 * Whether the daily briefing calls today a take-it-easy day for this user at `now`, and
 * why (null when it does not), whether or not the briefing card itself is shown (it can
 * be off or hidden for the day).
 */
export async function loadEasyDay(
  userId: string,
  now: Date = new Date()
): Promise<TakeItEasy | null> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: briefingUserSelect,
  });
  const preferences = parseBriefingPreferences(user);
  const today = dateKeyInTimeZone(now, user.timezone);
  const inputs = await loadEasyDayInputs(
    userId,
    user,
    new Set(preferences.sources),
    today,
    now
  );
  return takeItEasyOf({ today, ...inputs });
}
