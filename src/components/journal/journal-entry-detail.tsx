'use client';

import { Button } from '@/components/ui/button';
import { SafeDeleteModal } from '@/components/ui/safe-delete-modal';
import { deleteJournalEntry } from '@/actions/journal-actions';
import { Edit, Trash2, X } from 'lucide-react';
import { format } from 'date-fns';
import type { JournalEntry } from '@prisma/client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface JournalEntryDetailProps {
  entry: JournalEntry;
  onClose: () => void;
  onEdit: () => void;
}

export function JournalEntryDetail({ entry, onClose, onEdit }: JournalEntryDetailProps) {
  const router = useRouter();
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const getRatingColor = (rating: number | null) => {
    if (!rating) return 'text-gray-600';
    if (rating >= 8) return 'text-green-600';
    if (rating >= 6) return 'text-yellow-600';
    if (rating >= 4) return 'text-orange-600';
    return 'text-red-600';
  };

  const getRatingEmoji = (rating: number | null) => {
    if (!rating) return '—';
    if (rating >= 8) return '😊';
    if (rating >= 6) return '🙂';
    if (rating >= 4) return '😐';
    return '😔';
  };

  const handleDelete = async () => {
    if (entry) {
      const dateStr = entry.date.toISOString().split('T')[0];
      const result = await deleteJournalEntry(dateStr);
      if (result.success) {
        setShowDeleteModal(false);
        onClose();
        router.refresh();
      } else {
        alert(result.error || 'Failed to delete entry');
      }
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                Journal Entry - {format(new Date(entry.date), 'EEEE, MMMM d, yyyy')}
              </h2>
              <p className="text-sm text-gray-600">
                Created {format(new Date(entry.createdAt), 'MMM d, yyyy')}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onEdit} className="gap-2">
                <Edit className="h-4 w-4" />
                Edit
              </Button>
              <Button
                variant="destructive"
                onClick={() => setShowDeleteModal(true)}
                className="gap-2"
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
              <Button variant="outline" onClick={onClose} className="gap-2">
                <X className="h-4 w-4" />
                Close
              </Button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-8">
            {/* Mood & Energy */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                  <span className="text-2xl mr-2">😊</span>
                  Mood
                </h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Rating</span>
                    <span className={`text-lg font-semibold ${getRatingColor(entry.mood)}`}>
                      {getRatingEmoji(entry.mood)} {entry.mood !== null ? `${entry.mood}/10` : '—'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                  <span className="text-2xl mr-2">⚡</span>
                  Energy
                </h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Rating</span>
                    <span className={`text-lg font-semibold ${getRatingColor(entry.energy)}`}>
                      ⚡ {entry.energy !== null ? `${entry.energy}/10` : '—'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Sleep */}
            {entry.sleepHours !== null && (
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                  <span className="text-2xl mr-2">😴</span>
                  Sleep
                </h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Hours</span>
                    <span className="text-lg font-semibold text-blue-600">
                      {entry.sleepHours}h
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Notes */}
            {entry.notes && (
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Notes</h3>
                <p className="text-sm text-gray-800 whitespace-pre-wrap">{entry.notes}</p>
              </div>
            )}

            {/* Tags */}
            {entry.tags.length > 0 && (
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Tags</h3>
                <div className="flex flex-wrap gap-2">
                  {entry.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center rounded-full bg-primary-100 px-3 py-1 text-sm font-medium text-primary-800"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <SafeDeleteModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDelete}
        title="Delete Journal Entry"
        itemName={format(new Date(entry.date), 'MMMM d, yyyy')}
        description="This will permanently delete this journal entry."
      />
    </>
  );
}

