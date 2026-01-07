'use client';

/**
 * CycleChart Component
 * 
 * Interactive Recharts visualization of the menstrual cycle with phase-based backgrounds.
 * 
 * Features:
 * - Line chart showing energy/intensity levels throughout the cycle
 * - Color-coded phase backgrounds (ReferenceArea) for visual phase identification:
 *   * Menstrual (Days 1-5): Rose background
 *   * Follicular (Days 6-14): Fuchsia background
 *   * Ovulation (Days 15-18): Amber background
 *   * Luteal (Days 19+): Indigo background
 * - Interactive tooltips showing day, phase, and energy level
 * - Current day indicator (vertical dashed line)
 * - Phase legend and contextual information card
 * 
 * Technical Implementation:
 * - Uses Recharts ResponsiveContainer for mobile-friendly rendering
 * - ReferenceArea components create seamless phase backgrounds with 0.5 offset for full coverage
 * - Energy curve models typical hormonal energy fluctuations throughout cycle
 * - XAxis domain extends to [0.5, cycleLength + 0.5] to accommodate phase boundaries
 * - Line animation (1500ms) provides smooth "drawing" effect on initial load for premium feel
 */

import React, { useEffect, useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceArea,
  ReferenceLine,
  CartesianGrid,
  Dot,
} from 'recharts';
import { CyclePhase, CyclePhaseResult, PHASE_LENGTHS } from '@/lib/cycle-calculator';
import { generateHormoneCurves } from '@/lib/hormone-math';
import { useQueryState } from 'nuqs';
import { parseAsString } from 'nuqs';
import { useRouter } from 'next/navigation';
import { SeriesSelector, getVisibleSeries, SeriesType } from './series-selector';

interface CycleChartProps {
  phaseData: CyclePhaseResult;
  cycleLength: number;
  lastPeriodDate: Date; // Required to calculate actual dates for each day
  onPhaseHover?: (phase: CyclePhase | null) => void;
  onPhaseClick?: (phase: CyclePhase) => void;
  onDayClick?: (date: Date, day: number) => void; // New: handle individual day clicks
  mode?: 'lifestyle' | 'clinical'; // Mode toggle for UI complexity
}

const PHASE_COLORS: Record<CyclePhase, string> = {
  menstrual: '#f43f5e', // rose-500
  follicular: '#d946ef', // fuchsia-500
  ovulation: '#f59e0b', // amber-500
  luteal: '#6366f1', // indigo-500
};

const PHASE_NAMES: Record<CyclePhase, string> = {
  menstrual: 'Menstrual',
  follicular: 'Follicular',
  ovulation: 'Ovulation',
  luteal: 'Luteal',
};

/**
 * Generate intensity/energy data for the cycle
 * This represents typical energy levels throughout the cycle
 */
function generateEnergyData(cycleLength: number, currentDay: number) {
  return Array.from({ length: cycleLength }, (_, i) => {
    const day = i + 1;
    
    // Calculate intensity based on phase
    // Menstrual: Lower energy (2-4)
    // Follicular: Rising energy (4-7)
    // Ovulation: Peak energy (8-10)
    // Luteal: Declining energy (6-3)
    let intensity = 5;
    
    if (day <= PHASE_LENGTHS.MENSTRUAL) {
      // Menstrual phase: low energy
      intensity = 3 + (day / PHASE_LENGTHS.MENSTRUAL) * 1;
    } else if (day <= PHASE_LENGTHS.MENSTRUAL + PHASE_LENGTHS.FOLLICULAR) {
      // Follicular phase: rising energy
      const follicularDay = day - PHASE_LENGTHS.MENSTRUAL;
      intensity = 4 + (follicularDay / PHASE_LENGTHS.FOLLICULAR) * 3;
    } else if (day <= PHASE_LENGTHS.MENSTRUAL + PHASE_LENGTHS.FOLLICULAR + PHASE_LENGTHS.OVULATION) {
      // Ovulation phase: peak energy
      intensity = 8 + (day - PHASE_LENGTHS.MENSTRUAL - PHASE_LENGTHS.FOLLICULAR) * 0.5;
    } else {
      // Luteal phase: declining energy
      const lutealDay = day - PHASE_LENGTHS.MENSTRUAL - PHASE_LENGTHS.FOLLICULAR - PHASE_LENGTHS.OVULATION;
      const lutealLength = cycleLength - PHASE_LENGTHS.MENSTRUAL - PHASE_LENGTHS.FOLLICULAR - PHASE_LENGTHS.OVULATION;
      intensity = 8.5 - (lutealDay / lutealLength) * 5;
    }

    return {
      day,
      intensity: Math.round(intensity * 10) / 10,
      isCurrentDay: day === currentDay,
    };
  });
}

/**
 * Merge energy and hormone data for chart display
 * Memoized for performance
 */
function mergeChartData(
  energyData: ReturnType<typeof generateEnergyData>,
  hormoneCurves: ReturnType<typeof generateHormoneCurves>
) {
  return energyData.map((energyPoint) => {
    const day = energyPoint.day;
    const estrogen = hormoneCurves.estrogen.find((h) => h.day === day);
    const progesterone = hormoneCurves.progesterone.find((h) => h.day === day);
    const lh = hormoneCurves.lh.find((h) => h.day === day);
    const fsh = hormoneCurves.fsh.find((h) => h.day === day);
    const testosterone = hormoneCurves.testosterone.find((h) => h.day === day);

    return {
      ...energyPoint,
      estrogen: estrogen?.referenceValue ?? 0,
      progesterone: progesterone?.referenceValue ?? 0,
      lh: lh?.referenceValue ?? 0,
      fsh: fsh?.referenceValue ?? 0,
      testosterone: testosterone?.referenceValue ?? 0,
    };
  });
}

/**
 * Get phase boundaries for ReferenceArea
 * Using 0.5 offsets to ensure seamless coverage between phases
 */
function getPhaseBoundaries(cycleLength: number) {
  const menstrualEnd = PHASE_LENGTHS.MENSTRUAL;
  const follicularEnd = PHASE_LENGTHS.MENSTRUAL + PHASE_LENGTHS.FOLLICULAR;
  const ovulationEnd = PHASE_LENGTHS.MENSTRUAL + PHASE_LENGTHS.FOLLICULAR + PHASE_LENGTHS.OVULATION;
  const lutealEnd = cycleLength;

  return [
    { phase: 'menstrual' as CyclePhase, start: 0.5, end: menstrualEnd + 0.5 },
    { phase: 'follicular' as CyclePhase, start: menstrualEnd + 0.5, end: follicularEnd + 0.5 },
    { phase: 'ovulation' as CyclePhase, start: follicularEnd + 0.5, end: ovulationEnd + 0.5 },
    { phase: 'luteal' as CyclePhase, start: ovulationEnd + 0.5, end: lutealEnd + 0.5 },
  ];
}

/**
 * Custom Tooltip Component for Recharts
 * 
 * Displays detailed information when hovering over chart data points.
 * Shows: day number, current phase name, energy level, hormone levels (only visible ones), and "Today" indicator.
 * Also triggers onPhaseHover callback to update hovered phase state.
 */
const CustomTooltip = ({ active, payload, label, onPhaseHover, visibleSeries }: any) => {
  useEffect(() => {
    if (active && payload && payload.length) {
      const day = payload[0].payload.day;
      // Determine phase for this day
      let phase: CyclePhase = 'luteal';
      if (day <= PHASE_LENGTHS.MENSTRUAL) {
        phase = 'menstrual';
      } else if (day <= PHASE_LENGTHS.MENSTRUAL + PHASE_LENGTHS.FOLLICULAR) {
        phase = 'follicular';
      } else if (day <= PHASE_LENGTHS.MENSTRUAL + PHASE_LENGTHS.FOLLICULAR + PHASE_LENGTHS.OVULATION) {
        phase = 'ovulation';
      }
      onPhaseHover?.(phase);
    } else {
      onPhaseHover?.(null);
    }
  }, [active, payload, label, onPhaseHover]);

  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const day = data.day;
    
    // Determine phase for this day based on PHASE_LENGTHS constants
    let phase: CyclePhase = 'luteal';
    if (day <= PHASE_LENGTHS.MENSTRUAL) {
      phase = 'menstrual';
    } else if (day <= PHASE_LENGTHS.MENSTRUAL + PHASE_LENGTHS.FOLLICULAR) {
      phase = 'follicular';
    } else if (day <= PHASE_LENGTHS.MENSTRUAL + PHASE_LENGTHS.FOLLICULAR + PHASE_LENGTHS.OVULATION) {
      phase = 'ovulation';
    }

    // Extract values from payload
    const energy = data.intensity;
    const estrogen = data.estrogen;
    const progesterone = data.progesterone;
    const lh = data.lh;
    const fsh = data.fsh;
    const testosterone = data.testosterone;

    // Check if any hormone is visible
    const hasVisibleHormones = visibleSeries?.some((s: SeriesType) => 
      ['estrogen', 'progesterone', 'lh', 'fsh', 'testosterone'].includes(s)
    );

    return (
      <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-lg">
        <p className="font-semibold text-gray-900 mb-2">Day {day}</p>
        <p className="text-sm text-gray-600 mb-2">
          <span className="font-medium">{PHASE_NAMES[phase]}</span> Phase
        </p>
        
        {/* Energy Level - Only show if visible */}
        {visibleSeries?.includes('energy') && energy !== undefined && (
          <p className="text-sm text-gray-700 mb-1">
            <span className="inline-block w-2 h-2 rounded-full bg-indigo-500 mr-2" />
            Energy: <span className="font-medium">{energy}/10</span>
          </p>
        )}
        
        {/* Hormone Levels - Only show if visible */}
        {hasVisibleHormones && (
          <div className="flex flex-col gap-1 mt-2 pt-2 border-t border-gray-100">
            {visibleSeries?.includes('estrogen') && estrogen !== undefined && (
              <p className="text-xs text-gray-600">
                <span className="inline-block w-2 h-2 rounded-full bg-blue-500 mr-2" />
                Estrogen: <span className="font-medium">{Math.round(estrogen)}%</span>
              </p>
            )}
            {visibleSeries?.includes('progesterone') && progesterone !== undefined && (
              <p className="text-xs text-gray-600">
                <span className="inline-block w-2 h-2 rounded-full bg-purple-500 mr-2" />
                Progesterone: <span className="font-medium">{Math.round(progesterone)}%</span>
              </p>
            )}
            {visibleSeries?.includes('lh') && lh !== undefined && (
              <p className="text-xs text-gray-600">
                <span className="inline-block w-2 h-2 rounded-full bg-green-500 mr-2" />
                LH: <span className="font-medium">{Math.round(lh)}%</span>
              </p>
            )}
            {visibleSeries?.includes('fsh') && fsh !== undefined && (
              <p className="text-xs text-gray-600">
                <span className="inline-block w-2 h-2 rounded-full bg-gray-400 mr-2" />
                FSH: <span className="font-medium">{Math.round(fsh)}%</span>
              </p>
            )}
            {visibleSeries?.includes('testosterone') && testosterone !== undefined && (
              <p className="text-xs text-gray-600">
                <span className="inline-block w-2 h-2 rounded-full bg-orange-500 mr-2" />
                Testosterone: <span className="font-medium">{Math.round(testosterone)}%</span>
              </p>
            )}
          </div>
        )}
        
        {data.isCurrentDay && (
          <p className="text-xs text-primary-600 font-medium mt-2 pt-2 border-t border-gray-100">Today</p>
        )}
      </div>
    );
  }
  return null;
};

export function CycleChart({ phaseData, cycleLength, lastPeriodDate, onPhaseHover, onPhaseClick, onDayClick, mode = 'lifestyle' }: CycleChartProps) {
  const { currentPhase, daysIntoCycle, ovulationDay } = phaseData;
  const router = useRouter();

  // Get visible series from URL state
  const [visibleSeriesStr] = useQueryState(
    'show',
    parseAsString.withDefault('energy')
  );
  const visibleSeries = useMemo(() => getVisibleSeries(visibleSeriesStr), [visibleSeriesStr]);

  // Memoize data generation for performance
  const energyData = useMemo(
    () => generateEnergyData(cycleLength, daysIntoCycle),
    [cycleLength, daysIntoCycle]
  );

  const hormoneCurves = useMemo(
    () => generateHormoneCurves(cycleLength),
    [cycleLength]
  );

  const chartData = useMemo(
    () => mergeChartData(energyData, hormoneCurves),
    [energyData, hormoneCurves]
  );

  // Calculate dynamic phase boundaries (matching cycle-calculator.ts logic)
  // This ensures ReferenceArea backgrounds align with actual phase calculations
  // Using 0.5 offset for seamless coverage (prevents white gaps between phase zones)
  const phaseBoundaries = useMemo(() => {
    const calculatedOvulationDay = ovulationDay || Math.max(cycleLength - 14, 14);
    const menstrualEnd = PHASE_LENGTHS.MENSTRUAL; // Day 5
    const follicularEnd = calculatedOvulationDay - 4; // Follicular ends 4 days before ovulation
    const ovulationStart = calculatedOvulationDay - 3; // Ovulation window starts 3 days before ovulation day
    const ovulationEnd = calculatedOvulationDay;
    const lutealStart = calculatedOvulationDay + 1; // Luteal starts the day after ovulation
    
    return {
      menstrualEnd: menstrualEnd + 0.5, // Day 5.5 (end of day 5)
      follicularStart: menstrualEnd + 0.5, // Day 5.5 (start of day 6)
      follicularEnd: follicularEnd + 0.5, // End of follicular phase
      ovulationStart: ovulationStart + 0.5, // Start of ovulation window
      ovulationEnd: ovulationEnd + 0.5, // End of ovulation (day ovulationDay.5)
      lutealStart: lutealStart + 0.5, // Start of luteal (day after ovulation + 0.5)
      lutealEnd: cycleLength + 0.5, // End of cycle
    };
  }, [cycleLength, ovulationDay]);

  // Handle phase area clicks - Navigate to deep dive with mode preserved
  const handlePhaseClick = (phase: CyclePhase) => {
    if (onPhaseClick) {
      onPhaseClick(phase);
    } else {
      // Default behavior: navigate to phase detail with current mode preserved
      router.push(`/cycle?phase=${phase}&view=detail&mode=${mode}`);
    }
  };

  // Calculate actual date for a given day in the cycle
  const getDateForDay = (day: number): Date => {
    const date = new Date(lastPeriodDate);
    date.setDate(date.getDate() + (day - 1));
    return date;
  };

  // Handle day dot clicks
  const handleDayClick = (day: number) => {
    const date = getDateForDay(day);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    date.setHours(0, 0, 0, 0);

    // Only allow clicks on past days
    if (date <= today && onDayClick) {
      onDayClick(date, day);
    }
  };

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Cycle Overview</h3>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <span className="font-medium">Day {daysIntoCycle} of {cycleLength}</span>
          <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
            {PHASE_NAMES[currentPhase]} Phase
          </span>
        </div>
      </div>

      {/* Recharts Visualization - Full Height Card */}
      <div className="w-full flex-1 min-h-[350px]" style={{ width: '100%', minHeight: '350px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 40, right: 60, left: 50, bottom: 10 }}
            onMouseLeave={() => onPhaseHover?.(null)}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            
            {/* Phase Background Areas - Clickable regions for deep dive */}
            {/* Using dynamic phase boundaries with 0.5 offset for seamless coverage (prevents white gaps) */}
            {/* isFront={false} ensures backgrounds stay behind lines and dots */}
            <ReferenceArea
              x1={0.5}
              x2={phaseBoundaries.menstrualEnd}
              fill={PHASE_COLORS.menstrual}
              fillOpacity={0.15}
              stroke={PHASE_COLORS.menstrual}
              strokeOpacity={0.3}
              isFront={false}
              onClick={() => handlePhaseClick('menstrual')}
              style={{ cursor: 'pointer' }}
              pointerEvents="auto"
            />
            <ReferenceArea
              x1={phaseBoundaries.follicularStart}
              x2={phaseBoundaries.follicularEnd}
              fill={PHASE_COLORS.follicular}
              fillOpacity={0.15}
              stroke={PHASE_COLORS.follicular}
              strokeOpacity={0.3}
              isFront={false}
              onClick={() => handlePhaseClick('follicular')}
              style={{ cursor: 'pointer' }}
              pointerEvents="auto"
            />
            <ReferenceArea
              x1={phaseBoundaries.ovulationStart}
              x2={phaseBoundaries.ovulationEnd}
              fill={PHASE_COLORS.ovulation}
              fillOpacity={0.15}
              stroke={PHASE_COLORS.ovulation}
              strokeOpacity={0.3}
              isFront={false}
              onClick={() => handlePhaseClick('ovulation')}
              style={{ cursor: 'pointer' }}
              pointerEvents="auto"
            />
            <ReferenceArea
              x1={phaseBoundaries.lutealStart}
              x2={phaseBoundaries.lutealEnd}
              fill={PHASE_COLORS.luteal}
              fillOpacity={0.15}
              stroke={PHASE_COLORS.luteal}
              strokeOpacity={0.3}
              isFront={false}
              onClick={() => handlePhaseClick('luteal')}
              style={{ cursor: 'pointer' }}
              pointerEvents="auto"
            />

            <XAxis
              dataKey="day"
              type="number"
              scale="linear"
              domain={[0.5, cycleLength + 0.5]}
              tick={{ fontSize: 12, fill: '#6b7280' }}
              tickCount={Math.min(cycleLength, 7)}
              label={{ value: 'Day', position: 'insideBottom', offset: -5, style: { fill: '#6b7280' } }}
            />
            
            {/* Left Y-Axis: Energy Level (0-10) - Always show if energy is visible */}
            {visibleSeries.includes('energy') && (
              <YAxis
                yAxisId="left"
                domain={[0, 10]}
                tick={{ fontSize: 12, fill: '#6366f1' }}
                label={{ value: 'Energy Level', angle: -90, position: 'insideLeft', style: { fill: '#6366f1' } }}
              />
            )}
            
            {/* Right Y-Axis: Hormone Levels (0-100) - Show if any hormone is visible */}
            {visibleSeries.some((s) => ['estrogen', 'progesterone', 'lh', 'fsh', 'testosterone'].includes(s)) && (
              <YAxis
                yAxisId="right"
                orientation="right"
                domain={[0, 100]}
                tick={{ fontSize: 12, fill: '#6b7280' }}
                label={{ value: 'Hormone Level (%)', angle: 90, position: 'insideRight', style: { fill: '#6b7280' } }}
              />
            )}
            <Tooltip content={(props) => <CustomTooltip {...props} onPhaseHover={onPhaseHover} visibleSeries={visibleSeries} />} />
            
            {/* Today Marker - Vertical Reference Line with Enhanced Visibility */}
            <ReferenceLine
              x={daysIntoCycle}
              stroke="#1f2937"
              strokeWidth={3}
              strokeDasharray="5 5"
              label={({ viewBox }: any) => {
                if (!viewBox || viewBox.x === undefined) return null;
                // Position label in the top margin area (above chart plot area)
                const labelY = -12; // Position in the top margin area, adjusted for better visibility
                return (
                  <g>
                    {/* Background rectangle for better visibility */}
                    <rect
                      x={viewBox.x - 32}
                      y={labelY - 12}
                      width={64}
                      height={24}
                      fill="#1f2937"
                      rx={4}
                      opacity={0.98}
                      stroke="#ffffff"
                      strokeWidth={1.5}
                    />
                    {/* Label text */}
                    <text
                      x={viewBox.x}
                      y={labelY + 2}
                      textAnchor="middle"
                      fill="#ffffff"
                      fontSize={13}
                      fontWeight="bold"
                      style={{ pointerEvents: 'none', userSelect: 'none' }}
                    >
                      Today
                    </text>
                  </g>
                );
              }}
            />
            
            {/* Energy Level Line - Left Y-Axis (0-10) */}
            {visibleSeries.includes('energy') && (
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="intensity"
                stroke="#6366f1"
                strokeWidth={3}
              dot={(props: any) => {
                const day = props.payload?.day;
                const isCurrentDay = props.payload?.isCurrentDay;
                const date = day ? getDateForDay(day) : null;
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const isPastDay = date && date <= today;

                // Custom dot with enhanced pulsing animation for current day
                if (isCurrentDay) {
                  return (
                    <g key={props.key}>
                      {/* Outer pulsing ring - animated */}
                      <circle
                        cx={props.cx}
                        cy={props.cy}
                        r={14}
                        fill="#6366f1"
                        fillOpacity={0.15}
                      >
                        <animate
                          attributeName="r"
                          values="12;16;12"
                          dur="2s"
                          repeatCount="indefinite"
                        />
                        <animate
                          attributeName="fillOpacity"
                          values="0.2;0.4;0.2"
                          dur="2s"
                          repeatCount="indefinite"
                        />
                      </circle>
                      {/* Middle ring */}
                      <circle
                        cx={props.cx}
                        cy={props.cy}
                        r={10}
                        fill="#6366f1"
                        fillOpacity={0.5}
                      />
                      {/* Inner solid dot with white border */}
                      <circle
                        cx={props.cx}
                        cy={props.cy}
                        r={8}
                        fill="#6366f1"
                        stroke="#ffffff"
                        strokeWidth={3}
                      />
                      {/* Center highlight */}
                      <circle
                        cx={props.cx}
                        cy={props.cy}
                        r={4}
                        fill="#ffffff"
                        fillOpacity={0.9}
                      />
                    </g>
                  );
                }

                // Clickable dots for past days
                if (isPastDay) {
                  return (
                    <g
                      key={props.key}
                      onClick={() => handleDayClick(day)}
                      style={{ cursor: 'pointer' }}
                    >
                      <circle
                        cx={props.cx}
                        cy={props.cy}
                        r={5}
                        fill="#6366f1"
                        stroke="#fff"
                        strokeWidth={2}
                        className="hover:r-6 transition-all"
                      />
                    </g>
                  );
                }

                // Future days - smaller, non-interactive
                return <Dot {...props} r={3} fill="#6366f1" fillOpacity={0.5} />;
              }}
                activeDot={{ r: 6, fill: '#4f46e5' }}
                isAnimationActive={true}
                animationDuration={1500}
              />
            )}

            {/* Hormone Lines - Right Y-Axis (0-100) - Dashed style */}
            {visibleSeries.includes('estrogen') && (
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="estrogen"
                stroke="#3b82f6"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={false}
                isAnimationActive={true}
                animationDuration={1500}
              />
            )}

            {visibleSeries.includes('progesterone') && (
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="progesterone"
                stroke="#a855f7"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={false}
                isAnimationActive={true}
                animationDuration={1500}
              />
            )}

            {visibleSeries.includes('lh') && (
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="lh"
                stroke="#22c55e"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={false}
                isAnimationActive={true}
                animationDuration={1500}
              />
            )}

            {visibleSeries.includes('fsh') && (
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="fsh"
                stroke="#9ca3af"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={false}
                isAnimationActive={true}
                animationDuration={1500}
              />
            )}

            {visibleSeries.includes('testosterone') && (
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="testosterone"
                stroke="#f97316"
                strokeWidth={2}
                strokeDasharray="8 4"
                dot={false}
                isAnimationActive={true}
                animationDuration={1500}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Interactive Series Selector - Only show in clinical mode */}
      {mode === 'clinical' && <SeriesSelector />}

      {/* Phase Legend with Tooltips (Clinical Mode Only) */}
      {mode === 'clinical' && (
        <div className="flex flex-col gap-3 pt-4 border-t border-gray-200">
          <div className="flex flex-wrap gap-4">
            {Object.entries(PHASE_NAMES).map(([phase, name]) => (
              <div key={phase} className="flex items-center gap-2">
                <div
                  className="w-4 h-4 rounded"
                  style={{ backgroundColor: PHASE_COLORS[phase as CyclePhase] }}
                />
                <span className="text-sm text-gray-600">{name}</span>
              </div>
            ))}
          </div>
          
          {/* Hormone Tooltips */}
          <div className="flex flex-wrap gap-4 text-xs text-gray-500">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span>LH: Triggers the release of the egg</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-gray-400" />
              <span>FSH: Recruits and matures follicles</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-orange-500" />
              <span>Testosterone: Peaks during ovulation, supports strength</span>
            </div>
          </div>
        </div>
      )}
      
      {/* Simple Phase Legend (Lifestyle Mode) */}
      {mode === 'lifestyle' && (
        <div className="flex flex-wrap gap-4 pt-4 border-t border-gray-200">
          {Object.entries(PHASE_NAMES).map(([phase, name]) => (
            <div key={phase} className="flex items-center gap-2">
              <div
                className="w-4 h-4 rounded"
                style={{ backgroundColor: PHASE_COLORS[phase as CyclePhase] }}
              />
              <span className="text-sm text-gray-600">{name}</span>
            </div>
          ))}
        </div>
      )}

      {/* Phase Information Card */}
      <div
        className="rounded-lg p-4 border border-opacity-20"
        style={{
          backgroundColor: `${PHASE_COLORS[currentPhase]}15`,
          borderColor: PHASE_COLORS[currentPhase],
        }}
      >
        <div className="flex items-start gap-3">
          <div
            className="w-3 h-3 rounded-full mt-1.5"
            style={{ backgroundColor: PHASE_COLORS[currentPhase] }}
          />
          <div className="flex-1">
            <h4 className="font-semibold text-gray-900 mb-1">
              {PHASE_NAMES[currentPhase]} Phase
            </h4>
            <p className="text-sm text-gray-600">
              You are on day {daysIntoCycle} of your {cycleLength}-day cycle.{' '}
              {currentPhase === 'menstrual' && 'Low hormone state - high-performance window if discomfort managed. Focus on readiness and recovery.'}
              {currentPhase === 'follicular' && 'Energy levels are rising. Great time for high-intensity activities. Estrogen supports performance.'}
              {currentPhase === 'ovulation' && 'Peak hormone state. Individual responses vary. Focus on readiness metrics.'}
              {currentPhase === 'luteal' && 'Progesterone-dominant phase. Energy may fluctuate. Adjust intensity based on symptoms and readiness.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
