import type { OrganizationType } from '@prisma/client';
import { prisma } from '@/lib/db';
import { decrypt, decryptArray } from '@/lib/encryption';
import { dateOnlyToUtcDate, toDateOnlyString } from '@/lib/date-only';
import { getMembershipIn } from '@/lib/active-organization';
import {
  canShareJournalWith,
  canViewSharedJournals,
  ORGANIZATION_TYPES,
} from '@/lib/org-policy';

/**
 * Journal sharing (issue #11). Entries are private by default. The author can share one day's
 * entry with one household or collective they belong to, and take it back at any time.
 * Communities and workplaces never see individual journals.
 *
 * Reads return only entries that were explicitly shared with that organization by people who
 * are still members, decrypted on the server. Nothing hidden is sent to the browser.
 */

export type Result<T> = { ok: true; data: T } | { ok: false; error: string };

export type JournalShareTarget = { id: string; name: string; type: OrganizationType };

const SHAREABLE_TYPES = ORGANIZATION_TYPES.filter(canShareJournalWith);

/** Organizations the user may share journal entries with. */
export async function getJournalShareTargets(userId: string): Promise<JournalShareTarget[]> {
  const rows = await prisma.member.findMany({
    where: { userId, organization: { type: { in: SHAREABLE_TYPES } } },
    select: { organization: { select: { id: true, name: true, type: true } } },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });
  const byId = new Map(rows.map((row) => [row.organization.id, row.organization]));
  return [...byId.values()];
}

export type JournalSharing = {
  visibility: 'PRIVATE' | 'ORGANIZATION';
  sharedOrganizationId: string | null;
};

/**
 * Share the user's entry for `dateKey` (YYYY-MM-DD) with `organizationId`, or make it private
 * again with null. Only touches the sharing fields, never the entry's content.
 */
export async function setJournalEntrySharing(
  userId: string,
  dateKey: string,
  organizationId: string | null
): Promise<Result<JournalSharing>> {
  const date = dateOnlyToUtcDate(dateKey);
  const entry = await prisma.journalEntry.findUnique({
    where: { userId_date: { userId, date } },
    select: { id: true },
  });
  if (!entry) return { ok: false, error: 'Save this journal entry before sharing it.' };

  if (organizationId) {
    const membership = await getMembershipIn(userId, organizationId);
    if (!membership) return { ok: false, error: 'You are not a member of that space.' };
    if (!canShareJournalWith(membership.organization.type)) {
      return {
        ok: false,
        error: 'Journal entries can only be shared with a household or collective.',
      };
    }
  }

  const updated = await prisma.journalEntry.update({
    where: { id: entry.id },
    data: organizationId
      ? { visibility: 'ORGANIZATION', sharedOrganizationId: organizationId }
      : { visibility: 'PRIVATE', sharedOrganizationId: null },
    select: { visibility: true, sharedOrganizationId: true },
  });
  return { ok: true, data: updated };
}

export type SharedJournalEntry = {
  id: string;
  date: string;
  authorName: string;
  isYours: boolean;
  mood: number | null;
  energy: number | null;
  sleepHours: number | null;
  notes: string | null;
  tags: string[];
  gratitudeEntries: string[];
  gratitudeNotes: string | null;
  goalsAchieved: string[];
  goalsProgress: string[];
  goalsNotes: string | null;
  symptomsPhysical: string[];
  symptomsMental: string[];
  symptomsNotes: string | null;
};

/** How many recent shared days the household page shows. */
export const SHARED_JOURNAL_LIMIT = 30;

/**
 * Entries shared with `organizationId`, for a member of it. Empty for non-members and for
 * communities and workplaces, whatever the rows say.
 */
export async function getSharedJournalEntries(
  userId: string,
  organizationId: string
): Promise<SharedJournalEntry[]> {
  const membership = await getMembershipIn(userId, organizationId);
  if (!membership || !canViewSharedJournals(membership.organization.type)) return [];

  const rows = await prisma.journalEntry.findMany({
    where: {
      visibility: 'ORGANIZATION',
      sharedOrganizationId: organizationId,
      // The author must still be a member; leaving also unshares, this is the backstop.
      user: { members: { some: { organizationId } } },
    },
    include: { user: { select: { name: true } } },
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    take: SHARED_JOURNAL_LIMIT,
  });

  return rows.map((row) => ({
    id: row.id,
    date: toDateOnlyString(row.date),
    authorName: row.user.name,
    isYours: row.userId === userId,
    mood: row.mood,
    energy: row.energy,
    sleepHours: row.sleepHours,
    notes: decrypt(row.notes),
    tags: row.tags,
    gratitudeEntries: decryptArray(row.gratitudeEntries),
    gratitudeNotes: decrypt(row.gratitudeNotes),
    goalsAchieved: decryptArray(row.goalsAchieved),
    goalsProgress: decryptArray(row.goalsProgress),
    goalsNotes: decrypt(row.goalsNotes),
    symptomsPhysical: decryptArray(row.symptomsPhysical),
    symptomsMental: decryptArray(row.symptomsMental),
    symptomsNotes: decrypt(row.symptomsNotes),
  }));
}
