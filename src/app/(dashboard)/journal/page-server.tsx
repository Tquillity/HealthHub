import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { startOfMonth, endOfMonth } from 'date-fns';
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

  return <JournalPageClient initialEntries={entries} />;
}

