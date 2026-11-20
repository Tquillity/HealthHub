'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, Users } from 'lucide-react';
import { shareJournalEntry } from '@/actions/journal-sharing-actions';
import type { JournalShareTarget } from '@/lib/journal-sharing';
import { useUIStore } from '@/lib/store';

type JournalShareControlProps = {
  /** The entry's calendar day, `YYYY-MM-DD`. */
  dateKey: string;
  sharedOrganizationId: string | null;
  /** Households and collectives the author belongs to. */
  targets: JournalShareTarget[];
};

/**
 * "Who can see this day": private by default, or shared with one household or collective.
 * Communities and workplaces are never offered (src/lib/org-policy.ts).
 */
export function JournalShareControl({
  dateKey,
  sharedOrganizationId,
  targets,
}: JournalShareControlProps) {
  const router = useRouter();
  const showToast = useUIStore((state) => state.showToast);
  const initial = targets.some((target) => target.id === sharedOrganizationId)
    ? (sharedOrganizationId ?? '')
    : '';
  const [value, setValue] = useState(initial);
  const [saving, setSaving] = useState(false);

  if (targets.length === 0) {
    return (
      <p className="flex items-center gap-2 text-sm text-gray-600">
        <Lock className="h-4 w-4 shrink-0" aria-hidden />
        Private: only you can see this day.
      </p>
    );
  }

  const selected = targets.find((target) => target.id === value);

  const handleChange = async (next: string) => {
    const previous = value;
    setValue(next);
    setSaving(true);
    const result = await shareJournalEntry({ date: dateKey, organizationId: next || null });
    setSaving(false);
    if (result.success) {
      const target = targets.find((t) => t.id === next);
      showToast(
        target ? `Shared with ${target.name}.` : 'This day is private again.',
        'success'
      );
      router.refresh();
    } else {
      setValue(previous);
      showToast(result.error || 'Could not change sharing', 'error');
    }
  };

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-gray-50 p-4">
      <label
        htmlFor="journal-share-target"
        className="flex items-center gap-2 text-sm font-medium text-gray-900"
      >
        {selected ? (
          <Users className="h-4 w-4 text-primary-600" aria-hidden />
        ) : (
          <Lock className="h-4 w-4 text-gray-500" aria-hidden />
        )}
        Who can see this day
      </label>
      <select
        id="journal-share-target"
        value={value}
        disabled={saving}
        onChange={(event) => void handleChange(event.target.value)}
        aria-describedby="journal-share-help"
        className="min-h-[44px] w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 disabled:opacity-60 sm:max-w-sm"
      >
        <option value="">Only me</option>
        {targets.map((target) => (
          <option key={target.id} value={target.id}>
            Share with {target.name}
          </option>
        ))}
      </select>
      <p id="journal-share-help" className="text-xs text-gray-500">
        {selected
          ? `Members of ${selected.name} can read this day: mood, energy, sleep, notes, gratitude, goals and symptoms. You can make it private again at any time.`
          : 'Only you can see this day. Sharing shows the whole day to the members of the space you pick.'}
      </p>
    </div>
  );
}
