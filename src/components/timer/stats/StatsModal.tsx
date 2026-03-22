'use client';

import { useState, useMemo } from 'react';
import { useTimeStore } from '@/lib/pomo-store/useTimeStore';
import { useSettingsStore } from '@/lib/pomo-store/useSettingsStore';
import { format, parseISO, startOfMonth, endOfMonth, eachMonthOfInterval, startOfWeek, endOfWeek, addWeeks, addMonths, addYears, eachDayOfInterval, startOfYear, endOfYear } from 'date-fns';
import { cn } from '@/lib/pomo/utils/cn';
import { Modal } from '../common/Modal';
import {
  getCurrentStreak,
  getDailyGoalProgress,
} from '@/lib/pomo/utils/historyInsights';

interface StatsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ViewMetric = 'minutes' | 'count';
type TimeRange = '7d' | 'all' | 'month' | 'year';

export const StatsModal = ({ isOpen, onClose }: StatsModalProps) => {
  const history = useTimeStore(state => state.history);
  const durations = useSettingsStore(state => state.durations);
  const dailyGoalPomodoros = useSettingsStore(state => state.dailyGoalPomodoros);
  const [metric, setMetric] = useState<ViewMetric>('minutes');
  const [range, setRange] = useState<TimeRange>('7d');
  const [offset, setOffset] = useState(0);

  const totals = useMemo(() => {
    const values = Object.values(history);
    const pomoCount = values.reduce((acc, curr) => acc + (curr.pomodoro || 0), 0);
    const shortCount = values.reduce((acc, curr) => acc + (curr.short || 0), 0);
    const longCount = values.reduce((acc, curr) => acc + (curr.long || 0), 0);

    const pomoMins = pomoCount * durations.pomodoro;
    const breakMins = (shortCount * durations.short) + (longCount * durations.long);
    return {
      pomoCount,
      pomoMins,
      breakMins,
      totalSessions: pomoCount + shortCount + longCount
    };
  }, [history, durations.pomodoro, durations.short, durations.long]);

  const goalSnapshot = useMemo(() => ({
    today: getDailyGoalProgress(history, dailyGoalPomodoros),
    focusStreak: getCurrentStreak(history, 1),
    goalStreak: getCurrentStreak(history, dailyGoalPomodoros),
  }), [dailyGoalPomodoros, history]);

  const baseDate = useMemo(() => {
    const today = new Date();
    
    switch (range) {
      case '7d': {
        const weekStart = startOfWeek(today, { weekStartsOn: 1 });
        return addWeeks(weekStart, offset);
      }
      case 'all': {
        return today;
      }
      case 'month': {
        const monthStart = startOfMonth(today);
        return addMonths(monthStart, offset);
      }
      case 'year': {
        const yearStart = startOfYear(today);
        return addYears(yearStart, offset);
      }
      default:
        return today;
    }
  }, [range, offset]);

  const dateRange = useMemo(() => {
    switch (range) {
      case '7d': {
        const weekStart = startOfWeek(baseDate, { weekStartsOn: 1 });
        const weekEnd = endOfWeek(baseDate, { weekStartsOn: 1 });
        return `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')}`;
      }
      case 'all': {
        const historyKeys = Object.keys(history).sort();
        if (historyKeys.length === 0) return 'No data';
        const firstDate = parseISO(historyKeys[0]);
        const lastDate = parseISO(historyKeys[historyKeys.length - 1]);
        return `${format(firstDate, 'MMM d, yyyy')} - ${format(lastDate, 'MMM d, yyyy')}`;
      }
      case 'month': {
        const monthStart = startOfMonth(baseDate);
        const monthEnd = endOfMonth(baseDate);
        return `${format(monthStart, 'MMM d')} - ${format(monthEnd, 'MMM d, yyyy')}`;
      }
      case 'year': {
        const yearStart = startOfYear(baseDate);
        const yearEnd = endOfYear(baseDate);
        return `${format(yearStart, 'MMM d, yyyy')} - ${format(yearEnd, 'MMM d, yyyy')}`;
      }
      default:
        return '';
    }
  }, [range, baseDate, history]);

  type DataPoint = {
    label: string;
    fullDate: string;
    work: number;
    rest: number;
    total: number;
    isWeekend?: boolean;
  };

  const monthlyAgg = useMemo(() => {
    const agg: Record<string, { pomodoro: number; short: number; long: number }> = {};
    for (const [dayKey, stats] of Object.entries(history)) {
      const monthKey = dayKey.slice(0, 7); // yyyy-MM
      const existing = agg[monthKey] ?? { pomodoro: 0, short: 0, long: 0 };
      existing.pomodoro += stats.pomodoro || 0;
      existing.short += stats.short || 0;
      existing.long += stats.long || 0;
      agg[monthKey] = existing;
    }
    return agg;
  }, [history]);

  const graphData = useMemo<DataPoint[]>(() => {
    const workMinsPer = durations.pomodoro;
    const shortMinsPer = durations.short;
    const longMinsPer = durations.long;

    const toWork = (p: number) => metric === 'minutes' ? p * workMinsPer : p;
    const toRest = (s: number, l: number) => metric === 'minutes' ? (s * shortMinsPer) + (l * longMinsPer) : (s + l);

    if (range === '7d') {
      const weekStart = startOfWeek(baseDate, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(baseDate, { weekStartsOn: 1 });
      const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

      return days.map(date => {
        const key = format(date, 'yyyy-MM-dd');
        const stats = history[key] || { pomodoro: 0, short: 0, long: 0 };
        const dayOfWeek = date.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        const work = toWork(stats.pomodoro);
        const rest = toRest(stats.short, stats.long);
        return {
          label: format(date, 'EEE'),
          fullDate: format(date, 'MMM d, yyyy'),
          work,
          rest,
          total: work + rest,
          isWeekend
        };
      });
    }

    if (range === 'month') {
      const monthStart = startOfMonth(baseDate);
      const monthEnd = endOfMonth(baseDate);
      const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

      return days.map(date => {
        const key = format(date, 'yyyy-MM-dd');
        const stats = history[key] || { pomodoro: 0, short: 0, long: 0 };
        const dayOfWeek = date.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        const work = toWork(stats.pomodoro);
        const rest = toRest(stats.short, stats.long);
        return {
          label: format(date, 'd'),
          fullDate: format(date, 'MMM d, yyyy'),
          work,
          rest,
          total: work + rest,
          isWeekend
        };
      });
    }

    if (range === 'year') {
      const yearStart = startOfYear(baseDate);
      const yearEnd = endOfYear(baseDate);
      const months = eachMonthOfInterval({ start: yearStart, end: yearEnd });

      return months.map((monthDate) => {
        const monthKey = format(monthDate, 'yyyy-MM');
        const stats = monthlyAgg[monthKey] ?? { pomodoro: 0, short: 0, long: 0 };
        const work = toWork(stats.pomodoro);
        const rest = toRest(stats.short, stats.long);
        return {
          label: format(monthDate, 'MMM'),
          fullDate: format(monthDate, 'MMMM yyyy'),
          work,
          rest,
          total: work + rest
        };
      });
    }

    const historyKeys = Object.keys(history).sort();
    if (historyKeys.length === 0) return [];
    const firstDate = parseISO(historyKeys[0]);
    const lastDate = parseISO(historyKeys[historyKeys.length - 1]);
    const months = eachMonthOfInterval({ start: startOfMonth(firstDate), end: endOfMonth(lastDate) });
    const data = months.map((monthDate) => {
      const monthKey = format(monthDate, 'yyyy-MM');
      const stats = monthlyAgg[monthKey] ?? { pomodoro: 0, short: 0, long: 0 };
      const work = toWork(stats.pomodoro);
      const rest = toRest(stats.short, stats.long);
      return {
        label: format(monthDate, 'MMM'),
        fullDate: format(monthDate, 'MMMM yyyy'),
        work,
        rest,
        total: work + rest
      };
    });
    return data.length > 24 ? data.slice(-24) : data;
  }, [baseDate, durations.long, durations.pomodoro, durations.short, history, metric, monthlyAgg, range]);

  const maxVal = useMemo(() => {
    if (graphData.length === 0) {
      const maxPomosPerDay = 20;
      const maxWork = maxPomosPerDay * durations.pomodoro;
      const maxRest = maxPomosPerDay * Math.max(durations.short, durations.long);
      return metric === 'minutes' ? (maxWork + maxRest) : maxPomosPerDay * 2;
    }
    const dataMax = Math.max(...graphData.map(d => d.total));
    return Math.max(1, Math.max(dataMax, dataMax * 0.1));
  }, [graphData, durations.pomodoro, durations.short, durations.long, metric]);

  const handlePrevious = () => {
    setOffset(prev => prev - 1);
  };

  const handleNext = () => {
    setOffset(prev => prev + 1);
  };

  const handleRangeChange = (newRange: TimeRange) => {
    setRange(newRange);
    setOffset(0); // Reset offset when changing range
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Your Progress">
      <div className="app-modal-stack text-white">

        {/* Totals Cards */}
        <div className="app-modal-section">
          <p className="app-modal-section-title">Overview</p>
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <div className="app-metric-card">
              <div className="app-metric-value truncate">{totals.pomoMins}</div>
              <div className="app-metric-label">Focus Mins</div>
            </div>

            <div className="app-metric-card">
              <div className="app-metric-value truncate">{totals.totalSessions}</div>
              <div className="app-metric-label">Sessions</div>
            </div>

            <div className="app-metric-card">
              <div className="app-metric-value truncate">{totals.breakMins}</div>
              <div className="app-metric-label">Break Mins</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <div className="app-metric-card">
            <div className="app-metric-value truncate">
              {goalSnapshot.today.completed}/{goalSnapshot.today.goal}
            </div>
            <div className="app-metric-label">Today's Goal</div>
          </div>

          <div className="app-metric-card">
            <div className="app-metric-value truncate">{goalSnapshot.focusStreak.count}</div>
            <div className="app-metric-label">Focus Streak</div>
          </div>

          <div className="app-metric-card">
            <div className="app-metric-value truncate">{goalSnapshot.goalStreak.count}</div>
            <div className="app-metric-label">Goal Streak</div>
          </div>
        </div>

        {/* Controls */}
        <div className="app-modal-section">
          <p className="app-modal-section-title">Activity View</p>
          {/* Time Range Selector */}
          <div className="app-segmented grid grid-cols-2 sm:flex gap-1">
            <button
              onClick={() => handleRangeChange('7d')}
              className={cn("px-3 py-1 text-xs font-medium rounded transition-colors", range === '7d' ? "bg-white text-black" : "text-white/50 hover:text-white")}
            >
              7 Days
            </button>
            <button
              onClick={() => handleRangeChange('month')}
              className={cn("px-3 py-1 text-xs font-medium rounded transition-colors", range === 'month' ? "bg-white text-black" : "text-white/50 hover:text-white")}
            >
              Monthly
            </button>
            <button
              onClick={() => handleRangeChange('year')}
              className={cn("px-3 py-1 text-xs font-medium rounded transition-colors", range === 'year' ? "bg-white text-black" : "text-white/50 hover:text-white")}
            >
              Yearly
            </button>
            <button
              onClick={() => handleRangeChange('all')}
              className={cn("px-3 py-1 text-xs font-medium rounded transition-colors", range === 'all' ? "bg-white text-black" : "text-white/50 hover:text-white")}
            >
              All Time
            </button>
          </div>

          {/* Navigation and Date Range */}
          <div className="app-subsurface flex flex-col gap-3 rounded-2xl p-3 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
            {/* Navigation Arrows - Hidden for All Time */}
            {range !== 'all' && (
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrevious}
                  className="p-1.5 rounded-lg bg-black/20 hover:bg-black/30 text-white/70 hover:text-white transition-colors"
                  aria-label="Previous period"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                  </svg>
                </button>
                <button
                  onClick={handleNext}
                  className="p-1.5 rounded-lg bg-black/20 hover:bg-black/30 text-white/70 hover:text-white transition-colors"
                  aria-label="Next period"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </button>
              </div>
            )}
            {range === 'all' && <div className="hidden sm:block" />} {/* Spacer when arrows are hidden */}

            {/* Date Range Display */}
            <div className="text-xs text-white/70 font-medium text-center sm:text-left">
              {dateRange}
            </div>

            {/* Metric Toggle */}
            <div className="app-segmented flex self-center sm:self-auto">
              <button
                onClick={() => setMetric('minutes')}
                className={cn("px-3 py-1 text-xs font-medium rounded transition-colors", metric === 'minutes' ? "bg-white text-black" : "text-white/50 hover:text-white")}
              >
                Time
              </button>
              <button
                onClick={() => setMetric('count')}
                className={cn("px-3 py-1 text-xs font-medium rounded transition-colors", metric === 'count' ? "bg-white text-black" : "text-white/50 hover:text-white")}
              >
                Count
              </button>
            </div>
          </div>
        </div>

        {/* The Graph */}
        <div className="app-modal-section">
          <p className="app-modal-section-title">History</p>
          <div className="app-subsurface rounded-[24px] p-3 sm:p-4">
          <div className={cn(
            "h-48 overflow-y-visible pt-4",
            range === '7d' ? "" : "overflow-x-auto custom-scrollbar"
          )}>
            <div className={cn(
              "h-full flex items-end gap-1 sm:gap-2",
              range === '7d' ? "w-full" : "min-w-fit"
            )}>
              {graphData.length === 0 && (
                <div className="w-full h-full flex items-center justify-center text-white/30 text-sm">
                  No activity recorded yet.
                </div>
              )}

              {graphData.map((d, i) => (
                <div key={i} className={cn(
                  "h-full flex flex-col justify-end group relative",
                  range === '7d' ? "flex-1" : "min-w-[20px] shrink-0"
                )}
                  aria-label={`${d.fullDate}: focus ${d.work} ${metric === 'minutes' ? 'minutes' : 'sessions'}, rest ${d.rest} ${metric === 'minutes' ? 'minutes' : 'sessions'}`}
                  title={`${d.fullDate} — Focus: ${d.work} ${metric === 'minutes' ? 'm' : 'x'}, Rest: ${d.rest} ${metric === 'minutes' ? 'm' : 'x'}`}
                >
                  {/* Tooltip */}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black text-white text-[10px] p-2 rounded whitespace-nowrap z-10 pointer-events-none shadow-xl border border-white/20">
                    <div className="font-bold border-b border-white/20 pb-1 mb-1">{d.fullDate}</div>
                    <div>Focus: {d.work} {metric === 'minutes' ? 'm' : 'x'}</div>
                    <div>Rest: {d.rest} {metric === 'minutes' ? 'm' : 'x'}</div>
                  </div>

                  {/* Bars */}
                  <div className={cn(
                    "w-full rounded-t-sm overflow-hidden flex flex-col-reverse h-full relative",
                    d.isWeekend ? "bg-white/10 border-l border-r border-white/30" : "bg-white/5"
                  )}>
                    {d.isWeekend && (
                      <div className="absolute inset-0 bg-[repeating-linear-gradient(45deg,transparent,transparent_3px,rgba(255,255,255,0.1)_3px,rgba(255,255,255,0.1)_6px)] pointer-events-none z-10" />
                    )}
                    <div 
                      style={{ height: `${(d.work / maxVal) * 100}%` }} 
                      className={cn(
                        "w-full transition-all duration-500 relative z-0",
                        d.isWeekend ? "bg-white/70" : "bg-white"
                      )} 
                    />
                    <div 
                      style={{ height: `${(d.rest / maxVal) * 100}%` }} 
                      className={cn(
                        "w-full transition-all duration-500 relative z-0",
                        d.isWeekend ? "bg-white/30" : "bg-white/40"
                      )} 
                    />
                  </div>

                  {/* Label */}
                  <div className="text-[10px] text-center text-white/50 mt-1 truncate w-full">
                    {d.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        </div>
      </div>
    </Modal>
  );
};