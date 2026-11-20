import type { TimeOfDayEnergySummary } from '@/lib/circadian-data';
import {
  ENERGY_SLOTS,
  leadingEarlyEstimate,
  MIN_SLOT_DATA_POINTS,
  type EnergySlot,
} from '@/lib/circadian-recommendations';

const SLOT_TEXT: Record<EnergySlot, { label: string; hours: string }> = {
  morning: { label: 'Morning', hours: '06-12' },
  afternoon: { label: 'Afternoon', hours: '12-18' },
  evening: { label: 'Evening', hours: '18-22' },
};

function checkIns(count: number): string {
  return count === 1 ? '1 check-in' : `${count} check-ins`;
}

/**
 * Journal analytics: average energy check-in per time of day over the last 30 days
 * (circadian insights opt-in), with the personal best window once it is clear.
 */
export function JournalTimeOfDayEnergy({
  summary,
}: {
  summary: TimeOfDayEnergySummary;
}) {
  const hasData = ENERGY_SLOTS.some((slot) => summary.slots[slot].count > 0);
  const best = summary.bestWindow;
  const early = best ? null : leadingEarlyEstimate(summary.slots);

  return (
    <section
      aria-labelledby="time-of-day-energy-title"
      className="flex flex-col gap-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
    >
      <div className="flex flex-col gap-1">
        <h2
          id="time-of-day-energy-title"
          className="text-lg font-semibold text-gray-900"
        >
          Energy by time of day
        </h2>
        <p className="text-sm text-gray-500">
          Your average energy check-in over the last {summary.days} days, on a
          1-10 scale.
        </p>
      </div>

      {hasData ? (
        <>
          <dl className="flex flex-col gap-3">
            {ENERGY_SLOTS.map((slot) => {
              const { average, count, personalized } = summary.slots[slot];
              const width = average === null ? 0 : (average / 10) * 100;
              return (
                <div
                  key={slot}
                  className="grid grid-cols-[6.5rem_1fr] items-center gap-x-3 gap-y-1 sm:grid-cols-[6.5rem_1fr_11rem]"
                >
                  <dt className="flex flex-col text-sm font-medium text-gray-700">
                    <span>
                      {SLOT_TEXT[slot].label}
                      {best === slot && (
                        <span className="ml-1.5 rounded-full bg-wellness-100 px-1.5 py-0.5 text-xs font-semibold text-wellness-800">
                          Best
                        </span>
                      )}
                    </span>
                    <span className="text-xs font-normal text-gray-500">
                      {SLOT_TEXT[slot].hours}
                    </span>
                  </dt>
                  <dd aria-hidden="true" className="h-3 rounded-r bg-gray-100">
                    {average !== null && (
                      <div
                        className="h-3 rounded-r bg-primary-500"
                        style={{ width: `${width}%` }}
                      />
                    )}
                  </dd>
                  <dd className="col-start-2 text-sm text-gray-700 sm:col-start-3">
                    {average === null ? (
                      'No check-ins yet'
                    ) : (
                      <>
                        <span className="font-semibold text-gray-900">
                          {average}/10
                        </span>{' '}
                        <span className="text-gray-500">
                          from {checkIns(count)}
                          {personalized ? '' : ' (early estimate)'}
                        </span>
                      </>
                    )}
                  </dd>
                </div>
              );
            })}
          </dl>
          <p className="text-sm text-gray-600">
            {best
              ? `Your energy is usually highest in the ${best}. When you can, save harder training and demanding tasks for then.`
              : early
                ? `Too early to name your best time of day: the ${early} scores as high or higher so far, but from fewer than ${MIN_SLOT_DATA_POINTS} check-ins.`
                : `Your best time of day shows once at least two times of day have ${MIN_SLOT_DATA_POINTS} check-ins and one stands out.`}
          </p>
        </>
      ) : (
        <p className="text-sm text-gray-600">
          No energy check-ins in the last {summary.days} days. Use &quot;How is
          your energy right now?&quot; on your dashboard, or the morning,
          afternoon and evening fields when you log a journal entry.
        </p>
      )}
    </section>
  );
}
