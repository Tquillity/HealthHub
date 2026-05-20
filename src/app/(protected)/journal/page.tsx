import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/session';
import { prisma } from '@/lib/db';
import { startOfMonth, endOfMonth } from 'date-fns';
import { decrypt, decryptArray } from '@/lib/encryption';
import JournalPageClient from '@/components/journal/journal-page-client';
import { PageHeader } from '@/components/ui/page-header';
import { AppErrorBoundary } from '@/components/ui/error-boundary';

export default async function JournalPage() {
  const session = await getServerSession();

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

  return (
    <div className="p-6">
      <PageHeader
        className="mb-6"
        title="Journal"
        description="Private encrypted entries for reflection and wellness notes."
      />
      <AppErrorBoundary sectionLabel="Journal">
        <JournalPageClient initialEntries={decryptedEntries} />
      </AppErrorBoundary>
    </div>
  );
}
