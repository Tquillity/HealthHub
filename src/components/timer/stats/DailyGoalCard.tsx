'use client';

import { useSettingsStore } from '@/lib/pomo-store/useSettingsStore';
import { useTimeStore } from '@/lib/pomo-store/useTimeStore';
import {
  getCurrentStreak,
  getDailyGoalProgress,
} from '@/lib/pomo/utils/historyInsights';

const pluralize = (count: number, singular: string) =>
  `${count} ${singular}${count === 1 ? '' : 's'}`;

export const DailyGoalCard = () => {
  const history = useTimeStore((state) => state.history);
  const dailyGoalPomodoros = useSettingsStore(
    (state) => state.dailyGoalPomodoros
  );

  const progress = getDailyGoalProgress(history, dailyGoalPomodoros);
  const focusStreak = getCurrentStreak(history, 1);
  const goalStreak = getCurrentStreak(history, dailyGoalPomodoros);

  const helperText = progress.met
    ? 'Goal reached for today. Keep the momentum going.'
    : !focusStreak.includesToday && focusStreak.count > 0
      ? `Start one session today to keep your ${pluralize(focusStreak.count, 'day')} focus streak alive.`
      : `${pluralize(progress.remaining, 'pomodoro')} left to hit today's goal.`;

  return (
    <section className="goal-card app-surface w-full max-w-md rounded-[28px] p-4 sm:p-5 backdrop-blur-md">
      <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <div>
          <p className="app-eyebrow">Daily Goal</p>
          <h2 className="app-card-title mt-1">{progress.completed}/{progress.goal} pomodoros</h2>
        </div>

        <div className="self-start rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/80 sm:self-auto">
          {progress.met ? 'Goal hit' : `${progress.percent}% there`}
        </div>
      </div>

      <div
        className="mt-4 h-3 overflow-hidden rounded-full border border-white/10 bg-black/20"
        aria-label={`Daily goal progress: ${progress.completed} of ${progress.goal} pomodoros completed`}
      >
        <div
          className="h-full rounded-full bg-white transition-[width] duration-500"
          style={{ width: `${progress.percent}%` }}
        />
      </div>

      <p className="app-body-copy mt-3 text-sm">{helperText}</p>

      <div className="mt-4 grid grid-cols-3 gap-1.5 sm:gap-2">
        <div className="app-metric-card">
          <div className="app-metric-value truncate">{progress.remaining}</div>
          <div className="app-metric-label">Left Today</div>
        </div>
        <div className="app-metric-card">
          <div className="app-metric-value truncate">{focusStreak.count}</div>
          <div className="app-metric-label">Focus Streak</div>
        </div>
        <div className="app-metric-card">
          <div className="app-metric-value truncate">{goalStreak.count}</div>
          <div className="app-metric-label">Goal Streak</div>
        </div>
      </div>
    </section>
  );
};
