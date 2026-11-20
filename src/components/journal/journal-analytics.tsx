'use client';

import type { TimeOfDayEnergySummary } from '@/lib/circadian-data';
import { isCheckInOnlyDay, type JournalDayContent } from '@/lib/journal-content';
import { JournalTimeOfDayEnergy } from './journal-time-of-day-energy';

/**
 * JournalAnalytics Component
 * 
 * Displays aggregated wellness metrics from journal entries including:
 * - Average mood, energy, and sleep hours
 * - Trend analysis comparing first half vs second half of entries
 * - Visual indicators (icons, colors) for quick pattern recognition
 * 
 * Trend Calculation: Splits the entries that have a value into two halves and
 * compares averages to show whether metrics are improving, declining, or stable.
 *
 * Days that hold only time-of-day energy check-ins (circadian insights) are not
 * journal entries here; their energy is in the time-of-day section.
 */

interface JournalAnalyticsProps {
  entries: Array<{ date: Date } & JournalDayContent>;
  /** Last 30 days of energy by time of day; null unless circadian insights are on. */
  timeOfDayEnergy?: TimeOfDayEnergySummary | null;
}

export function JournalAnalytics({
  entries: allEntries,
  timeOfDayEnergy = null,
}: JournalAnalyticsProps) {
  const entries = allEntries.filter((entry) => !isCheckInOnlyDay(entry));
  const timeOfDaySection = timeOfDayEnergy ? (
    <JournalTimeOfDayEnergy summary={timeOfDayEnergy} />
  ) : null;

  if (entries.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <div className="text-center py-8">
          <p className="text-gray-500">Not enough data for analytics. Log more entries to see trends.</p>
        </div>
        {timeOfDaySection}
      </div>
    );
  }

  // Calculate averages from non-null entries only
  const moodEntries = entries.filter((e) => e.mood !== null);
  const energyEntries = entries.filter((e) => e.energy !== null);
  const sleepEntries = entries.filter((e) => e.sleepHours !== null);

  const avgMood =
    moodEntries.length > 0
      ? moodEntries.reduce((sum, e) => sum + (e.mood || 0), 0) / moodEntries.length
      : null;
  const avgEnergy =
    energyEntries.length > 0
      ? energyEntries.reduce((sum, e) => sum + (e.energy || 0), 0) / energyEntries.length
      : null;
  const avgSleep =
    sleepEntries.length > 0
      ? sleepEntries.reduce((sum, e) => sum + (e.sleepHours || 0), 0) / sleepEntries.length
      : null;

  /**
   * Trend Analysis: Compare the first half vs the second half of the values
   *
   * Only entries that have the field count, so a day without it (a notes-only or
   * vitals-only day) cannot leave a half empty. Positive trend = improving, negative =
   * declining, 0 = fewer than two values.
   *
   * @param field - The metric to analyze ('mood', 'energy', or 'sleepHours')
   * @returns Difference between second half and first half averages
   */
  const getTrend = (field: 'mood' | 'energy' | 'sleepHours') => {
    const values = entries
      .map((e) => e[field])
      .filter((value): value is number => value !== null);
    const midPoint = Math.floor(values.length / 2);
    if (midPoint === 0) return 0;
    const average = (part: number[]) =>
      part.reduce((sum, value) => sum + value, 0) / part.length;
    return average(values.slice(midPoint)) - average(values.slice(0, midPoint));
  };

  const moodTrend = getTrend('mood');
  const energyTrend = getTrend('energy');
  const sleepTrend = getTrend('sleepHours');

  /**
   * Returns emoji icon based on trend direction
   * 📈 = improving, 📉 = declining, ➡️ = stable
   */
  const getTrendIcon = (trend: number) => {
    if (trend > 0) return '📈';
    if (trend < 0) return '📉';
    return '➡️';
  };

  /**
   * Returns Tailwind color class for trend visualization
   * Green = positive trend, Red = negative trend, Gray = neutral
   */
  const getTrendColor = (trend: number) => {
    if (trend > 0) return 'text-green-600';
    if (trend < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  /**
   * Returns Tailwind color class for rating visualization
   * 
   * Color scale:
   * - 8-10: Green (excellent)
   * - 6-7: Yellow (good)
   * - 4-5: Orange (fair)
   * - 0-3: Red (poor)
   * - null: Gray (no data)
   */
  const getRatingColor = (rating: number | null) => {
    if (!rating) return 'text-gray-600';
    if (rating >= 8) return 'text-green-600';
    if (rating >= 6) return 'text-yellow-600';
    if (rating >= 4) return 'text-orange-600';
    return 'text-red-600';
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Mood Card */}
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Average Mood</p>
              <p className={`text-2xl font-bold ${getRatingColor(avgMood)}`}>
                {avgMood !== null ? avgMood.toFixed(1) : '—'}
              </p>
            </div>
            <div className="text-3xl">😊</div>
          </div>
          {moodTrend !== 0 && (
            <div className="mt-4">
              <div className="flex items-center text-sm">
                <span className={getTrendColor(moodTrend)}>
                  {getTrendIcon(moodTrend)} {Math.abs(moodTrend).toFixed(1)}
                </span>
                <span className="ml-2 text-gray-600">vs start</span>
              </div>
            </div>
          )}
        </div>

        {/* Energy Card */}
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Average Energy</p>
              <p className={`text-2xl font-bold ${getRatingColor(avgEnergy)}`}>
                {avgEnergy !== null ? avgEnergy.toFixed(1) : '—'}
              </p>
            </div>
            <div className="text-3xl">⚡</div>
          </div>
          {energyTrend !== 0 && (
            <div className="mt-4">
              <div className="flex items-center text-sm">
                <span className={getTrendColor(energyTrend)}>
                  {getTrendIcon(energyTrend)} {Math.abs(energyTrend).toFixed(1)}
                </span>
                <span className="ml-2 text-gray-600">vs start</span>
              </div>
            </div>
          )}
        </div>

        {/* Sleep Card */}
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Average Sleep</p>
              <p className="text-2xl font-bold text-blue-600">
                {avgSleep !== null ? `${avgSleep.toFixed(1)}h` : '—'}
              </p>
            </div>
            <div className="text-3xl">😴</div>
          </div>
          {sleepTrend !== 0 && (
            <div className="mt-4">
              <div className="flex items-center text-sm">
                <span className={getTrendColor(sleepTrend)}>
                  {getTrendIcon(sleepTrend)} {Math.abs(sleepTrend).toFixed(1)}h
                </span>
                <span className="ml-2 text-gray-600">vs start</span>
              </div>
            </div>
          )}
        </div>

        {/* Entries Count */}
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Entries</p>
              <p className="text-2xl font-bold text-gray-900">{entries.length}</p>
            </div>
            <div className="text-3xl">📝</div>
          </div>
        </div>
      </div>

      {timeOfDaySection}
    </div>
  );
}

