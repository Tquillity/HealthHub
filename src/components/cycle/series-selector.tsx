'use client';

/**
 * Series Selector Component
 * 
 * Interactive Bento-style legend/selector for toggling chart series visibility.
 * Allows users to switch between Lifestyle, Science, and Correlative modes.
 * 
 * Features:
 * - 5 toggle badges (Energy, Estrogen, Progesterone, LH, FSH)
 * - Color-coded indicators matching chart line styles
 * - Updates URL state via nuqs for persistence
 * - PWA-optimized touch targets (min-h-[44px])
 * - Accessibility: proper ARIA labels and keyboard navigation
 */

import { useMemo } from 'react';
import { useQueryState, parseAsString } from 'nuqs';
import { Zap, Activity } from 'lucide-react';

export type SeriesType = 'energy' | 'estrogen' | 'progesterone' | 'lh' | 'fsh' | 'testosterone';

interface SeriesConfig {
  id: SeriesType;
  label: string;
  color: string;
  icon?: React.ReactNode;
}

const SERIES_CONFIG: SeriesConfig[] = [
  {
    id: 'energy',
    label: 'Energy Level',
    color: '#6366f1', // indigo-500
    icon: <Zap className="h-4 w-4" />,
  },
  {
    id: 'estrogen',
    label: 'Estrogen',
    color: '#3b82f6', // blue-500
    icon: <Activity className="h-4 w-4" />,
  },
  {
    id: 'progesterone',
    label: 'Progesterone',
    color: '#a855f7', // purple-500
    icon: <Activity className="h-4 w-4" />,
  },
  {
    id: 'lh',
    label: 'LH',
    color: '#22c55e', // green-500
    icon: <Activity className="h-4 w-4" />,
  },
  {
    id: 'fsh',
    label: 'FSH',
    color: '#9ca3af', // gray-400
    icon: <Activity className="h-4 w-4" />,
  },
  {
    id: 'testosterone',
    label: 'Testosterone',
    color: '#f97316', // orange-500
    icon: <Activity className="h-4 w-4" />,
  },
];

interface SeriesSelectorProps {
  onSeriesChange?: (visibleSeries: SeriesType[]) => void;
}

export function SeriesSelector({ onSeriesChange }: SeriesSelectorProps) {
  // Parse URL state for visible series (comma-separated list)
  const [visibleSeriesStr, setVisibleSeriesStr] = useQueryState(
    'show',
    parseAsString.withDefault('energy')
  );

  // Parse visible series from URL string
  const visibleSeries = useMemo(() => {
    if (!visibleSeriesStr) return ['energy'];
    return visibleSeriesStr.split(',').filter((s): s is SeriesType => 
      ['energy', 'estrogen', 'progesterone', 'lh', 'fsh', 'testosterone'].includes(s.trim())
    );
  }, [visibleSeriesStr]);

  // Toggle series visibility
  const toggleSeries = (seriesId: SeriesType) => {
    let newVisibleSeries: SeriesType[];
    
    if (visibleSeries.includes(seriesId)) {
      // Removing a series
      newVisibleSeries = visibleSeries.filter((id) => id !== seriesId);
      // Ensure at least one series is always visible (default to energy)
      if (newVisibleSeries.length === 0) {
        newVisibleSeries = ['energy'];
      }
    } else {
      // Adding a series
      newVisibleSeries = [...visibleSeries, seriesId];
    }
    
    // Update URL state
    const newUrlValue = newVisibleSeries.join(',');
    setVisibleSeriesStr(newUrlValue);
    
    // Notify parent component
    onSeriesChange?.(newVisibleSeries);
  };

  return (
    <div
      role="group"
      aria-label="Chart series visibility controls"
      className="flex flex-wrap gap-3 pt-4 border-t border-gray-200"
    >
      {SERIES_CONFIG.map((series) => {
        const isVisible = visibleSeries.includes(series.id);
        return (
          <button
            key={series.id}
            id={`series-toggle-${series.id}`}
            role="checkbox"
            aria-checked={isVisible}
            aria-label={`${isVisible ? 'Hide' : 'Show'} ${series.label}`}
            onClick={() => toggleSeries(series.id)}
            className={`flex items-center gap-2 px-4 py-2 min-h-[44px] rounded-lg border-2 transition-all duration-200 ${
              isVisible
                ? 'bg-white border-gray-300 shadow-sm'
                : 'bg-gray-50 border-gray-200 opacity-60'
            } hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2`}
          >
            {/* Color indicator - Line icon for visibility */}
            <div className="flex items-center gap-1.5">
              {series.icon && (
                <span
                  className="opacity-80"
                  style={{ color: series.color }}
                >
                  {series.icon}
                </span>
              )}
              <div
                className="w-3 h-0.5 rounded-full"
                style={{ backgroundColor: series.color }}
              />
            </div>
            <span className={`text-sm font-medium ${
              isVisible ? 'text-gray-900' : 'text-gray-500'
            }`}>
              {series.label}
            </span>
            {isVisible && (
              <span className="ml-auto text-xs text-gray-400">✓</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Get visible series from URL or default
 * 
 * @param urlValue - Comma-separated string from URL
 * @returns Array of visible series IDs (always returns at least ['energy'] if empty)
 */
export function getVisibleSeries(urlValue: string | null): SeriesType[] {
  if (!urlValue) return ['energy'];
  const series = urlValue.split(',').filter((s): s is SeriesType => 
    ['energy', 'estrogen', 'progesterone', 'lh', 'fsh', 'testosterone'].includes(s.trim())
  );
  // Ensure at least one series is always visible (default to energy)
  return series.length > 0 ? series : ['energy'];
}

