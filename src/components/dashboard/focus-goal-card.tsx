'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Timer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DEFAULT_DAILY_GOAL_POMODOROS,
  getDashboardTimerProgress,
  parseDailyGoalFromStorage,
  parseHistoryFromStorage,
  POMO_SETTINGS_STORAGE_KEY,
  POMO_TIME_STORAGE_KEY,
} from '@/lib/pomo/utils/dashboard-timer-snapshot';

export function FocusGoalCard() {
  const [progress, setProgress] = useState<{
    completed: number;
    goal: number;
    percent: number;
    met: boolean;
    remaining: number;
  } | null>(null);

  useEffect(() => {
    const refresh = () => {
      if (typeof window === 'undefined') {
        return;
      }

      const history = parseHistoryFromStorage(
        window.localStorage.getItem(POMO_TIME_STORAGE_KEY)
      );
      const dailyGoal = parseDailyGoalFromStorage(
        window.localStorage.getItem(POMO_SETTINGS_STORAGE_KEY)
      );
      const next = getDashboardTimerProgress(history, dailyGoal);
      setProgress({
        completed: next.completed,
        goal: next.goal,
        percent: next.percent,
        met: next.met,
        remaining: next.remaining,
      });
    };

    refresh();
    window.addEventListener('storage', refresh);
    window.addEventListener('focus', refresh);

    return () => {
      window.removeEventListener('storage', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, []);

  const completed = progress?.completed ?? 0;
  const goal = progress?.goal ?? DEFAULT_DAILY_GOAL_POMODOROS;
  const percent = progress?.percent ?? 0;
  const met = progress?.met ?? false;
  const remaining = progress?.remaining ?? goal;

  return (
    <div className="rounded-lg border border-primary-100 bg-linear-to-br from-primary-50 to-wellness-50 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary-600">
            Focus today
          </p>
          <h3 className="text-xl font-semibold text-gray-900">
            {completed}/{goal} pomodoros
          </h3>
          <p className="text-sm text-gray-600">
            {met
              ? 'Daily goal reached — nice work.'
              : `${remaining} more to hit your timer goal.`}
          </p>
        </div>
        <Link href="/timer" className="shrink-0">
          <Button className="min-h-[44px] gap-2 bg-primary-600 hover:bg-primary-700">
            <Timer className="h-4 w-4" aria-hidden />
            Open timer
          </Button>
        </Link>
      </div>

      <div
        className="mt-4 h-2 overflow-hidden rounded-full bg-white/70"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={goal}
        aria-valuenow={completed}
        aria-label={`Daily pomodoro progress: ${completed} of ${goal}`}
      >
        <div
          className="h-full rounded-full bg-primary-500 transition-[width] duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-gray-500">
        Read-only snapshot from your local timer. Data stays on this device.
      </p>
    </div>
  );
}
