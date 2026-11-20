'use client';

/**
 * The parts of the cycle chart that show the user's own readings (clinical mode only):
 * BBT and recovery markers, tooltip sections, legend entries and a text alternative.
 * The Recharts elements stay in cycle-chart.tsx, which positions these. Colours and
 * copy live in lib/cycle-chart-overlays.ts.
 */

import { formatTemperature, type TemperatureUnit } from '@/lib/bbt';
import {
  RECOVERY_ZONE_LABELS,
  RECOVERY_ZONE_THRESHOLDS,
  type RecoveryZone,
} from '@/lib/recovery';
import type {
  ChartBbtOverlay,
  ChartBbtPoint,
  ChartRecoveryOverlay,
  ChartRecoveryPoint,
  ThermalShiftSummary,
} from '@/lib/cycle-insights';
import {
  BIO_VERIFIED_COLOR,
  RECOVERY_ZONE_COLORS,
  bbtReadingStatus,
  formatShortDate,
  thermalShiftMessage,
} from '@/lib/cycle-chart-overlays';

const ZONE_DOT_CLASSES: Record<RecoveryZone, string> = {
  green: 'bg-green-600',
  yellow: 'bg-amber-600',
  red: 'bg-red-600',
};

/** Green check drawn above the reading on the bio-verified ovulation day. */
export function BioVerifiedMarker({ cx, cy }: { cx?: number; cy?: number }) {
  if (cx === undefined || cy === undefined) return <g />;
  const y = cy - 20;
  return (
    <g>
      <title>
        Bio-verified: your temperature rise confirms ovulation around this day
      </title>
      <line
        x1={cx}
        y1={cy - 5}
        x2={cx}
        y2={y + 9}
        stroke={BIO_VERIFIED_COLOR}
        strokeWidth={1.5}
      />
      <circle
        cx={cx}
        cy={y}
        r={9}
        fill={BIO_VERIFIED_COLOR}
        stroke="#ffffff"
        strokeWidth={2}
      />
      <path
        d={`M ${cx - 4} ${y} l 3 3 l 5 -6`}
        fill="none"
        stroke="#ffffff"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  );
}

/** Zone-coloured dot, or a red triangle on a bigger-than-usual dip. */
export function RecoveryDot({
  cx,
  cy,
  point,
}: {
  cx?: number;
  cy?: number;
  point?: ChartRecoveryPoint;
}) {
  if (cx === undefined || cy === undefined || !point) return null;
  if (point.alert) {
    return (
      <g>
        <title>{`Day ${point.day}: recovery ${point.score}, a bigger dip than usual`}</title>
        <path
          d={`M ${cx} ${cy - 7} L ${cx + 7} ${cy + 5} L ${cx - 7} ${cy + 5} Z`}
          fill={RECOVERY_ZONE_COLORS.red}
          stroke="#ffffff"
          strokeWidth={1.5}
        />
      </g>
    );
  }
  return (
    <circle
      cx={cx}
      cy={cy}
      r={4}
      fill={RECOVERY_ZONE_COLORS[point.zone]}
      stroke="#ffffff"
      strokeWidth={1.5}
    />
  );
}

export function BbtTooltipSection({
  point,
  unit,
  shift,
}: {
  point: ChartBbtPoint;
  unit: TemperatureUnit;
  shift: ThermalShiftSummary;
}) {
  return (
    <div className="flex flex-col gap-0.5 mt-2 pt-2 border-t border-gray-100">
      <p className="text-xs text-gray-700">
        <span className="inline-block w-2 h-2 rounded-full bg-orange-600 mr-2" />
        BBT:{' '}
        <span className="font-medium">
          {formatTemperature(point.celsius, unit)}
        </span>
      </p>
      <p className="text-[11px] text-gray-500">
        {bbtReadingStatus(point.date, shift)}
      </p>
    </div>
  );
}

function vitalsLine(point: ChartRecoveryPoint): string {
  const parts: string[] = [];
  if (point.restingHeartRate !== null) {
    parts.push(`RHR ${point.restingHeartRate} bpm`);
  }
  if (point.heartRateVariability !== null) {
    parts.push(`HRV ${point.heartRateVariability} ms`);
  }
  if (point.sleepQuality !== null) parts.push(`Sleep ${point.sleepQuality}/10`);
  if (point.sleepHours !== null) parts.push(`${point.sleepHours} h`);
  return parts.join(' · ');
}

export function RecoveryTooltipSection({
  point,
}: {
  point: ChartRecoveryPoint;
}) {
  const vitals = vitalsLine(point);
  return (
    <div className="flex flex-col gap-0.5 mt-2 pt-2 border-t border-gray-100">
      <p className="text-xs text-gray-700">
        <span
          className={`inline-block w-2 h-2 rounded-full mr-2 ${ZONE_DOT_CLASSES[point.zone]}`}
        />
        Recovery: <span className="font-medium">{point.score}/100</span> ·{' '}
        {RECOVERY_ZONE_LABELS[point.zone]}
      </p>
      {vitals && <p className="text-[11px] text-gray-500">{vitals}</p>}
      {point.drop !== null && point.drop > 0 && point.usualScore !== null && (
        <p className="text-[11px] text-gray-500">
          {point.drop} points below your usual {point.usualScore}
        </p>
      )}
      {point.alert && (
        <p className="text-[11px] font-medium text-red-600">
          A bigger dip than usual. An easier day may help.
        </p>
      )}
    </div>
  );
}

export function OverlayLegend({
  bbt,
  recovery,
}: {
  bbt: ChartBbtOverlay | null;
  recovery: ChartRecoveryOverlay | null;
}) {
  if (!bbt && !recovery) return null;
  return (
    <div className="flex flex-wrap gap-4 text-xs text-gray-500">
      {bbt && (
        <>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-0.5 rounded-full bg-orange-600" />
            <span>BBT: your waking temperature (°{bbt.unit})</span>
          </div>
          {bbt.coverline !== null && (
            <div className="flex items-center gap-1.5">
              <div className="w-3 border-t-2 border-dashed border-orange-600" />
              <span>Coverline: highest of the 6 readings before the rise</span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-green-600" />
            <span>
              Bio-verified: 3 higher readings confirm ovulation (an estimate)
            </span>
          </div>
        </>
      )}
      {recovery && (
        <>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-green-600" />
            <span>
              Recovery {RECOVERY_ZONE_THRESHOLDS.green}+:{' '}
              {RECOVERY_ZONE_LABELS.green.toLowerCase()}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-amber-600" />
            <span>
              {RECOVERY_ZONE_THRESHOLDS.yellow}-
              {RECOVERY_ZONE_THRESHOLDS.green - 1}:{' '}
              {RECOVERY_ZONE_LABELS.yellow.toLowerCase()}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-red-600" />
            <span>
              Below {RECOVERY_ZONE_THRESHOLDS.yellow}:{' '}
              {RECOVERY_ZONE_LABELS.red.toLowerCase()}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span aria-hidden="true" className="text-red-600">
              ▲
            </span>
            <span>A bigger dip than usual</span>
          </div>
          {recovery.phaseBaselines.length > 0 && (
            <div className="flex items-center gap-1.5">
              <div className="w-3 border-t-2 border-dashed border-gray-400" />
              <span>Your usual recovery in each phase</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** Screen-reader text alternative for the user's own readings on the chart. */
export function OverlayTextSummary({
  bbt,
  recovery,
}: {
  bbt: ChartBbtOverlay | null;
  recovery: ChartRecoveryOverlay | null;
}) {
  if (!bbt && !recovery) return null;
  const dips = recovery?.points.filter((p) => p.alert) ?? [];
  return (
    <div className="sr-only">
      {bbt && (
        <>
          <p>
            Your temperature readings on this chart:{' '}
            {bbt.points
              .map(
                (p) =>
                  `day ${p.day} (${formatShortDate(p.date)}) ${formatTemperature(p.celsius, bbt.unit)}`
              )
              .join('; ')}
            .
          </p>
          <p>{thermalShiftMessage(bbt.shift, bbt.unit)}</p>
        </>
      )}
      {recovery && (
        <>
          <p>
            Your recovery scores on this chart:{' '}
            {recovery.points
              .map(
                (p) =>
                  `day ${p.day} ${p.score} (${RECOVERY_ZONE_LABELS[p.zone].toLowerCase()})`
              )
              .join('; ')}
            .
          </p>
          <p>
            {dips.length > 0
              ? `Bigger dips than usual on ${dips
                  .map((p) => `day ${p.day}`)
                  .join(', ')}.`
              : 'No bigger-than-usual dips.'}
          </p>
        </>
      )}
    </div>
  );
}
