import Link from 'next/link';
import type { OrganizationType } from '@prisma/client';
import { format } from 'date-fns';
import { BookHeart, Lock } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { dateOnlyToLocalDate } from '@/lib/date-only';
import type { SharedJournalEntry } from '@/lib/journal-sharing';
import { canViewSharedJournals } from '@/lib/org-policy';

function Metric({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
      {label}: {value}
    </span>
  );
}

function ListBlock({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-gray-500">{title}</span>
      <span className="text-sm text-gray-800">{items.join(', ')}</span>
    </div>
  );
}

function TextBlock({ title, text }: { title: string; text: string | null }) {
  if (!text) return null;
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-gray-500">{title}</span>
      <p className="whitespace-pre-wrap text-sm text-gray-800">{text}</p>
    </div>
  );
}

/**
 * Journal days members chose to share with this household or collective. The entries arrive
 * already filtered and decrypted on the server (src/lib/journal-sharing.ts).
 */
export function SharedJournalFeed({
  entries,
  organizationName,
  organizationType,
  className,
}: {
  entries: SharedJournalEntry[];
  organizationName: string;
  organizationType: OrganizationType;
  className?: string;
}) {
  if (!canViewSharedJournals(organizationType)) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Lock className="h-4 w-4 text-gray-500" aria-hidden />
            Journals stay private here
          </CardTitle>
          <CardDescription>
            In communities and workplaces nobody can see anyone&apos;s journal or cycle, and
            journal days cannot be shared.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <BookHeart className="h-4 w-4 text-primary-600" aria-hidden />
          Shared journal
        </CardTitle>
        <CardDescription>
          Days that people chose to share with {organizationName}. Each person decides per day
          and can stop sharing at any time.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <p className="text-sm text-gray-500">
            Nothing shared yet. Open a day in your{' '}
            <Link href="/journal" className="font-medium text-primary-600 hover:text-primary-700">
              journal
            </Link>{' '}
            and choose &quot;Share with {organizationName}&quot;.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {entries.map((entry) => (
              <li
                key={entry.id}
                className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-semibold text-gray-900">
                    {entry.authorName}
                    {entry.isYours && (
                      <span className="ml-2 text-xs font-normal text-gray-500">(You)</span>
                    )}
                  </span>
                  <span className="text-sm text-gray-500">
                    {format(dateOnlyToLocalDate(entry.date), 'EEEE, MMMM d')}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Metric label="Mood" value={entry.mood !== null ? `${entry.mood}/10` : null} />
                  <Metric
                    label="Energy"
                    value={entry.energy !== null ? `${entry.energy}/10` : null}
                  />
                  <Metric
                    label="Sleep"
                    value={entry.sleepHours !== null ? `${entry.sleepHours} h` : null}
                  />
                  {entry.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-primary-100 px-2 py-0.5 text-xs text-primary-800"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <TextBlock title="Notes" text={entry.notes} />
                <ListBlock title="Gratitude" items={entry.gratitudeEntries} />
                <TextBlock title="Gratitude notes" text={entry.gratitudeNotes} />
                <ListBlock title="Goals achieved" items={entry.goalsAchieved} />
                <ListBlock title="Goals in progress" items={entry.goalsProgress} />
                <TextBlock title="Goal notes" text={entry.goalsNotes} />
                <ListBlock title="Physical symptoms" items={entry.symptomsPhysical} />
                <ListBlock title="Mental symptoms" items={entry.symptomsMental} />
                <TextBlock title="Symptom notes" text={entry.symptomsNotes} />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
