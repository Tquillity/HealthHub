import { prisma } from '@/lib/db';
import { dateOnlyToUtcDate } from '@/lib/date-only';
import { isTakeItEasyInput } from '@/lib/briefing/engine';
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
} from '@/lib/briefing/types';
import {
  energyNowFrom,
  isLowEnergy,
  localTimeIn,
} from '@/lib/circadian-recommendations';

/**
 * "Take it easy today": the one notion the daily briefing and the circadian card share, so
 * the dashboard never says "go gently" in one card and "train harder" in the other.
 *
 * - The day is easy by the briefing's own rule (rules.ts `isTakeItEasyDay`): energy or
 *   recovery below usual, more symptoms than usual or short sleep, or, with circadian
 *   insights on, a time-of-day energy check-in at or below LOW_ENERGY_RATING for right now
 *   (the circadian card's "Running low right now", in the profile time zone).
 * - The briefing (lib/briefing/data) gets its inputs from `loadEasyDayInputs`, and the
 *   circadian card (lib/circadian-data) asks `loadEasyDay`, which runs the same check on
 *   the same inputs, so both cards always agree.
 *
 * Only the user's own rows are read, only from the sources the user lets the briefing read
 * (the briefing's own source switches), and nothing is stored. This module sits outside
 * lib/briefing and lib/circadian-* so that neither data layer imports the other.
 */

export type EasyDayInputs = SignalInputs & { lowEnergyNow: boolean };

/**
 * Today's time-of-day energy check-in for right now is at or below LOW_ENERGY_RATING:
 * the same check-in and the same rule as the circadian card's "Running low right now".
 */
export async function loadLowEnergyNow(
  userId: string,
  timeZone: string,
  now: Date
): Promise<boolean> {
  const today = localTimeIn(now, timeZone).dateKey;
  const row = await prisma.journalEntry.findUnique({
    where: { userId_date: { userId, date: dateOnlyToUtcDate(today) } },
    select: { energyMorning: true, energyAfternoon: true, energyEvening: true },
  });
  if (!row) return false;
  return isLowEnergy(energyNowFrom([{ date: today, ...row }], now, timeZone));
}

/**
 * Everything the take-it-easy check reads, for the briefing day `date`: the briefing's
 * journal, cycle and vitals inputs, and whether the user rated their energy as low right
 * now. That check-in is journal data, so it is read only with the journal source on, and
 * only while circadian insights are on.
 */
export async function loadEasyDayInputs(
  userId: string,
  user: BriefingUser,
  sources: ReadonlySet<BriefingSource>,
  date: string,
  now: Date
): Promise<EasyDayInputs> {
  const [inputs, lowEnergyNow] = await Promise.all([
    loadSignalInputs(userId, user, sources, date),
    sources.has('journal') && user.enableCircadianInsights
      ? loadLowEnergyNow(userId, user.timezone, now)
      : false,
  ]);
  return { ...inputs, lowEnergyNow };
}

/**
 * Whether the daily briefing calls today a take-it-easy day for this user at `now`,
 * whether or not the briefing card itself is shown (it can be off or hidden for the day).
 */
export async function loadEasyDay(
  userId: string,
  now: Date = new Date()
): Promise<boolean> {
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
  return isTakeItEasyInput({ today, ...inputs });
}
