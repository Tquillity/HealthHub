'use server';

import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireSessionUserId } from '@/lib/session';
import { revalidatePath } from 'next/cache';
import { encrypt, decrypt, encryptArray, decryptArray } from '@/lib/encryption';
import { DateOnlyStringSchema, dateOnlyToUtcDate } from '@/lib/date-only';

// Zod schemas
// Every item is encrypted individually, so bound list and text sizes to keep saves cheap.
const JournalText = z.string().max(10_000);
const JournalList = z.array(z.string().max(500)).max(50).default([]);

// Scalars and text: `undefined` = leave unchanged, `null` = clear the stored value.
// Lists: always replaced (an empty array clears them).
const CreateJournalSchema = z.object({
  // Local calendar day as YYYY-MM-DD; stored as UTC midnight (see lib/date-only).
  date: DateOnlyStringSchema,
  mood: z.number().int().min(1).max(10).nullable().optional(),
  energy: z.number().int().min(1).max(10).nullable().optional(),
  sleepHours: z.number().positive().max(24).nullable().optional(),
  notes: JournalText.nullable().optional(),
  tags: JournalList,
  // Gratitude
  gratitudeEntries: JournalList,
  gratitudeNotes: JournalText.nullable().optional(),
  // Goals
  goalsAchieved: JournalList,
  goalsProgress: JournalList,
  goalsNotes: JournalText.nullable().optional(),
  // Symptoms
  symptomsPhysical: JournalList,
  symptomsMental: JournalList,
  symptomsNotes: JournalText.nullable().optional(),
});

/** `undefined` keeps the stored value; `null` or '' clears it (encrypt returns null for empty). */
function encryptField(
  value: string | null | undefined
): string | null | undefined {
  return value === undefined ? undefined : encrypt(value);
}

export async function logJournalEntry(
  data: z.infer<typeof CreateJournalSchema>
) {
  try {
    const authResult = await requireSessionUserId();
    if (!authResult.ok) {
      return { success: false, error: authResult.error };
    }

    // Validate input
    const validated = CreateJournalSchema.parse(data);

    const date = dateOnlyToUtcDate(validated.date);

    // Encrypt sensitive fields before storing (GDPR compliance).
    // encryptArray returns null for an empty list, so fall back to [] to clear it.
    const fields = {
      mood: validated.mood,
      energy: validated.energy,
      sleepHours: validated.sleepHours,
      notes: encryptField(validated.notes),
      tags: validated.tags,
      gratitudeEntries: encryptArray(validated.gratitudeEntries) ?? [],
      gratitudeNotes: encryptField(validated.gratitudeNotes),
      goalsAchieved: encryptArray(validated.goalsAchieved) ?? [],
      goalsProgress: encryptArray(validated.goalsProgress) ?? [],
      goalsNotes: encryptField(validated.goalsNotes),
      symptomsPhysical: encryptArray(validated.symptomsPhysical) ?? [],
      symptomsMental: encryptArray(validated.symptomsMental) ?? [],
      symptomsNotes: encryptField(validated.symptomsNotes),
    };

    // Upsert entry (create or update if exists for this date)
    const entry = await prisma.journalEntry.upsert({
      where: {
        userId_date: {
          userId: authResult.userId,
          date: date,
        },
      },
      update: fields,
      create: {
        userId: authResult.userId,
        date: date,
        ...fields,
      },
    });

    // Decrypt sensitive fields before returning to client
    const decryptedEntry = {
      ...entry,
      notes: decrypt(entry.notes),
      gratitudeNotes: decrypt(entry.gratitudeNotes),
      goalsNotes: decrypt(entry.goalsNotes),
      symptomsNotes: decrypt(entry.symptomsNotes),
      gratitudeEntries: decryptArray(entry.gratitudeEntries),
      goalsAchieved: decryptArray(entry.goalsAchieved),
      goalsProgress: decryptArray(entry.goalsProgress),
      symptomsPhysical: decryptArray(entry.symptomsPhysical),
      symptomsMental: decryptArray(entry.symptomsMental),
    };

    revalidatePath('/journal');
    return { success: true, data: decryptedEntry };
  } catch (error) {
    if (error instanceof z.ZodError) {
      // Zod v4 uses `issues` (Zod v3 used `errors`)
      return {
        success: false,
        error: error.issues?.[0]?.message || 'Validation failed',
      };
    }
    console.error('Error logging journal entry:', error);
    return { success: false, error: 'Failed to log journal entry' };
  }
}

export async function getMonthlyStats(month: number, year: number) {
  try {
    const authResult = await requireSessionUserId();
    if (!authResult.ok) {
      return { success: false, error: authResult.error, data: null };
    }

    const parsed = z
      .object({
        month: z.number().int().min(1).max(12),
        year: z.number().int().min(1900).max(9999),
      })
      .safeParse({ month, year });
    if (!parsed.success) {
      return { success: false, error: 'Invalid month', data: null };
    }

    // Entry dates are UTC midnight, so the month range is in UTC too.
    const monthStart = new Date(
      Date.UTC(parsed.data.year, parsed.data.month - 1, 1)
    );
    const monthEnd = new Date(Date.UTC(parsed.data.year, parsed.data.month, 1));

    // Fetch all entries for this month
    const entries = await prisma.journalEntry.findMany({
      where: {
        userId: authResult.userId,
        date: {
          gte: monthStart,
          lt: monthEnd,
        },
      },
      orderBy: {
        date: 'asc',
      },
    });

    // Aggregate stats
    const stats = {
      entries: entries.map((e) => ({
        date: e.date,
        mood: e.mood,
        energy: e.energy,
        sleepHours: e.sleepHours,
      })),
      averageMood:
        entries.length > 0 && entries.some((e) => e.mood !== null)
          ? entries.reduce((sum, e) => sum + (e.mood ?? 0), 0) /
            entries.filter((e) => e.mood !== null).length
          : null,
      averageEnergy:
        entries.length > 0 && entries.some((e) => e.energy !== null)
          ? entries.reduce((sum, e) => sum + (e.energy ?? 0), 0) /
            entries.filter((e) => e.energy !== null).length
          : null,
      averageSleep:
        entries.length > 0 && entries.some((e) => e.sleepHours !== null)
          ? entries.reduce((sum, e) => sum + (e.sleepHours ?? 0), 0) /
            entries.filter((e) => e.sleepHours !== null).length
          : null,
    };

    return { success: true, error: null, data: stats };
  } catch (error) {
    console.error('Error fetching monthly stats:', error);
    return {
      success: false,
      error: 'Failed to fetch monthly stats',
      data: null,
    };
  }
}

/**
 * Get journal entry by date
 */
export async function getJournalEntryByDate(date: string) {
  try {
    const authResult = await requireSessionUserId();
    if (!authResult.ok) {
      return { success: false, error: authResult.error, data: null };
    }

    const parsedDate = DateOnlyStringSchema.safeParse(date);
    if (!parsedDate.success) {
      return { success: false, error: 'Invalid date', data: null };
    }
    const entryDate = dateOnlyToUtcDate(parsedDate.data);

    const entry = await prisma.journalEntry.findUnique({
      where: {
        userId_date: {
          userId: authResult.userId,
          date: entryDate,
        },
      },
    });

    if (!entry) {
      return { success: true, data: null };
    }

    // Decrypt sensitive fields before returning to client
    const decryptedEntry = {
      ...entry,
      notes: decrypt(entry.notes),
      gratitudeNotes: decrypt(entry.gratitudeNotes),
      goalsNotes: decrypt(entry.goalsNotes),
      symptomsNotes: decrypt(entry.symptomsNotes),
      gratitudeEntries: decryptArray(entry.gratitudeEntries),
      goalsAchieved: decryptArray(entry.goalsAchieved),
      goalsProgress: decryptArray(entry.goalsProgress),
      symptomsPhysical: decryptArray(entry.symptomsPhysical),
      symptomsMental: decryptArray(entry.symptomsMental),
    };

    return { success: true, data: decryptedEntry };
  } catch (error) {
    console.error('Error fetching journal entry:', error);
    return {
      success: false,
      error: 'Failed to fetch journal entry',
      data: null,
    };
  }
}

/**
 * Delete journal entry
 */
export async function deleteJournalEntry(date: string) {
  try {
    const authResult = await requireSessionUserId();
    if (!authResult.ok) {
      return { success: false, error: authResult.error };
    }

    const parsedDate = DateOnlyStringSchema.safeParse(date);
    if (!parsedDate.success) {
      return { success: false, error: 'Invalid date' };
    }
    const entryDate = dateOnlyToUtcDate(parsedDate.data);

    await prisma.journalEntry.delete({
      where: {
        userId_date: {
          userId: authResult.userId,
          date: entryDate,
        },
      },
    });

    revalidatePath('/journal');
    return { success: true };
  } catch (error) {
    console.error('Error deleting journal entry:', error);
    return { success: false, error: 'Failed to delete journal entry' };
  }
}

/**
 * Get journal snippet for a specific date
 * Optimized for Quick Look previews - only fetches essential fields
 *
 * @param date - ISO date string (YYYY-MM-DD format)
 * @returns Lightweight object with mood, energy, and truncated notes (first 100 chars)
 */
export async function getJournalSnippet(date: string) {
  try {
    const authResult = await requireSessionUserId();
    if (!authResult.ok) {
      return { success: false, error: authResult.error, data: null };
    }

    const parsedDate = DateOnlyStringSchema.safeParse(date);
    if (!parsedDate.success) {
      return { success: false, error: 'Invalid date', data: null };
    }
    const entryDate = dateOnlyToUtcDate(parsedDate.data);

    // Use select to only fetch required fields for performance
    const entry = await prisma.journalEntry.findUnique({
      where: {
        userId_date: {
          userId: authResult.userId,
          date: entryDate,
        },
      },
      select: {
        date: true,
        mood: true,
        energy: true,
        notes: true,
      },
    });

    if (!entry) {
      return { success: true, data: null }; // No entry exists for this date
    }

    // Decrypt notes before truncating
    const decryptedNotes = decrypt(entry.notes);

    // Truncate notes to first 100 characters for preview
    const notesSnippet = decryptedNotes
      ? decryptedNotes.length > 100
        ? decryptedNotes.substring(0, 100) + '...'
        : decryptedNotes
      : null;

    return {
      success: true,
      data: {
        date: entry.date,
        mood: entry.mood,
        energy: entry.energy,
        notesSnippet,
      },
    };
  } catch (error) {
    console.error('Error fetching journal snippet:', error);
    return {
      success: false,
      error: 'Failed to fetch journal snippet',
      data: null,
    };
  }
}
