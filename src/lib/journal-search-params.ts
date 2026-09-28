import { createLoader, createParser } from 'nuqs/server';
import { parseMonthKey } from '@/lib/date-only';

/** `?month=YYYY-MM` — the month the journal calendar shows and the page loads. */
export const parseAsMonthKey = createParser({
  parse: (value: string) => (parseMonthKey(value) ? value : null),
  serialize: (value: string) => value,
});

export const journalSearchParams = {
  month: parseAsMonthKey,
};

export const loadJournalSearchParams = createLoader(journalSearchParams);
