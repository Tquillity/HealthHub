'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { JournalClient } from '@/components/journal/journal-client';
import { JournalCalendar } from '@/components/journal/journal-calendar';
import { JournalAnalytics } from '@/components/journal/journal-analytics';
import { JournalEntryDetail } from '@/components/journal/journal-entry-detail';
import { getJournalEntryByDate, deleteJournalEntry } from '@/actions/journal-actions';
import type { JournalEntry } from '@prisma/client';

interface JournalPageClientProps {
  initialEntries: JournalEntry[];
}

export default function JournalPageClient({ initialEntries }: JournalPageClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'calendar' | 'form' | 'analytics'>('calendar');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);
  const [entries, setEntries] = useState(initialEntries);
  const [showEntryDetail, setShowEntryDetail] = useState(false);

  const handleDateSelect = async (date: string) => {
    setSelectedDate(date);
    const result = await getJournalEntryByDate(date);
    if (result.success && result.data) {
      setSelectedEntry(result.data);
      setShowEntryDetail(true);
    } else {
      setSelectedEntry(null);
      setShowEntryDetail(false);
      // If no entry, open form for that date
      setActiveTab('form');
    }
  };

  const handleEntryClick = (entry: JournalEntry) => {
    setSelectedEntry(entry);
    setShowEntryDetail(true);
  };

  const handleCloseEntryDetail = () => {
    setShowEntryDetail(false);
    setSelectedEntry(null);
  };

  const handleEditEntry = () => {
    setShowEntryDetail(false);
    setActiveTab('form');
  };

  const handleDeleteEntry = async () => {
    if (selectedEntry) {
      const result = await deleteJournalEntry(selectedEntry.date.toISOString().split('T')[0]);
      if (result.success) {
        setEntries(entries.filter((e) => e.id !== selectedEntry.id));
        setShowEntryDetail(false);
        setSelectedEntry(null);
        router.refresh();
      }
    }
  };

  const handleEntrySaved = () => {
    router.refresh();
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Journal</h1>
          <p className="mt-1 text-gray-500">
            Track your mood, energy, and sleep patterns.
          </p>
        </div>
        <JournalClient onEntrySaved={handleEntrySaved} />
      </div>

      {/* Tab Navigation */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="-mb-px flex gap-8">
          <button
            onClick={() => setActiveTab('calendar')}
            className={`${
              activeTab === 'calendar'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap border-b-2 px-1 py-4 text-sm font-medium transition-colors`}
          >
            📅 Calendar
          </button>
          <button
            onClick={() => setActiveTab('form')}
            className={`${
              activeTab === 'form'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap border-b-2 px-1 py-4 text-sm font-medium transition-colors`}
          >
            ✍️ New Entry
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`${
              activeTab === 'analytics'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap border-b-2 px-1 py-4 text-sm font-medium transition-colors`}
          >
            📊 Analytics
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'calendar' && (
        <JournalCalendar
          entries={entries}
          selectedDate={selectedDate}
          onDateSelect={handleDateSelect}
          onEntryClick={handleEntryClick}
        />
      )}

      {activeTab === 'form' && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <JournalClient
            initialDate={selectedDate || undefined}
            onEntrySaved={() => {
              handleEntrySaved();
              setActiveTab('calendar');
            }}
          />
        </div>
      )}

      {activeTab === 'analytics' && (
        <JournalAnalytics entries={entries} />
      )}

      {/* Entry Detail Modal */}
      {showEntryDetail && selectedEntry && (
        <JournalEntryDetail
          entry={selectedEntry}
          onClose={handleCloseEntryDetail}
          onEdit={handleEditEntry}
        />
      )}
    </div>
  );
}
