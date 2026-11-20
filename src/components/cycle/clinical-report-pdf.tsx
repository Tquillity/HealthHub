/**
 * The clinical summary as an A4 PDF document (@react-pdf/renderer), drawn by
 * clinical-report-pdf-render. Uses the built-in Helvetica fonts (no font download);
 * user text goes through `toPdfText` because those fonts only cover the WinAnsi
 * character set.
 *
 * Layout notes (react-pdf 4): every Text sets its own line height (an inherited one is
 * resolved against the page font size and can push text out of small boxes), headings
 * are kept with their first block in an unbreakable View (`minPresenceAhead` does not
 * look past an unbreakable sibling), and the fixed footer is placed from the top.
 */

import type { ReactNode } from 'react';
import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
} from '@react-pdf/renderer';
import { format } from 'date-fns';
import {
  MIN_CYCLES_FOR_REGULARITY,
  MIN_CYCLES_FOR_TREND,
  MIN_CYCLES_FOR_VARIABILITY,
  PHASE_LABELS,
  REGULARITY_DIFFERENCE_BANDS,
  REGULARITY_LABELS,
  REPORT_PHASES,
  type BbtCycleSummary,
  type ClinicalReport,
  type PhaseCounts,
  type SymptomStat,
  type VitalsAverages,
} from '@/lib/clinical-report';
import type { CyclePhase } from '@/lib/cycle-calculator';
import {
  EMPTY_VALUE,
  formatDateKey,
  formatDateRange,
  formatReportTemperature,
  formatTemperatureDelta,
  formatValue,
  pluralize,
} from '@/lib/clinical-report-format';
import { toPdfText, UNPRINTABLE_TEXT } from '@/lib/pdf-text';
import {
  BarRow,
  BbtChart,
  BbtLegend,
  CycleLengthChart,
} from './clinical-report-pdf-charts';
import {
  PDF_COLORS,
  PDF_PHASE_COLORS,
  REPORT_DISCLAIMER,
} from './clinical-report-pdf-theme';

/** A4 height in points. */
const PAGE_HEIGHT = 841.89;
const FOOTER_TOP = PAGE_HEIGHT - 44;

const styles = StyleSheet.create({
  page: {
    paddingTop: 34,
    paddingBottom: 60,
    paddingHorizontal: 40,
    fontFamily: 'Helvetica',
    fontSize: 9.5,
    lineHeight: 1.4,
    color: PDF_COLORS.ink,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 0.75,
    borderBottomColor: PDF_COLORS.rule,
    paddingBottom: 6,
    marginBottom: 14,
  },
  brand: { flexDirection: 'row', alignItems: 'center' },
  brandMark: {
    width: 14,
    height: 14,
    borderRadius: 3,
    backgroundColor: PDF_COLORS.brand,
    justifyContent: 'center',
    marginRight: 5,
  },
  brandMarkText: {
    color: PDF_COLORS.white,
    fontFamily: 'Helvetica-Bold',
    fontSize: 6.5,
    lineHeight: 1,
    textAlign: 'center',
  },
  brandName: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 9,
    lineHeight: 1.2,
    color: PDF_COLORS.brand,
  },
  headerMeta: { fontSize: 8, lineHeight: 1.2, color: PDF_COLORS.muted },
  footer: {
    position: 'absolute',
    top: FOOTER_TOP,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 0.75,
    borderTopColor: PDF_COLORS.rule,
    paddingTop: 5,
  },
  footerText: { fontSize: 7.5, lineHeight: 1.2, color: PDF_COLORS.muted },
  title: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 19,
    lineHeight: 1.25,
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 10,
    lineHeight: 1.3,
    color: PDF_COLORS.muted,
    marginBottom: 10,
  },
  metaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: PDF_COLORS.soft,
    borderRadius: 3,
    padding: 8,
    marginBottom: 12,
  },
  metaItem: { width: '50%', paddingVertical: 2, paddingRight: 8 },
  metaLabel: {
    fontSize: 7.5,
    lineHeight: 1.3,
    color: PDF_COLORS.muted,
    textTransform: 'uppercase',
  },
  metaValue: { fontSize: 9.5, lineHeight: 1.35 },
  tiles: { flexDirection: 'row', marginBottom: 14 },
  tile: {
    flexGrow: 1,
    flexBasis: 0,
    borderWidth: 0.75,
    borderColor: PDF_COLORS.rule,
    borderRadius: 3,
    paddingVertical: 6,
    paddingHorizontal: 7,
    marginRight: 6,
  },
  tileLast: { marginRight: 0 },
  tileLabel: {
    fontSize: 7,
    lineHeight: 1.3,
    color: PDF_COLORS.muted,
    textTransform: 'uppercase',
  },
  tileValue: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 12.5,
    lineHeight: 1.25,
    marginTop: 2,
  },
  tileHint: { fontSize: 7, lineHeight: 1.3, color: PDF_COLORS.muted },
  section: { marginBottom: 16 },
  sectionTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 12.5,
    lineHeight: 1.25,
    color: PDF_COLORS.brand,
    borderBottomWidth: 1,
    borderBottomColor: PDF_COLORS.brand,
    paddingBottom: 3,
    marginBottom: 7,
  },
  subheading: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 10,
    lineHeight: 1.3,
    marginTop: 8,
    marginBottom: 4,
  },
  paragraph: { fontSize: 9.5, lineHeight: 1.4, marginBottom: 5 },
  note: {
    fontSize: 8,
    lineHeight: 1.4,
    color: PDF_COLORS.muted,
    marginBottom: 4,
  },
  empty: {
    fontSize: 9,
    lineHeight: 1.4,
    color: PDF_COLORS.muted,
    backgroundColor: PDF_COLORS.soft,
    padding: 6,
    borderRadius: 3,
    marginBottom: 5,
  },
  table: {
    borderTopWidth: 0.75,
    borderTopColor: PDF_COLORS.ink,
    marginBottom: 6,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.75,
    borderBottomColor: PDF_COLORS.ink,
    paddingVertical: 3,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: PDF_COLORS.rule,
    paddingVertical: 2.5,
  },
  th: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
    lineHeight: 1.3,
    paddingHorizontal: 3,
  },
  td: { fontSize: 8.5, lineHeight: 1.35, paddingHorizontal: 3 },
  bold: { fontFamily: 'Helvetica-Bold' },
  noteEntry: {
    borderLeftWidth: 2,
    borderLeftColor: PDF_COLORS.rule,
    paddingLeft: 6,
    marginBottom: 6,
  },
  noteText: { fontSize: 9, lineHeight: 1.4 },
  disclaimer: {
    borderWidth: 0.75,
    borderColor: PDF_COLORS.rule,
    backgroundColor: PDF_COLORS.soft,
    borderRadius: 3,
    padding: 9,
    marginTop: 4,
  },
});

type Column = { label: string; width: string; align?: 'left' | 'right' };

/** A simple table; rows never split across pages, the header repeats when it wraps. */
function Table({
  columns,
  rows,
}: {
  columns: readonly Column[];
  rows: readonly (readonly string[])[];
}) {
  const cellStyle = (index: number) => ({
    width: columns[index]?.width,
    textAlign: columns[index]?.align ?? ('left' as const),
  });
  return (
    <View style={styles.table}>
      <View style={styles.tableHeaderRow} fixed>
        {columns.map((column, index) => (
          <Text key={column.label} style={[styles.th, cellStyle(index)]}>
            {column.label}
          </Text>
        ))}
      </View>
      {rows.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.tableRow} wrap={false}>
          {row.map((cell, cellIndex) => (
            <Text key={cellIndex} style={[styles.td, cellStyle(cellIndex)]}>
              {cell}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

/**
 * A section: the title and its `lead` block never split from each other (no heading
 * alone at the bottom of a page); `children` flow normally.
 */
function Section({
  title,
  lead,
  children,
}: {
  title: string;
  lead: ReactNode;
  children?: ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View wrap={false}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {lead}
      </View>
      {children}
    </View>
  );
}

/** A subheading kept on the same page as the (short) block below it. */
function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View wrap={false}>
      <Text style={styles.subheading}>{title}</Text>
      {children}
    </View>
  );
}

function Note({ children }: { children: ReactNode }) {
  return <Text style={styles.note}>{children}</Text>;
}

function Paragraph({ children }: { children: ReactNode }) {
  return <Text style={styles.paragraph}>{children}</Text>;
}

function Empty({ children }: { children: ReactNode }) {
  return <Text style={styles.empty}>{children}</Text>;
}

function Tile({
  label,
  value,
  hint,
  last = false,
}: {
  label: string;
  value: string;
  hint?: string;
  last?: boolean;
}) {
  return (
    <View style={last ? [styles.tile, styles.tileLast] : styles.tile}>
      <Text style={styles.tileLabel}>{label}</Text>
      <Text style={styles.tileValue}>{value}</Text>
      {hint ? <Text style={styles.tileHint}>{hint}</Text> : null}
    </View>
  );
}

function percentOf(count: number, total: number): string {
  return total > 0 ? `${Math.round((count / total) * 100)}%` : EMPTY_VALUE;
}

function Header({ report }: { report: ClinicalReport }) {
  return (
    <View style={styles.header} fixed>
      <View style={styles.brand}>
        <View style={styles.brandMark}>
          <Text style={styles.brandMarkText}>HH</Text>
        </View>
        <Text style={styles.brandName}>HealthHub</Text>
      </View>
      <Text style={styles.headerMeta}>
        {`Clinical cycle summary · ${formatDateRange(
          report.meta.rangeStart,
          report.meta.rangeEnd
        )}`}
      </Text>
    </View>
  );
}

function Footer() {
  return (
    <View style={styles.footer} fixed>
      <Text style={styles.footerText}>{REPORT_DISCLAIMER}</Text>
      <Text
        style={styles.footerText}
        render={({ pageNumber, totalPages }) =>
          `Page ${pageNumber} of ${totalPages}`
        }
      />
    </View>
  );
}

const OPTIONAL_SECTIONS = {
  bbt: 'temperature (BBT)',
  symptoms: 'symptoms, mood and energy',
  vitals: 'vitals and recovery',
  notes: 'journal notes and tags',
  symptomNotes: 'symptom notes',
} as const;

function TitleBlock({ report }: { report: ClinicalReport }) {
  const { meta } = report;
  const keys = Object.keys(OPTIONAL_SECTIONS) as (keyof typeof OPTIONAL_SECTIONS)[];
  const included = [
    'cycle lengths',
    'phases',
    ...keys.filter((key) => meta.sections[key]).map((key) => OPTIONAL_SECTIONS[key]),
  ];
  const excluded = keys
    .filter((key) => !meta.sections[key])
    .map((key) => OPTIONAL_SECTIONS[key]);
  const items: [string, string][] = [
    [
      'Report period',
      `Last ${meta.months} months: ${formatDateRange(meta.rangeStart, meta.rangeEnd)}`,
    ],
    ['Generated', format(new Date(meta.generatedAt), 'd MMM yyyy, HH:mm')],
    ['Included', included.join(', ')],
    ['Left out by the user', excluded.length > 0 ? excluded.join(', ') : 'nothing'],
    ['Typical cycle length (user setting)', `${meta.typicalCycleLength} days`],
    ['Data source', 'Self-reported period dates and daily logs'],
  ];
  return (
    <View>
      <Text style={styles.title}>Clinical cycle summary</Text>
      <Text style={styles.subtitle}>
        {meta.name
          ? `Prepared for ${toPdfText(meta.name)}`
          : 'Self-tracked menstrual cycle data from HealthHub'}
      </Text>
      <View style={styles.metaGrid}>
        {items.map(([label, value]) => (
          <View key={label} style={styles.metaItem}>
            <Text style={styles.metaLabel}>{label}</Text>
            <Text style={styles.metaValue}>{value}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function KeyFigures({ report }: { report: ClinicalReport }) {
  const { cycles, phases } = report;
  const regularity = phases.regularity;
  return (
    <View style={styles.tiles} wrap={false}>
      <Tile
        label="Completed cycles"
        value={String(cycles.count)}
        hint="began in this period"
      />
      <Tile label="Average length" value={formatValue(cycles.averageLength, 1, 'd')} />
      <Tile
        label="Shortest–longest"
        value={
          cycles.minLength !== null && cycles.maxLength !== null
            ? `${cycles.minLength}–${cycles.maxLength} d`
            : EMPTY_VALUE
        }
      />
      <Tile label="Std. deviation" value={formatValue(cycles.sdLength, 1, 'd')} />
      <Tile
        label="Regularity"
        value={regularity?.level ? REGULARITY_LABELS[regularity.level] : EMPTY_VALUE}
        hint={
          regularity?.level
            ? 'FIGO difference, see below'
            : regularity
              ? `needs ${MIN_CYCLES_FOR_REGULARITY} cycles`
              : undefined
        }
        last
      />
    </View>
  );
}

function CycleSection({ report }: { report: ClinicalReport }) {
  const { cycles } = report;
  const intro = (
    <Note>
      Completed cycles that began in this period, from the period start dates the user
      logged. A cycle runs from one period start to the day before the next.
    </Note>
  );
  return (
    <Section
      title="Cycle length variability"
      lead={
        cycles.count === 0 ? (
          <>
            {intro}
            <Empty>
              No completed cycles in this period yet. A cycle is complete once the next
              period start is logged.
            </Empty>
          </>
        ) : (
          <>
            {intro}
            {!cycles.enoughForVariability && (
              <Empty>
                {`Only 1 completed cycle in this period. Average, range and standard deviation need at least ${MIN_CYCLES_FOR_VARIABILITY} completed cycles.`}
              </Empty>
            )}
            <CycleLengthChart cycles={cycles.completed} average={cycles.averageLength} />
          </>
        )
      }
    >
      {cycles.count > 0 && (
        <Table
          columns={[
            { label: '#', width: '8%' },
            { label: 'Period start', width: '32%' },
            { label: 'Cycle end', width: '32%' },
            { label: 'Length (days)', width: '28%', align: 'right' },
          ]}
          rows={cycles.completed.map((cycle, index) => [
            String(index + 1),
            formatDateKey(cycle.start),
            formatDateKey(cycle.end),
            String(cycle.length),
          ])}
        />
      )}
      {cycles.current && (
        <Paragraph>
          {`Current cycle: started ${formatDateKey(cycles.current.start)}, day ${cycles.current.day} on ${formatDateKey(report.meta.rangeEnd)} (in progress, not included above).`}
        </Paragraph>
      )}
      {cycles.enoughForVariability && (
        <Paragraph>
          {`Average ${formatValue(cycles.averageLength)} days · shortest ${cycles.minLength} · longest ${cycles.maxLength} · difference ${cycles.variationDays} days · standard deviation ${formatValue(cycles.sdLength)} days.`}
        </Paragraph>
      )}
      <Paragraph>
        {cycles.trend
          ? `Trend: ${cycles.trend.direction} (${cycles.trend.slopePerCycle >= 0 ? '+' : ''}${cycles.trend.slopePerCycle.toFixed(1)} days per cycle, least-squares fit).`
          : `Trend: shown from ${MIN_CYCLES_FOR_TREND} completed cycles.`}
      </Paragraph>
    </Section>
  );
}

function PhaseSection({ report }: { report: ClinicalReport }) {
  const { phases } = report;
  const regularity = phases.regularity;
  const typical = report.meta.typicalCycleLength;
  return (
    <Section
      title="Phase distribution"
      lead={
        phases.trackedDays === 0 ? (
          <Empty>
            {phases.beyondTypicalDays > 0
              ? `The current cycle was already longer than the typical ${typical} days for the whole period, so phases cannot be estimated.`
              : 'No period start is logged on or before the end of this period, so phases cannot be estimated.'}
          </Empty>
        ) : (
          <View style={{ marginBottom: 6 }}>
            <Note>
              {`Share of the ${pluralize(phases.trackedDays, 'day')} in this period by estimated phase.`}
            </Note>
            {phases.phases.map((share) => (
              <BarRow
                key={share.phase}
                label={PHASE_LABELS[share.phase]}
                fraction={share.percent / 100}
                value={`${share.percent.toFixed(1)}% · ${pluralize(share.days, 'day')}`}
                color={PDF_PHASE_COLORS[share.phase]}
              />
            ))}
          </View>
        )
      }
    >
      {phases.trackedDays > 0 && (
        <Table
          columns={[
            { label: 'Phase', width: '28%' },
            { label: 'Days in period', width: '22%', align: 'right' },
            { label: 'Share', width: '18%', align: 'right' },
            { label: 'Avg length in completed cycles', width: '32%', align: 'right' },
          ]}
          rows={phases.phases.map((share) => [
            PHASE_LABELS[share.phase],
            String(share.days),
            `${share.percent.toFixed(1)}%`,
            formatValue(share.averageLength, 1, 'days'),
          ])}
        />
      )}
      {phases.untrackedDays > 0 && (
        <Note>
          {`${pluralize(phases.untrackedDays, 'day')} before the first logged period start have no phase and are not counted.`}
        </Note>
      )}
      {phases.beyondTypicalDays > 0 && (
        <Note>
          {`${pluralize(phases.beyondTypicalDays, 'day')} of the current cycle after the typical ${typical}-day length have no estimated phase and are not counted here or in any by-phase figure: the next period is late or not logged yet, so ovulation and the luteal phase cannot be placed.`}
        </Note>
      )}
      <Block title="Regularity indicator">
        <Paragraph>
          {!regularity
            ? `Needs at least ${MIN_CYCLES_FOR_VARIABILITY} completed cycles in this period.`
            : regularity.level
              ? `${REGULARITY_LABELS[regularity.level]}: shortest-to-longest difference ${pluralize(regularity.differenceDays, 'day')} over ${pluralize(regularity.cycles, 'completed cycle')} (standard deviation ${regularity.sd.toFixed(1)} days).`
              : `No label yet: shortest-to-longest difference ${pluralize(regularity.differenceDays, 'day')} over only ${pluralize(regularity.cycles, 'completed cycle')}. More cycles can only widen it, so a difference within the FIGO limit is labelled from ${MIN_CYCLES_FOR_REGULARITY} cycles.`}
        </Paragraph>
        <Note>
          {`Bands on the shortest-to-longest difference, FIGO 2018's measure of regularity (regular up to 7-9 days, depending on age): up to ${REGULARITY_DIFFERENCE_BANDS.consistent} days "consistent", ${REGULARITY_DIFFERENCE_BANDS.consistent + 1}-${REGULARITY_DIFFERENCE_BANDS.somewhatVariable} days "somewhat variable" (regular or not depending on age), ${REGULARITY_DIFFERENCE_BANDS.somewhatVariable + 1} days or more "variable". A difference within ${REGULARITY_DIFFERENCE_BANDS.somewhatVariable} days is labelled from ${MIN_CYCLES_FOR_REGULARITY} completed cycles. The standard deviation is shown for information only. Descriptive, not a diagnosis.`}
        </Note>
      </Block>
      <Note>
        Phases are estimated from logged period dates with a 4-phase wellness model
        (menstrual days 1-5, ovulation window ending about 14 days before the next period,
        luteal about 14 days); the current cycle uses the typical length, and days after
        it get no phase. Phases are not hormone measurements; where temperature data
        confirms ovulation, the measured luteal length is in the temperature section.
      </Note>
    </Section>
  );
}

function shiftResult(cycle: BbtCycleSummary): string {
  if (cycle.status === 'confirmed') return 'Rise confirmed';
  if (cycle.status === 'not-enough-readings') return 'Too few readings';
  return cycle.isOpen ? 'No rise yet' : 'No rise found';
}

function BbtSection({ report }: { report: ClinicalReport }) {
  const bbt = report.bbt;
  if (!bbt) return null;
  const unit = bbt.unit;
  if (bbt.readings.length === 0) {
    return (
      <Section
        title="Temperature (BBT) trends"
        lead={<Empty>No waking temperatures were logged in this period.</Empty>}
      />
    );
  }
  return (
    <Section
      title="Temperature (BBT) trends"
      lead={
        <>
          <Note>
            {`Waking temperature logged on ${bbt.daysWithReading} of ${report.meta.rangeDays} days (${percentOf(bbt.daysWithReading, report.meta.rangeDays)}). Shown in °${unit}.`}
          </Note>
          <BbtChart
            bbt={bbt}
            periodStarts={report.cycles.periodStartsInRange}
            range={{
              start: report.meta.rangeStart,
              end: report.meta.rangeEnd,
              days: report.meta.rangeDays,
            }}
          />
          <BbtLegend unit={unit} />
        </>
      }
    >
      <Block title="Average temperature by phase">
        <Table
          columns={[
            { label: 'Phase', width: '40%' },
            { label: 'Average', width: '35%', align: 'right' },
            { label: 'Readings', width: '25%', align: 'right' },
          ]}
          rows={bbt.phaseAverages.map((average) => [
            PHASE_LABELS[average.phase],
            formatReportTemperature(average.averageCelsius, unit),
            String(average.readings),
          ])}
        />
      </Block>
      <Block title="Thermal shifts by cycle">
        <Table
          columns={[
            { label: 'Cycle start', width: '15%' },
            { label: 'Readings', width: '11%', align: 'right' },
            { label: 'Result', width: '17%' },
            { label: 'Est. ovulation', width: '15%' },
            { label: 'Coverline', width: '14%', align: 'right' },
            { label: 'Rise', width: '13%', align: 'right' },
            { label: 'Luteal days', width: '15%', align: 'right' },
          ]}
          rows={bbt.cycles.map((cycle) => [
            formatDateKey(cycle.start, 'd MMM yy'),
            String(cycle.readings),
            shiftResult(cycle),
            cycle.ovulationDate
              ? formatDateKey(cycle.ovulationDate, 'd MMM yy')
              : EMPTY_VALUE,
            formatReportTemperature(cycle.coverlineCelsius, unit),
            formatTemperatureDelta(cycle.riseCelsius, unit),
            cycle.lutealLength !== null
              ? String(cycle.lutealLength)
              : cycle.status === 'confirmed'
                ? 'in progress'
                : EMPTY_VALUE,
          ])}
        />
      </Block>
      <Note>
        BBT-confirmed ovulation uses the 3-over-6 rule: three readings at least 0.1 °C
        (about 0.2 °F) above the highest of the previous six. It confirms after the fact
        that ovulation most likely happened; the estimated day (last low reading) can be
        1-2 days off. Rise = average after the shift minus average before it, within the
        cycle. Luteal days = days after the estimated ovulation up to the next period.
        Fever, alcohol, short sleep or a different measuring time can affect readings.
      </Note>
    </Section>
  );
}

function phaseCell(stat: SymptomStat, phase: CyclePhase, totals: PhaseCounts): string {
  const count = stat.byPhase[phase];
  return count === 0 ? '0' : `${count} (${percentOf(count, totals[phase])})`;
}

function SymptomTable({
  stats,
  totals,
}: {
  stats: readonly SymptomStat[];
  totals: PhaseCounts;
}) {
  return (
    <Table
      columns={[
        { label: 'Symptom', width: '28%' },
        { label: 'Days', width: '8%', align: 'right' },
        ...REPORT_PHASES.map((phase) => ({
          label: PHASE_LABELS[phase],
          width: '16%',
          align: 'right' as const,
        })),
      ]}
      rows={stats.map((stat) => [
        toPdfText(stat.label),
        String(stat.days),
        ...REPORT_PHASES.map((phase) => phaseCell(stat, phase, totals)),
      ])}
    />
  );
}

function SymptomSection({ report }: { report: ClinicalReport }) {
  const symptoms = report.symptoms;
  if (!symptoms) return null;
  const totals = symptoms.checkInDaysByPhase;
  const top = [...symptoms.physical, ...symptoms.mental]
    .sort((a, b) => b.days - a.days || a.label.localeCompare(b.label))
    .slice(0, 8);
  const maxDays = top[0]?.days ?? 0;
  return (
    <Section
      title="Symptom patterns"
      lead={
        <>
          <Note>
            HealthHub does not record symptom severity, so this section shows how often
            each symptom was logged: the number of days, and in brackets the share of
            journal check-in days in that phase.
          </Note>
          <Paragraph>
            {`Journal check-ins: ${pluralize(symptoms.checkInDays, 'day')} (${REPORT_PHASES.map(
              (phase) => `${PHASE_LABELS[phase].toLowerCase()} ${totals[phase]}`
            ).join(', ')}${
              symptoms.checkInDaysWithoutPhase > 0
                ? `, no phase ${symptoms.checkInDaysWithoutPhase}`
                : ''
            }); symptoms logged on ${pluralize(symptoms.daysWithSymptoms, 'day')}.`}
          </Paragraph>
          {top.length === 0 && <Empty>No symptoms were logged in this period.</Empty>}
        </>
      }
    >
      {top.length > 0 && (
        <>
          <Block title="Most frequent symptoms">
            {top.map((stat) => (
              <BarRow
                key={`${stat.kind}-${stat.label}`}
                label={toPdfText(stat.label)}
                fraction={maxDays > 0 ? stat.days / maxDays : 0}
                value={`${pluralize(stat.days, 'day')} (${percentOf(stat.days, symptoms.checkInDays)})`}
                color={PDF_COLORS.brand}
                labelWidth={150}
              />
            ))}
          </Block>
          {symptoms.physical.length > 0 && (
            <Block title="Physical symptoms by phase">
              <SymptomTable stats={symptoms.physical} totals={totals} />
            </Block>
          )}
          {symptoms.mental.length > 0 && (
            <Block title="Mental and emotional symptoms by phase">
              <SymptomTable stats={symptoms.mental} totals={totals} />
            </Block>
          )}
          {symptoms.omittedSymptoms > 0 && (
            <Note>
              {`${pluralize(symptoms.omittedSymptoms, 'less frequent symptom')} not shown.`}
            </Note>
          )}
          <Block title="Often logged together">
            {symptoms.pairs.length === 0 ? (
              <Note>No two symptoms were logged together on more than one day.</Note>
            ) : (
              <Table
                columns={[
                  { label: 'Symptoms', width: '75%' },
                  { label: 'Days together', width: '25%', align: 'right' },
                ]}
                rows={symptoms.pairs.map((pair) => [
                  `${toPdfText(pair.a)} + ${toPdfText(pair.b)}`,
                  String(pair.days),
                ])}
              />
            )}
          </Block>
        </>
      )}
      <Block title="Mood and energy by phase">
        <Note>
          Self-rated 1-10 on check-in days (higher is better). Context for how those
          days felt only; not a measure of symptom severity.
        </Note>
        <Table
          columns={[
            { label: 'Phase', width: '34%' },
            { label: 'Average mood', width: '22%', align: 'right' },
            { label: 'Average energy', width: '22%', align: 'right' },
            { label: 'Days rated', width: '22%', align: 'right' },
          ]}
          rows={symptoms.moodEnergyByPhase.map((row) => [
            PHASE_LABELS[row.phase],
            formatValue(row.mood),
            formatValue(row.energy),
            String(row.days),
          ])}
        />
      </Block>
    </Section>
  );
}

function vitalsCells(values: VitalsAverages): string[] {
  return [
    String(values.days),
    formatValue(values.restingHeartRate, 0),
    formatValue(values.heartRateVariability, 0),
    formatValue(values.sleepQuality),
    formatValue(values.sleepHours),
    formatValue(values.recoveryScore, 0),
  ];
}

function VitalsSection({ report }: { report: ClinicalReport }) {
  const vitals = report.vitals;
  if (!vitals) return null;
  if (vitals.overall.days === 0) {
    return (
      <Section
        title="Vitals and recovery"
        lead={<Empty>No vitals or sleep were logged in this period.</Empty>}
      />
    );
  }
  return (
    <Section
      title="Vitals and recovery"
      lead={
        <>
          <Note>Averages of the morning readings on the days they were logged.</Note>
          <Table
            columns={[
              { label: 'Phase', width: '19%' },
              { label: 'Days', width: '9%', align: 'right' },
              { label: 'Resting HR (bpm)', width: '15%', align: 'right' },
              { label: 'HRV RMSSD (ms)', width: '15%', align: 'right' },
              { label: 'Sleep quality (1-10)', width: '15%', align: 'right' },
              { label: 'Sleep (hours)', width: '12%', align: 'right' },
              { label: 'Recovery (0-100)', width: '15%', align: 'right' },
            ]}
            rows={[
              ...vitals.byPhase.map((row) => [PHASE_LABELS[row.phase], ...vitalsCells(row)]),
              ['All days', ...vitalsCells(vitals.overall)],
            ]}
          />
        </>
      }
    >
      <Note>
        {`Recovery is HealthHub's 0-100 wellness indicator from HRV, resting heart rate and sleep, compared with the user's own usual values for the same phase over the previous 90 days. It is not a medical measure. Days with a bigger-than-usual dip: ${vitals.dipDays} of ${vitals.scoredDays} scored days.`}
      </Note>
    </Section>
  );
}

function NotesSection({ report }: { report: ClinicalReport }) {
  const notes = report.notes;
  if (!notes) return null;
  return (
    <Section
      title="Notes and events"
      lead={
        <>
          <Note>
            {`Included at the user's request: their own journal notes${
              report.meta.sections.symptomNotes ? ', symptom notes' : ''
            } and tags, unedited apart from shortening long notes. Emoji are left out, and words in a script this PDF cannot show are marked ${UNPRINTABLE_TEXT}.`}
          </Note>
          {notes.tagCounts.length > 0 && (
            <Paragraph>
              <Text style={styles.bold}>Tags: </Text>
              {notes.tagCounts
                .map((tag) => `${toPdfText(tag.tag)} (${pluralize(tag.days, 'day')})`)
                .join(', ')}
            </Paragraph>
          )}
          {notes.entries.length === 0 && (
            <Empty>No notes or tags were logged in this period.</Empty>
          )}
        </>
      }
    >
      {notes.entries.map((entry) => (
        <View key={entry.date} style={styles.noteEntry} wrap={false}>
          <Text style={[styles.noteText, styles.bold]}>
            {`${formatDateKey(entry.date, 'EEE d MMM yyyy')}${
              entry.phase ? ` · ${PHASE_LABELS[entry.phase]}` : ''
            }`}
          </Text>
          {entry.note && <Text style={styles.noteText}>{toPdfText(entry.note)}</Text>}
          {entry.symptomNote && (
            <Text style={styles.noteText}>
              <Text style={styles.bold}>Symptom note: </Text>
              {toPdfText(entry.symptomNote)}
            </Text>
          )}
          {entry.tags.length > 0 && (
            <Note>{`Tags: ${entry.tags.map((tag) => toPdfText(tag)).join(', ')}`}</Note>
          )}
        </View>
      ))}
      {notes.omittedEntries > 0 && (
        <Note>
          {`${pluralize(notes.omittedEntries, 'earlier entry', 'earlier entries')} not shown.`}
        </Note>
      )}
    </Section>
  );
}

function AboutSection() {
  return (
    <View style={styles.disclaimer} wrap={false}>
      <Text style={[styles.paragraph, styles.bold, { marginBottom: 3 }]}>
        About this report
      </Text>
      <Paragraph>
        {`${REPORT_DISCLAIMER} It summarises what the user logged in HealthHub, a personal wellness app. Phases, ovulation and the regularity indicator are estimates from self-reported dates and readings, not hormone tests or clinical measurements. HealthHub is not a contraceptive or fertility tool.`}
      </Paragraph>
      <Note>
        Please use it as a starting point for a conversation with a healthcare
        professional, who can interpret it alongside a proper assessment.
      </Note>
    </View>
  );
}

export function ClinicalReportDocument({ report }: { report: ClinicalReport }) {
  return (
    <Document
      title="Clinical cycle summary"
      subject="Self-reported menstrual cycle data"
      creator="HealthHub"
      producer="HealthHub"
      language="en"
    >
      <Page size="A4" style={styles.page} wrap>
        <Header report={report} />
        <TitleBlock report={report} />
        <KeyFigures report={report} />
        <CycleSection report={report} />
        <PhaseSection report={report} />
        <BbtSection report={report} />
        <SymptomSection report={report} />
        <VitalsSection report={report} />
        <NotesSection report={report} />
        <AboutSection />
        <Footer />
      </Page>
    </Document>
  );
}
