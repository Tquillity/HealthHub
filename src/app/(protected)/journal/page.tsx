import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/session';
import { prisma } from '@/lib/db';
import type { SearchParams } from 'nuqs/server';
import { parseMonthKey, toDateOnlyString } from '@/lib/date-only';
import { loadJournalSearchParams } from '@/lib/journal-search-params';
import { decrypt, decryptArray } from '@/lib/encryption';
import JournalPageClient from '@/components/journal/journal-page-client';
import { PageHeader } from '@/components/ui/page-header';
import { AppErrorBoundary } from '@/components/ui/error-boundary';

interface JournalPageProps {
  searchParams: Promise<SearchParams>;
}

export default async function JournalPage({ searchParams }: JournalPageProps) {
  const session = await getServerSession();

  if (!session) {
    redirect('/sign-in');
  }

  // Month shown in the calendar (`?month=YYYY-MM`), defaulting to the current month.
  // Entry dates are UTC midnight, so the month range is a UTC range.
  const { month } = await loadJournalSearchParams(searchParams);
  const monthKey = month ?? toDateOnlyString(new Date()).slice(0, 7);
  const monthRange = parseMonthKey(monthKey);
  if (!monthRange) {
    redirect('/journal');
  }

  const entries = await prisma.journalEntry.findMany({
    where: {
      userId: session.user.id,
      date: {
        gte: monthRange.start,
        lt: monthRange.end,
      },
    },
    orderBy: { date: 'asc' },
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

  return (
    <div className="p-6">
      <PageHeader
        className="mb-6"
        title="Journal"
        description="Private encrypted entries for reflection and wellness notes."
      />
      <AppErrorBoundary sectionLabel="Journal">
        <JournalPageClient
          initialEntries={decryptedEntries}
          monthKey={monthKey}
        />
      </AppErrorBoundary>
    </div>
  );
}
