'use client';

interface JournalAnalyticsProps {
  entries: Array<{
    date: Date;
    mood: number | null;
    energy: number | null;
    sleepHours: number | null;
  }>;
}

export function JournalAnalytics({ entries }: JournalAnalyticsProps) {
  if (entries.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">Not enough data for analytics. Log more entries to see trends.</p>
      </div>
    );
  }

  // Calculate averages
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

  // Calculate trends (compare first half vs second half)
  const midPoint = Math.floor(entries.length / 2);
  const firstHalf = entries.slice(0, midPoint);
  const secondHalf = entries.slice(midPoint);

  const getTrend = (field: 'mood' | 'energy' | 'sleepHours') => {
    const firstAvg =
      firstHalf.length > 0
        ? firstHalf
            .filter((e) => e[field] !== null)
            .reduce((sum, e) => sum + ((e[field] as number) || 0), 0) /
          firstHalf.filter((e) => e[field] !== null).length
        : 0;
    const secondAvg =
      secondHalf.length > 0
        ? secondHalf
            .filter((e) => e[field] !== null)
            .reduce((sum, e) => sum + ((e[field] as number) || 0), 0) /
          secondHalf.filter((e) => e[field] !== null).length
        : 0;

    if (firstHalf.length === 0 || secondHalf.length === 0) return 0;
    return secondAvg - firstAvg;
  };

  const moodTrend = getTrend('mood');
  const energyTrend = getTrend('energy');
  const sleepTrend = getTrend('sleepHours');

  const getTrendIcon = (trend: number) => {
    if (trend > 0) return '📈';
    if (trend < 0) return '📉';
    return '➡️';
  };

  const getTrendColor = (trend: number) => {
    if (trend > 0) return 'text-green-600';
    if (trend < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  const getRatingColor = (rating: number | null) => {
    if (!rating) return 'text-gray-600';
    if (rating >= 8) return 'text-green-600';
    if (rating >= 6) return 'text-yellow-600';
    if (rating >= 4) return 'text-orange-600';
    return 'text-red-600';
  };

  return (
    <div className="space-y-6">
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
    </div>
  );
}

