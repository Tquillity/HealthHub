'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { logJournalEntry, getJournalEntryByDate } from '@/actions/journal-actions';
import { Plus, X } from 'lucide-react';
import { format } from 'date-fns';

interface JournalClientProps {
  initialDate?: string;
  onEntrySaved?: () => void;
}

export function JournalClient({ initialDate, onEntrySaved }: JournalClientProps) {
  const router = useRouter();
  const [showDialog, setShowDialog] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    date: initialDate || format(new Date(), 'yyyy-MM-dd'),
    mood: '',
    energy: '',
    sleepHours: '',
    notes: '',
    tags: '',
  });

  useEffect(() => {
    if (initialDate) {
      setFormData((prev) => ({ ...prev, date: initialDate }));
      loadExistingEntry(initialDate);
    }
  }, [initialDate]);

  const loadExistingEntry = async (date: string) => {
    const result = await getJournalEntryByDate(date);
    if (result.success && result.data) {
      setFormData({
        date,
        mood: result.data.mood?.toString() || '',
        energy: result.data.energy?.toString() || '',
        sleepHours: result.data.sleepHours?.toString() || '',
        notes: result.data.content || '',
        tags: result.data.tags.join(', ') || '',
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Parse tags (comma-separated)
    const tags = formData.tags
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    const result = await logJournalEntry({
      date: formData.date,
      mood: formData.mood ? parseInt(formData.mood) : undefined,
      energy: formData.energy ? parseInt(formData.energy) : undefined,
      sleepHours: formData.sleepHours ? parseFloat(formData.sleepHours) : undefined,
      notes: formData.notes || undefined,
      tags,
    });

    if (result.success) {
      setShowDialog(false);
      setFormData({
        date: format(new Date(), 'yyyy-MM-dd'),
        mood: '',
        energy: '',
        sleepHours: '',
        notes: '',
        tags: '',
      });
      onEntrySaved?.();
      router.refresh();
    } else {
      alert(result.error || 'Failed to log entry');
    }

    setIsSubmitting(false);
  };

  return (
    <>
      <Button onClick={() => setShowDialog(true)} className="gap-2">
        <Plus className="h-4 w-4" />
        Log Today
      </Button>

      {showDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Log Journal Entry</h2>
              <button
                onClick={() => setShowDialog(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Date
                </label>
                <Input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Mood (1-10)
                  </label>
                  <Input
                    type="number"
                    min="1"
                    max="10"
                    value={formData.mood}
                    onChange={(e) => setFormData({ ...formData, mood: e.target.value })}
                    placeholder="1-10"
                    className="mt-1"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Energy (1-10)
                  </label>
                  <Input
                    type="number"
                    min="1"
                    max="10"
                    value={formData.energy}
                    onChange={(e) => setFormData({ ...formData, energy: e.target.value })}
                    placeholder="1-10"
                    className="mt-1"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Sleep Hours
                </label>
                <Input
                  type="number"
                  min="0"
                  max="24"
                  step="0.5"
                  value={formData.sleepHours}
                  onChange={(e) =>
                    setFormData({ ...formData, sleepHours: e.target.value })
                  }
                  placeholder="e.g., 7.5"
                  className="mt-1"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Notes
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  className="mt-1 flex w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
                  placeholder="How are you feeling today?"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Tags (comma-separated)
                </label>
                <Input
                  value={formData.tags}
                  onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                  placeholder="e.g., workout, productive, stressed"
                  className="mt-1"
                />
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowDialog(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting} className="flex-1">
                  {isSubmitting ? 'Saving...' : 'Save Entry'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

