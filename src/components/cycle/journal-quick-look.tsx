'use client';

/**
 * Journal Quick Look Component
 * 
 * Floating preview card that displays a snippet of a journal entry for a selected date.
 * Appears when user clicks a past day on the cycle chart.
 * 
 * Features:
 * - Glassmorphic design with phase-themed accent border
 * - Displays mood, energy, and truncated notes preview
 * - "View Full Entry" button linking to journal page
 * - "Log Now" button for days without entries
 * - Keyboard accessible (ESC to close)
 * 
 * UX Pattern: Replaces Insight Center content when a date is selected,
 * maintaining layout stability while providing contextual history.
 */

import { useEffect } from 'react';
import { CyclePhase } from '@/lib/cycle-calculator';
import { getPhaseTheme } from '@/lib/phase-theme';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { X, Calendar, Smile, Zap, FileText, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';

interface JournalQuickLookProps {
  date: Date;
  phase: CyclePhase;
  snippet: {
    mood: number | null;
    energy: number | null;
    notesSnippet: string | null;
  } | null;
  onClose: () => void;
}

export function JournalQuickLook({
  date,
  phase,
  snippet,
  onClose,
}: JournalQuickLookProps) {
  const router = useRouter();
  const theme = getPhaseTheme(phase);
  const hasEntry = snippet !== null;

  // Handle ESC key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  // Format date for display
  const formattedDate = format(date, 'EEEE, MMM d');
  const journalDateParam = format(date, 'yyyy-MM-dd');

  const handleViewFull = () => {
    router.push(`/journal?date=${journalDateParam}`);
    onClose();
  };

  const handleLogNow = () => {
    router.push(`/journal?date=${journalDateParam}&action=create`);
    onClose();
  };

  return (
    <Card
      className={`p-6 bg-white/90 backdrop-blur-md shadow-xl border-2 ${theme.border.accent} relative`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="quick-look-title"
    >
      {/* Close Button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-1.5 text-gray-400 hover:text-gray-600 transition-colors"
        aria-label="Close quick look"
      >
        <X className="h-4 w-4" />
      </button>

      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <Calendar className={`h-5 w-5 ${theme.text.accent}`} />
        <h3 id="quick-look-title" className={`text-lg font-bold ${theme.text.primary}`}>
          {formattedDate}
        </h3>
      </div>

      {hasEntry ? (
        <div className="flex flex-col gap-4">
          {/* Vibe Check - Mood & Energy */}
          <div className="flex items-center gap-4">
            {snippet.mood !== null && (
              <div className="flex items-center gap-2">
                <Smile className={`h-4 w-4 ${theme.text.secondary}`} />
                <span className={`text-sm font-medium ${theme.text.primary}`}>
                  Mood: <span className={theme.text.accent}>{snippet.mood}/10</span>
                </span>
              </div>
            )}
            {snippet.energy !== null && (
              <div className="flex items-center gap-2">
                <Zap className={`h-4 w-4 ${theme.text.secondary}`} />
                <span className={`text-sm font-medium ${theme.text.primary}`}>
                  Energy: <span className={theme.text.accent}>{snippet.energy}/10</span>
                </span>
              </div>
            )}
          </div>

          {/* Note Snippet */}
          {snippet.notesSnippet && (
            <div className={`p-4 rounded-lg ${theme.bg.secondary} ${theme.border.primary} border`}>
              <div className="flex items-center gap-2 mb-2">
                <FileText className={`h-4 w-4 ${theme.text.accent}`} />
                <span className={`text-xs font-semibold uppercase tracking-wider ${theme.text.accent}`}>
                  Notes
                </span>
              </div>
              <p className={`text-sm ${theme.text.secondary} leading-relaxed`}>
                {snippet.notesSnippet}
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col gap-2 pt-2 border-t border-gray-200">
            <Button
              onClick={handleViewFull}
              variant="default"
              className={`${theme.gradient.classes} text-white hover:opacity-90`}
            >
              View Full Entry
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {/* Empty State */}
          <div className={`p-6 rounded-lg ${theme.bg.muted} border ${theme.border.muted} text-center`}>
            <FileText className={`h-8 w-8 mx-auto mb-2 ${theme.text.secondary}`} />
            <p className={`text-sm ${theme.text.secondary} mb-4`}>
              Nothing logged for this day
            </p>
            <Button
              onClick={handleLogNow}
              variant="outline"
              style={{
                borderColor: theme.color.primary,
                color: theme.color.primary,
              }}
              className="border-2 hover:opacity-80"
            >
              <Plus className="h-4 w-4 mr-2" />
              Log Now
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

