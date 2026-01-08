import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { startOfMonth, endOfMonth } from 'date-fns';
import { decrypt, decryptArray } from '@/lib/encryption';
import JournalPageClient from './journal-page-client';

export default async function JournalPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect('/sign-in');
  }

  // Get current month
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  // Fetch journal entries for current month
  const entries = await prisma.journalEntry.findMany({
    where: {
      userId: session.user.id,
      date: {
        gte: monthStart,
        lte: monthEnd,
      },
    },
  });

  // Decrypt sensitive fields before passing to client
  const decryptedEntries = entries.map((entry) => ({
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
  }));

  return <JournalPageClient initialEntries={decryptedEntries} />;
}

