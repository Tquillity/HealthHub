import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { renderToBuffer } from '@react-pdf/renderer';
import { addDaysToDateOnly } from '@/lib/date-only';
import {
  buildClinicalReport,
  type ClinicalReportInput,
  type SymptomDay,
} from '@/lib/clinical-report';
import { clinicalReportDocument } from './clinical-report-pdf-render';

/**
 * Smoke test: the document renders to a valid PDF for a full and an empty report, and
 * the text layer contains what was included and nothing that was left out.
 */

/** Text of a react-pdf/pdfkit PDF: inflate content streams, decode hex text strings. */
function pdfText(buffer: Buffer): string {
  const raw = buffer.toString('latin1');
  let text = '';
  const streams = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  for (let match = streams.exec(raw); match; match = streams.exec(raw)) {
    let content: string;
    try {
      content = inflateSync(Buffer.from(match[1], 'latin1')).toString('latin1');
    } catch {
      continue;
    }
    for (const array of content.matchAll(/\[([^\]]*)\]\s*TJ/g)) {
      for (const hex of array[1].matchAll(/<([0-9a-fA-F]*)>/g)) {
        text += Buffer.from(hex[1], 'hex').toString('latin1');
      }
      text += ' ';
    }
  }
  return text;
}

function pageCount(buffer: Buffer): number {
  return buffer.toString('latin1').match(/\/Type \/Page\b(?!s)/g)?.length ?? 0;
}

const TODAY = '2026-11-20';
const STARTS = ['2026-05-25', '2026-06-22', '2026-07-22', '2026-08-18', '2026-09-16', '2026-10-14', '2026-11-11'];

function fullInput(): ClinicalReportInput {
  const bbtReadings = STARTS.slice(0, -1).flatMap((start) =>
    Array.from({ length: 27 }, (_, i) => ({
      date: addDaysToDateOnly(start, i),
      celsius: i < 14 ? 36.25 + (i % 3) * 0.05 : 36.65 + (i % 2) * 0.05,
    }))
  );
  const symptomDays: SymptomDay[] = STARTS.flatMap((start) => [
    { date: start, mood: 4, energy: 3, physical: ['Cramps', 'Bloating'], mental: ['Tired 😴'] },
    { date: addDaysToDateOnly(start, 1), mood: 5, energy: 4, physical: ['Cramps', 'Headache'], mental: ['Tired'] },
    { date: addDaysToDateOnly(start, 20), mood: 6, energy: 5, physical: ['Bloating'], mental: ['Irritable'] },
  ]);
  return {
    today: TODAY,
    months: 6,
    generatedAt: '2026-11-20T10:00:00.000Z',
    name: 'Alex Example',
    typicalCycleLength: 28,
    temperatureUnit: 'C',
    periodStarts: STARTS,
    bbtReadings,
    symptomDays,
    vitalsRows: STARTS.map((start, i) => ({
      date: addDaysToDateOnly(start, 3),
      temperature: null,
      restingHeartRate: 58 + i,
      heartRateVariability: 45 - i,
      sleepQuality: 7,
      sleepHours: 7.5,
    })),
    noteDays: [
      { date: '2026-09-02', note: 'Flu, stayed home. Smör & ägg.', symptomNote: 'Headache all day', tags: ['illness'] },
      { date: '2026-10-20', note: null, symptomNote: null, tags: ['travel', 'stress'] },
    ],
  };
}

async function render(input: ClinicalReportInput): Promise<Buffer> {
  return renderToBuffer(clinicalReportDocument(buildClinicalReport(input)));
}

describe('ClinicalReportDocument', () => {
  it('renders every section of a full report', async () => {
    const buffer = await render(fullInput());
    expect(buffer.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(pageCount(buffer)).toBeGreaterThanOrEqual(2);
    const text = pdfText(buffer);
    for (const expected of [
      'Clinical cycle summary',
      'Prepared for Alex Example',
      'Cycle length variability',
      'Phase distribution',
      'Temperature (BBT) trends',
      'Symptom patterns',
      'Vitals and recovery',
      'Notes and events',
      'Flu, stayed home. Smör & ägg.',
      'Generated from self-reported data; not a diagnosis.',
      'Page 1 of',
    ]) {
      expect(text.replace(/\s+/g, ' ')).toContain(expected);
    }
  }, 30_000);

  it('renders a minimal report without the sections that were left out', async () => {
    const { bbtReadings, symptomDays, vitalsRows, noteDays, ...minimal } =
      fullInput();
    void bbtReadings;
    void symptomDays;
    void vitalsRows;
    void noteDays;
    const buffer = await render({ ...minimal, name: null });
    const text = pdfText(buffer).replace(/\s+/g, ' ');
    expect(text).toContain('Cycle length variability');
    for (const absent of [
      'Alex',
      'Temperature (BBT) trends',
      'Symptom patterns',
      'Vitals and recovery',
      'Notes and events',
      'Flu',
    ]) {
      expect(text).not.toContain(absent);
    }
  }, 30_000);

  it('renders a report with no data at all', async () => {
    const buffer = await render({
      ...fullInput(),
      name: null,
      periodStarts: [],
      bbtReadings: [],
      symptomDays: [],
      vitalsRows: [],
      noteDays: [],
    });
    const text = pdfText(buffer).replace(/\s+/g, ' ');
    expect(text).toContain('No completed cycles in this period yet');
    expect(text).toContain('No waking temperatures were logged');
  }, 30_000);
});
