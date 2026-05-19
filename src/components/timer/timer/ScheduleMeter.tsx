'use client';

import { useTimeStore } from '@/lib/pomo-store/useTimeStore';
import { cn } from '@/lib/utils';
import {
  getCurrentCycleLabel,
  getCurrentScheduleStep,
  getCurrentSessionProgress,
  getNextCycleLabel,
  getScheduleSegments,
} from '@/lib/pomo/utils/timerSchedule';

export const ScheduleMeter = () => {
  const mode = useTimeStore((state) => state.mode);
  const pomodorosCompleted = useTimeStore((state) => state.pomodorosCompleted);
  const timeLeft = useTimeStore((state) => state.timeLeft);

  const currentStep = getCurrentScheduleStep(mode, pomodorosCompleted);
  const progress = getCurrentSessionProgress(mode, timeLeft);
  const currentLabel = getCurrentCycleLabel(mode, pomodorosCompleted);
  const nextLabel = getNextCycleLabel(mode, pomodorosCompleted);
  const segments = getScheduleSegments();

  return (
    <section
      className="w-full max-w-md sm:max-w-lg shrink-0 mb-1 sm:mb-2 md:mb-3"
      aria-label={`Pomodoro cycle progress. ${currentLabel}. Next up: ${nextLabel}.`}
    >
      <div className="flex flex-col gap-1.5 mb-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-[0.18em] text-white/60">
          Cycle Meter
        </p>
        <p className="text-[11px] sm:text-xs text-left sm:text-right text-white/70">
          Next: <span className="text-white">{nextLabel}</span>
        </p>
      </div>

      <div className="flex gap-1 sm:gap-2" role="list" aria-label="Cycle steps">
        {segments.map((segment, index) => {
          const isComplete = index < currentStep;
          const isCurrent = index === currentStep;
          const fillWidth = isComplete ? 100 : isCurrent ? progress * 100 : 0;

          return (
            <div
              key={segment.key}
              className={cn(
                'flex min-w-0 flex-col gap-1',
                segment.kind === 'focus' ? 'flex-[1.35]' : 'flex-1'
              )}
              role="listitem"
              aria-current={isCurrent ? 'step' : undefined}
              aria-label={`${segment.label}${isCurrent ? ', current step' : isComplete ? ', completed' : ''}`}
              title={segment.label}
            >
              <div className="relative h-2.5 sm:h-3 rounded-full overflow-hidden bg-black/20 border border-white/10">
                <div
                  className={cn(
                    'absolute inset-y-0 left-0 rounded-full transition-[width,opacity] duration-500',
                    isCurrent ? 'bg-white' : 'bg-white/65'
                  )}
                  style={{
                    width: `${fillWidth}%`,
                    opacity: fillWidth === 0 ? 0 : 1,
                  }}
                />
              </div>

              <span
                className={cn(
                  'truncate text-center text-[9px] sm:text-[11px] font-semibold uppercase tracking-wide transition-colors',
                  isCurrent
                    ? 'text-white'
                    : isComplete
                      ? 'text-white/70'
                      : 'text-white/35'
                )}
              >
                {segment.shortLabel}
              </span>
            </div>
          );
        })}
      </div>

      <p className="mt-2 text-[11px] sm:text-sm text-white/75 text-center">
        {currentLabel}
      </p>
    </section>
  );
};
