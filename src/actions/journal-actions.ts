'use server';

import { z } from 'zod';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { startOfMonth, endOfMonth } from 'date-fns';
import { encrypt, decrypt, encryptArray, decryptArray } from '@/lib/encryption';

// Zod schemas
const CreateJournalSchema = z.object({
  date: z.string().or(z.date()), // Accept ISO string or Date
  mood: z.number().int().min(1).max(10).optional(),
  energy: z.number().int().min(1).max(10).optional(),
  sleepHours: z.number().positive().max(24).optional(),
  notes: z.string().optional(),
  tags: z.array(z.string()).default([]),
  // Gratitude
  gratitudeEntries: z.array(z.string()).default([]),
  gratitudeNotes: z.string().optional(),
  // Goals
  goalsAchieved: z.array(z.string()).default([]),
  goalsProgress: z.array(z.string()).default([]),
  goalsNotes: z.string().optional(),
  // Symptoms
  symptomsPhysical: z.array(z.string()).default([]),
  symptomsMental: z.array(z.string()).default([]),
  symptomsNotes: z.string().optional(),
});

export async function logJournalEntry(data: z.infer<typeof CreateJournalSchema>) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return { success: false, error: 'Unauthorized' };
    }

    // Validate input
    const validated = CreateJournalSchema.parse(data);

    // Normalize date to start of day (YYYY-MM-DD)
    const date = typeof validated.date === 'string' 
      ? new Date(validated.date) 
      : validated.date;
    date.setHours(0, 0, 0, 0);

    // Encrypt sensitive fields before storing (GDPR compliance)
    const encryptedNotes = encrypt(validated.notes);
    const encryptedGratitudeNotes = encrypt(validated.gratitudeNotes);
    const encryptedGoalsNotes = encrypt(validated.goalsNotes);
    const encryptedSymptomsNotes = encrypt(validated.symptomsNotes);
    const encryptedGratitudeEntries = encryptArray(validated.gratitudeEntries);
    const encryptedGoalsAchieved = encryptArray(validated.goalsAchieved);
    const encryptedGoalsProgress = encryptArray(validated.goalsProgress);
    const encryptedSymptomsPhysical = encryptArray(validated.symptomsPhysical);
    const encryptedSymptomsMental = encryptArray(validated.symptomsMental);

    // Upsert entry (create or update if exists for this date)
    const entry = await prisma.journalEntry.upsert({
      where: {
        userId_date: {
          userId: session.user.id,
          date: date,
        },
      },
      update: {
        mood: validated.mood ?? undefined,
        energy: validated.energy ?? undefined,
        sleepHours: validated.sleepHours ?? undefined,
        notes: encryptedNotes ?? undefined,
        tags: validated.tags,
        gratitudeEntries: encryptedGratitudeEntries ?? validated.gratitudeEntries,
        gratitudeNotes: encryptedGratitudeNotes ?? undefined,
        goalsAchieved: encryptedGoalsAchieved ?? validated.goalsAchieved,
        goalsProgress: encryptedGoalsProgress ?? validated.goalsProgress,
        goalsNotes: encryptedGoalsNotes ?? undefined,
        symptomsPhysical: encryptedSymptomsPhysical ?? validated.symptomsPhysical,
        symptomsMental: encryptedSymptomsMental ?? validated.symptomsMental,
        symptomsNotes: encryptedSymptomsNotes ?? undefined,
      },
      create: {
        userId: session.user.id,
        date: date,
        mood: validated.mood ?? undefined,
        energy: validated.energy ?? undefined,
        sleepHours: validated.sleepHours ?? undefined,
        notes: encryptedNotes ?? undefined,
        tags: validated.tags,
        gratitudeEntries: encryptedGratitudeEntries ?? validated.gratitudeEntries,
        gratitudeNotes: encryptedGratitudeNotes ?? undefined,
        goalsAchieved: encryptedGoalsAchieved ?? validated.goalsAchieved,
        goalsProgress: encryptedGoalsProgress ?? validated.goalsProgress,
        goalsNotes: encryptedGoalsNotes ?? undefined,
        symptomsPhysical: encryptedSymptomsPhysical ?? validated.symptomsPhysical,
        symptomsMental: encryptedSymptomsMental ?? validated.symptomsMental,
        symptomsNotes: encryptedSymptomsNotes ?? undefined,
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
      return { success: false, error: error.errors[0]?.message || 'Validation failed' };
    }
    console.error('Error logging journal entry:', error);
    return { success: false, error: 'Failed to log journal entry' };
  }
}

export async function getMonthlyStats(month: number, year: number) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return { success: false, error: 'Unauthorized', data: null };
    }

    // Calculate month boundaries
    const monthStart = startOfMonth(new Date(year, month - 1, 1));
    const monthEnd = endOfMonth(new Date(year, month - 1, 1));

    // Fetch all entries for this month
    const entries = await prisma.journalEntry.findMany({
      where: {
        userId: session.user.id,
        date: {
          gte: monthStart,
          lte: monthEnd,
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
      averageMood: entries.length > 0 && entries.some((e) => e.mood !== null)
        ? entries.reduce((sum, e) => sum + (e.mood ?? 0), 0) / entries.filter((e) => e.mood !== null).length
        : null,
      averageEnergy: entries.length > 0 && entries.some((e) => e.energy !== null)
        ? entries.reduce((sum, e) => sum + (e.energy ?? 0), 0) / entries.filter((e) => e.energy !== null).length
        : null,
      averageSleep: entries.length > 0 && entries.some((e) => e.sleepHours !== null)
        ? entries.reduce((sum, e) => sum + (e.sleepHours ?? 0), 0) / entries.filter((e) => e.sleepHours !== null).length
        : null,
    };

    return { success: true, error: null, data: stats };
  } catch (error) {
    console.error('Error fetching monthly stats:', error);
    return { success: false, error: 'Failed to fetch monthly stats', data: null };
  }
}

/**
 * Get journal entry by date
 */
export async function getJournalEntryByDate(date: string) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return { success: false, error: 'Unauthorized', data: null };
    }

    const entryDate = new Date(date);
    entryDate.setHours(0, 0, 0, 0);

    const entry = await prisma.journalEntry.findUnique({
      where: {
        userId_date: {
          userId: session.user.id,
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
    return { success: false, error: 'Failed to fetch journal entry', data: null };
  }
}

/**
 * Delete journal entry
 */
export async function deleteJournalEntry(date: string) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return { success: false, error: 'Unauthorized' };
    }

    const entryDate = new Date(date);
    entryDate.setHours(0, 0, 0, 0);

    await prisma.journalEntry.delete({
      where: {
        userId_date: {
          userId: session.user.id,
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
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return { success: false, error: 'Unauthorized', data: null };
    }

    const entryDate = new Date(date);
    entryDate.setHours(0, 0, 0, 0);

    // Use select to only fetch required fields for performance
    const entry = await prisma.journalEntry.findUnique({
      where: {
        userId_date: {
          userId: session.user.id,
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
    return { success: false, error: 'Failed to fetch journal snippet', data: null };
  }
}

