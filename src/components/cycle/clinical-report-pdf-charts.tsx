/**
 * Vector charts for the clinical summary PDF (@react-pdf/renderer primitives). The
 * geometry comes from lib/clinical-report-charts; these components only draw it.
 * Every series also has a text label or legend so the charts read in black and white.
 */

import {
  Circle,
  Line,
  Polygon,
  Polyline,
  Svg,
  Text,
  View,
} from '@react-pdf/renderer';
import {
  buildBbtChart,
  buildCycleLengthChart,
  toSvgPoints,
  type ChartBox,
} from '@/lib/clinical-report-charts';
import type { BbtTrends, CycleRow, ReportRange } from '@/lib/clinical-report';
import { formatDateKey } from '@/lib/clinical-report-format';
import {
  PDF_COLORS,
  PDF_CONTENT_WIDTH,
  PDF_PHASE_COLORS,
} from './clinical-report-pdf-theme';

const AXIS_FONT = { fontSize: 7, fontFamily: 'Helvetica' } as const;

const CYCLE_BOX: ChartBox = {
  width: PDF_CONTENT_WIDTH,
  height: 150,
  top: 16,
  right: 14,
  bottom: 26,
  left: 34,
};

export function CycleLengthChart({
  cycles,
  average,
}: {
  cycles: readonly CycleRow[];
  average: number | null;
}) {
  const chart = buildCycleLengthChart(cycles, average, CYCLE_BOX);
  if (!chart) return null;
  const { plot } = chart;
  return (
    <Svg width={CYCLE_BOX.width} height={CYCLE_BOX.height}>
      {chart.yTicks.map((tick) => (
        <Line
          key={`grid-${tick.value}`}
          x1={plot.left}
          x2={plot.right}
          y1={tick.y}
          y2={tick.y}
          stroke={PDF_COLORS.grid}
          strokeWidth={0.5}
        />
      ))}
      {chart.yTicks.map((tick) => (
        <Text
          key={`label-${tick.value}`}
          x={plot.left - 5}
          y={tick.y + 2.5}
          textAnchor="end"
          fill={PDF_COLORS.muted}
          style={AXIS_FONT}
        >
          {String(tick.value)}
        </Text>
      ))}
      <Text x={2} y={9} fill={PDF_COLORS.muted} style={AXIS_FONT}>
        Days
      </Text>
      {chart.averageY !== null && average !== null && (
        <>
          <Line
            x1={plot.left}
            x2={plot.right}
            y1={chart.averageY}
            y2={chart.averageY}
            stroke={PDF_COLORS.brand}
            strokeWidth={0.8}
            strokeDasharray="4,3"
          />
          {/* Legend in the top margin, so it never covers a point label. */}
          <Line
            x1={plot.right - 92}
            x2={plot.right - 78}
            y1={6}
            y2={6}
            stroke={PDF_COLORS.brand}
            strokeWidth={0.8}
            strokeDasharray="4,3"
          />
          <Text
            x={plot.right}
            y={8.5}
            textAnchor="end"
            fill={PDF_COLORS.brand}
            style={AXIS_FONT}
          >
            {`Average ${average.toFixed(1)} days`}
          </Text>
        </>
      )}
      {chart.points.length > 1 && (
        <Polyline
          points={toSvgPoints(chart.points)}
          fill="none"
          stroke={PDF_COLORS.ink}
          strokeWidth={1.2}
        />
      )}
      {chart.points.map((point) => (
        <Circle
          key={`point-${point.start}`}
          cx={point.x}
          cy={point.y}
          r={2.8}
          fill={PDF_COLORS.brand}
          stroke={PDF_COLORS.white}
          strokeWidth={0.6}
        />
      ))}
      {chart.points.map((point) => (
        <Text
          key={`value-${point.start}`}
          x={point.x}
          y={point.y - 5}
          textAnchor="middle"
          fill={PDF_COLORS.ink}
          style={AXIS_FONT}
        >
          {String(point.length)}
        </Text>
      ))}
      {chart.points.map((point) => (
        <Text
          key={`x-${point.start}`}
          x={point.x}
          y={plot.bottom + 12}
          textAnchor="middle"
          fill={PDF_COLORS.muted}
          style={AXIS_FONT}
        >
          {formatDateKey(point.start, 'd MMM')}
        </Text>
      ))}
    </Svg>
  );
}

const BBT_BOX: ChartBox = {
  width: PDF_CONTENT_WIDTH,
  height: 180,
  top: 14,
  right: 12,
  bottom: 22,
  left: 40,
};

/** Show reading dots only when they do not crowd the line. */
const MAX_BBT_DOTS = 120;

function Diamond({ x, y, size = 4 }: { x: number; y: number; size?: number }) {
  return (
    <Polygon
      points={`${x},${y - size} ${x + size},${y} ${x},${y + size} ${x - size},${y}`}
      fill={PDF_PHASE_COLORS.ovulation}
      stroke={PDF_COLORS.white}
      strokeWidth={0.6}
    />
  );
}

export function BbtChart({
  bbt,
  periodStarts,
  range,
}: {
  bbt: BbtTrends;
  periodStarts: readonly string[];
  range: ReportRange;
}) {
  const chart = buildBbtChart(bbt, periodStarts, range, BBT_BOX);
  if (!chart) return null;
  const { plot } = chart;
  // Every reading gets a dot when there is room; otherwise only readings that have no
  // line (an isolated day), so none disappears.
  const dots =
    chart.points.length <= MAX_BBT_DOTS
      ? chart.points
      : chart.segments.flatMap((segment) => (segment.length === 1 ? segment : []));
  return (
    <Svg width={BBT_BOX.width} height={BBT_BOX.height}>
      {chart.yTicks.map((tick) => (
        <Line
          key={`grid-${tick.value}`}
          x1={plot.left}
          x2={plot.right}
          y1={tick.y}
          y2={tick.y}
          stroke={PDF_COLORS.grid}
          strokeWidth={0.5}
        />
      ))}
      {chart.yTicks.map((tick) => (
        <Text
          key={`label-${tick.value}`}
          x={plot.left - 5}
          y={tick.y + 2.5}
          textAnchor="end"
          fill={PDF_COLORS.muted}
          style={AXIS_FONT}
        >
          {tick.value.toFixed(1)}
        </Text>
      ))}
      <Text x={2} y={8} fill={PDF_COLORS.muted} style={AXIS_FONT}>
        {`°${chart.unit}`}
      </Text>
      {chart.xTicks.map((tick) => (
        <Line
          key={`month-${tick.date}`}
          x1={tick.x}
          x2={tick.x}
          y1={plot.bottom}
          y2={plot.bottom + 3}
          stroke={PDF_COLORS.faint}
          strokeWidth={0.5}
        />
      ))}
      {chart.xTicks.map((tick, index) => (
        <Text
          key={`month-label-${tick.date}`}
          x={tick.x + 2}
          y={plot.bottom + 12}
          fill={PDF_COLORS.muted}
          style={AXIS_FONT}
        >
          {/* The year only where it starts or changes, so 12 months fit. */}
          {formatDateKey(
            tick.date,
            index === 0 || tick.date.endsWith('-01-01') ? 'MMM yyyy' : 'MMM'
          )}
        </Text>
      ))}
      <Line
        x1={plot.left}
        x2={plot.right}
        y1={plot.bottom}
        y2={plot.bottom}
        stroke={PDF_COLORS.rule}
        strokeWidth={0.6}
      />
      {chart.periodStarts.map((start) => (
        <Line
          key={`period-${start.date}`}
          x1={start.x}
          x2={start.x}
          y1={plot.top}
          y2={plot.bottom}
          stroke={PDF_PHASE_COLORS.menstrual}
          strokeWidth={0.7}
          strokeDasharray="2,2"
        />
      ))}
      {chart.coverlines.map((line) => (
        <Line
          key={`cover-${line.x1}`}
          x1={line.x1}
          x2={line.x2}
          y1={line.y}
          y2={line.y}
          stroke={PDF_COLORS.muted}
          strokeWidth={0.8}
          strokeDasharray="4,2"
        />
      ))}
      {chart.segments.map((segment, index) =>
        segment.length > 1 ? (
          <Polyline
            key={`segment-${index}`}
            points={toSvgPoints(segment)}
            fill="none"
            stroke={PDF_COLORS.ink}
            strokeWidth={0.9}
          />
        ) : null
      )}
      {dots.map((point) => (
        <Circle
          key={`dot-${point.x}`}
          cx={point.x}
          cy={point.y}
          r={1.4}
          fill={PDF_COLORS.ink}
        />
      ))}
      {chart.ovulations.map((point) => (
        <Diamond key={`ovulation-${point.date}`} x={point.x} y={point.y} />
      ))}
    </Svg>
  );
}

/** Legend for the BBT chart, drawn with the same marks as the chart. */
export function BbtLegend({ unit }: { unit: string }) {
  const item = {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginRight: 14,
  };
  const label = { fontSize: 7.5, color: PDF_COLORS.muted, marginLeft: 4 };
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 }}>
      <View style={item}>
        <Svg width={16} height={8}>
          <Line x1={0} x2={16} y1={4} y2={4} stroke={PDF_COLORS.ink} strokeWidth={1} />
        </Svg>
        <Text style={label}>{`Waking temperature (°${unit})`}</Text>
      </View>
      <View style={item}>
        <Svg width={10} height={10}>
          <Diamond x={5} y={5} size={4} />
        </Svg>
        <Text style={label}>BBT-confirmed ovulation (estimated day)</Text>
      </View>
      <View style={item}>
        <Svg width={16} height={8}>
          <Line
            x1={0}
            x2={16}
            y1={4}
            y2={4}
            stroke={PDF_COLORS.muted}
            strokeWidth={0.8}
            strokeDasharray="4,2"
          />
        </Svg>
        <Text style={label}>Coverline</Text>
      </View>
      <View style={item}>
        <Svg width={8} height={10}>
          <Line
            x1={4}
            x2={4}
            y1={0}
            y2={10}
            stroke={PDF_PHASE_COLORS.menstrual}
            strokeWidth={0.8}
            strokeDasharray="2,2"
          />
        </Svg>
        <Text style={label}>Period start</Text>
      </View>
    </View>
  );
}

/** Horizontal bar with a text value, for percentages and frequencies. */
export function BarRow({
  label,
  fraction,
  value,
  color,
  labelWidth = 80,
}: {
  label: string;
  /** 0-1 */
  fraction: number;
  value: string;
  color: string;
  labelWidth?: number;
}) {
  const width = `${Math.max(0, Math.min(1, fraction)) * 100}%`;
  return (
    <View
      wrap={false}
      style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}
    >
      <Text style={{ width: labelWidth, fontSize: 8.5, color: PDF_COLORS.ink }}>
        {label}
      </Text>
      <View
        style={{
          flexGrow: 1,
          height: 9,
          backgroundColor: PDF_COLORS.soft,
          borderRadius: 1,
        }}
      >
        <View style={{ width, height: 9, backgroundColor: color, borderRadius: 1 }} />
      </View>
      <Text
        style={{
          width: 92,
          fontSize: 8.5,
          color: PDF_COLORS.ink,
          textAlign: 'right',
        }}
      >
        {value}
      </Text>
    </View>
  );
}
