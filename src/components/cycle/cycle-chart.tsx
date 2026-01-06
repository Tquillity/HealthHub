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
 */

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceArea,
  CartesianGrid,
} from 'recharts';
import { CyclePhase, CyclePhaseResult, PHASE_LENGTHS } from '@/lib/cycle-calculator';

interface CycleChartProps {
  phaseData: CyclePhaseResult;
  cycleLength: number;
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
function generateCycleData(cycleLength: number, currentDay: number) {
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
 * Shows: day number, current phase name, energy level, and "Today" indicator if applicable.
 */
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const day = payload[0].payload.day;
    const intensity = payload[0].value;
    
    // Determine phase for this day based on PHASE_LENGTHS constants
    let phase: CyclePhase = 'luteal';
    if (day <= PHASE_LENGTHS.MENSTRUAL) {
      phase = 'menstrual';
    } else if (day <= PHASE_LENGTHS.MENSTRUAL + PHASE_LENGTHS.FOLLICULAR) {
      phase = 'follicular';
    } else if (day <= PHASE_LENGTHS.MENSTRUAL + PHASE_LENGTHS.FOLLICULAR + PHASE_LENGTHS.OVULATION) {
      phase = 'ovulation';
    }

    return (
      <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-lg">
        <p className="font-semibold text-gray-900">Day {day}</p>
        <p className="text-sm text-gray-600">
          <span className="font-medium">{PHASE_NAMES[phase]}</span> Phase
        </p>
        <p className="text-sm text-gray-600">
          Energy Level: <span className="font-medium">{intensity}/10</span>
        </p>
        {payload[0].payload.isCurrentDay && (
          <p className="text-xs text-primary-600 font-medium mt-1">Today</p>
        )}
      </div>
    );
  }
  return null;
};

export function CycleChart({ phaseData, cycleLength }: CycleChartProps) {
  const { currentPhase, daysIntoCycle } = phaseData;
  const chartData = generateCycleData(cycleLength, daysIntoCycle);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Cycle Overview</h3>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <span className="font-medium">Day {daysIntoCycle} of {cycleLength}</span>
          <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
            {PHASE_NAMES[currentPhase]} Phase
          </span>
        </div>
      </div>

      {/* Recharts Visualization */}
      <div className="w-full" style={{ width: '100%', height: '256px', minHeight: '256px' }}>
        <ResponsiveContainer width="100%" height={256}>
          <LineChart
            data={chartData}
            margin={{ top: 10, right: 10, left: 0, bottom: 10 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            
            {/* Phase Background Areas - Render in order to ensure all phases are visible */}
            <ReferenceArea
              x1={0.5}
              x2={PHASE_LENGTHS.MENSTRUAL + 0.5}
              fill={PHASE_COLORS.menstrual}
              fillOpacity={0.15}
              stroke={PHASE_COLORS.menstrual}
              strokeOpacity={0.3}
            />
            <ReferenceArea
              x1={PHASE_LENGTHS.MENSTRUAL + 0.5}
              x2={PHASE_LENGTHS.MENSTRUAL + PHASE_LENGTHS.FOLLICULAR + 0.5}
              fill={PHASE_COLORS.follicular}
              fillOpacity={0.15}
              stroke={PHASE_COLORS.follicular}
              strokeOpacity={0.3}
            />
            <ReferenceArea
              x1={PHASE_LENGTHS.MENSTRUAL + PHASE_LENGTHS.FOLLICULAR + 0.5}
              x2={PHASE_LENGTHS.MENSTRUAL + PHASE_LENGTHS.FOLLICULAR + PHASE_LENGTHS.OVULATION + 0.5}
              fill={PHASE_COLORS.ovulation}
              fillOpacity={0.15}
              stroke={PHASE_COLORS.ovulation}
              strokeOpacity={0.3}
            />
            <ReferenceArea
              x1={PHASE_LENGTHS.MENSTRUAL + PHASE_LENGTHS.FOLLICULAR + PHASE_LENGTHS.OVULATION + 0.5}
              x2={cycleLength + 0.5}
              fill={PHASE_COLORS.luteal}
              fillOpacity={0.15}
              stroke={PHASE_COLORS.luteal}
              strokeOpacity={0.3}
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
            <YAxis
              domain={[0, 10]}
              tick={{ fontSize: 12, fill: '#6b7280' }}
              label={{ value: 'Energy Level', angle: -90, position: 'insideLeft', style: { fill: '#6b7280' } }}
            />
            <Tooltip content={<CustomTooltip />} />
            
            {/* Intensity Line */}
            <Line
              type="monotone"
              dataKey="intensity"
              stroke="#6366f1"
              strokeWidth={2}
              dot={{ r: 4, fill: '#6366f1' }}
              activeDot={{ r: 6, fill: '#4f46e5' }}
            />
            
            {/* Current Day Marker */}
            <ReferenceArea
              x1={daysIntoCycle}
              x2={daysIntoCycle}
              stroke="#1f2937"
              strokeWidth={2}
              strokeDasharray="4 4"
              fillOpacity={0}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Phase Legend */}
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
              {currentPhase === 'menstrual' && 'Focus on rest and recovery.'}
              {currentPhase === 'follicular' && 'Energy levels are rising. Great time for high-intensity activities.'}
              {currentPhase === 'ovulation' && 'Peak fertility and energy. Ideal for challenging workouts.'}
              {currentPhase === 'luteal' && 'Energy may fluctuate. Listen to your body and adjust intensity.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
