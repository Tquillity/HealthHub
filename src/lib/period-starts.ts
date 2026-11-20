import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { dateOnlyToUtcDate, toDateOnlyString } from '@/lib/date-only';

/**
 * Period history (PeriodStart rows) and its mirror User.lastPeriodDate.
 *
 * Invariant kept by every write here: lastPeriodDate is the latest logged period start
 * (or null when tracking was cleared). The migration backfilled one row per user that
 * already had a lastPeriodDate.
 */

type Db = Prisma.TransactionClient;

export type PeriodStartChange = {
  /** The user's lastPeriodDate after the change (`YYYY-MM-DD`), or null. */
  lastPeriodDate: string | null;
};

/** Logged period starts, oldest first (`YYYY-MM-DD`). */
export async function listPeriodStartDates(
  userId: string,
  db: Db = prisma
): Promise<string[]> {
  const rows = await db.periodStart.findMany({
    where: { userId },
    select: { date: true },
    orderBy: { date: 'asc' },
  });
  return rows.map((row) => toDateOnlyString(row.date));
}

async function latestPeriodStart(db: Db, userId: string): Promise<Date | null> {
  const latest = await db.periodStart.findFirst({
    where: { userId },
    orderBy: { date: 'desc' },
    select: { date: true },
  });
  return latest?.date ?? null;
}

async function upsertPeriodStart(
  db: Db,
  userId: string,
  date: Date
): Promise<void> {
  await db.periodStart.upsert({
    where: { userId_date: { userId, date } },
    create: { userId, date },
    update: {},
  });
}

/**
 * "My period started on <date>" (cycle page). Records the start and moves lastPeriodDate
 * forward only if the new date is newer, so logging a past period never rewinds the
 * current cycle.
 */
export async function recordPeriodStart(
  userId: string,
  dateKey: string
): Promise<PeriodStartChange> {
  const date = dateOnlyToUtcDate(dateKey);
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({
      where: { id: userId },
      select: { lastPeriodDate: true },
    });
    await upsertPeriodStart(tx, userId, date);
    const current = user.lastPeriodDate;
    if (current && current >= date) {
      return { lastPeriodDate: toDateOnlyString(current) };
    }
    await tx.user.update({
      where: { id: userId },
      data: { lastPeriodDate: date },
    });
    return { lastPeriodDate: dateKey };
  });
}

/**
 * Removes a mistaken period start. When it was the current one, lastPeriodDate falls back
 * to the latest remaining start (or null when none is left).
 */
export async function removePeriodStart(
  userId: string,
  dateKey: string
): Promise<PeriodStartChange & { removed: boolean }> {
  const date = dateOnlyToUtcDate(dateKey);
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({
      where: { id: userId },
      select: { lastPeriodDate: true },
    });
    const { count } = await tx.periodStart.deleteMany({
      where: { userId, date },
    });
    const current = user.lastPeriodDate;
    const removedCurrent =
      current !== null && toDateOnlyString(current) === dateKey;
    if (count === 0 || !removedCurrent) {
      return {
        removed: count > 0,
        lastPeriodDate: current ? toDateOnlyString(current) : null,
      };
    }
    const latest = await latestPeriodStart(tx, userId);
    await tx.user.update({
      where: { id: userId },
      data: { lastPeriodDate: latest },
    });
    return {
      removed: true,
      lastPeriodDate: latest ? toDateOnlyString(latest) : null,
    };
  });
}

/**
 * Profile "Last period start date" edits the latest period start:
 * - a later date (or the first one) is a new period: it is added to the history;
 * - an earlier date corrects the current start: the old current start is replaced.
 * Returns the resulting lastPeriodDate (the latest logged start). Use inside the
 * profile update's transaction.
 */
export async function setLatestPeriodStartFromProfile(
  tx: Db,
  userId: string,
  dateKey: string
): Promise<Date> {
  const date = dateOnlyToUtcDate(dateKey);
  const user = await tx.user.findUniqueOrThrow({
    where: { id: userId },
    select: { lastPeriodDate: true },
  });
  const current = user.lastPeriodDate;
  if (current && toDateOnlyString(current) > dateKey) {
    await tx.periodStart.deleteMany({
      where: { userId, date: dateOnlyToUtcDate(toDateOnlyString(current)) },
    });
  }
  await upsertPeriodStart(tx, userId, date);
  return (await latestPeriodStart(tx, userId)) ?? date;
}
