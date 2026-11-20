import { describe, expect, it } from 'vitest';
import { describeReportContents } from './clinical-report-preview';
import {
  buildClinicalReport,
  resolveReportInclusion,
  type ReportToggles,
} from './clinical-report';

const OFF = {
  includeName: false,
  includeNotes: false,
  includeBbt: false,
  includeSymptoms: false,
  includeVitals: false,
};

const SYMPTOM_NOTES_LEFT_OUT =
  'Symptom notes (need both Symptoms and Journal notes ticked)';

describe('describeReportContents', () => {
  it('always lists the cycle figures and leaves every optional section out', () => {
    const preview = describeReportContents(OFF, { vitalsAvailable: true });
    expect(preview.included).toHaveLength(2);
    expect(preview.included[0]).toMatch(/Cycle start dates/);
    expect(preview.leftOut).toEqual([
      'Your name',
      'Waking temperatures (BBT)',
      'Symptoms, mood and energy',
      'Vitals (heart rate, HRV and sleep)',
      'Journal notes and tags',
      SYMPTOM_NOTES_LEFT_OUT,
    ]);
  });

  it('lists each section that is turned on', () => {
    const preview = describeReportContents(
      { ...OFF, includeName: true, includeBbt: true, includeNotes: true },
      { vitalsAvailable: true }
    );
    expect(preview.included).toContain('Your name in the header');
    expect(preview.included).toContain(
      'Waking temperatures (BBT) with confirmed ovulation days'
    );
    expect(preview.included).toContain('Your journal notes and tags, shortened');
    expect(preview.leftOut).toEqual([
      'Symptoms, mood and energy',
      'Vitals (heart rate, HRV and sleep)',
      SYMPTOM_NOTES_LEFT_OUT,
    ]);
  });

  it('leaves vitals out without the vitals opt-in, as the server does', () => {
    const preview = describeReportContents(
      { ...OFF, includeVitals: true },
      { vitalsAvailable: false }
    );
    expect(preview.leftOut).toContain('Vitals (heart rate, HRV and sleep)');
    expect(preview.included.join(' ')).not.toMatch(/heart rate/);
  });

  it('includes symptom notes only with both symptoms and notes ticked', () => {
    const notesOnly = describeReportContents(
      { ...OFF, includeNotes: true },
      { vitalsAvailable: true }
    );
    expect(notesOnly.included.join(' ')).not.toMatch(/symptom/i);
    expect(notesOnly.leftOut).toContain(SYMPTOM_NOTES_LEFT_OUT);

    const both = describeReportContents(
      { ...OFF, includeNotes: true, includeSymptoms: true },
      { vitalsAvailable: true }
    );
    expect(both.included).toContain('Your symptom notes, shortened');
    expect(both.leftOut.join(' ')).not.toMatch(/symptom/i);
  });
});

describe('preview and report stay in lock-step', () => {
  const KEYS = [
    'includeName',
    'includeBbt',
    'includeSymptoms',
    'includeVitals',
    'includeNotes',
  ] as const;
  const combos: ReportToggles[] = Array.from({ length: 2 ** KEYS.length }, (_, n) =>
    Object.fromEntries(KEYS.map((key, i) => [key, Boolean(n & (1 << i))]))
  ) as ReportToggles[];

  const SECRET_SYMPTOM_NOTE = 'Heavy bleeding and panic attacks';

  for (const vitalsAvailable of [true, false]) {
    it(`matches for every toggle combination (vitals opt-in ${vitalsAvailable})`, () => {
      for (const toggles of combos) {
        const include = resolveReportInclusion(toggles, { vitalsAvailable });
        // Inputs as the loader passes them: one per included section. The note day
        // always carries a symptom note, so the builder's own guard is exercised too.
        const report = buildClinicalReport({
          today: '2026-11-20',
          months: 3,
          generatedAt: '2026-11-20T10:00:00.000Z',
          name: include.name ? 'Alex' : null,
          typicalCycleLength: 28,
          temperatureUnit: 'C',
          periodStarts: ['2026-10-01', '2026-10-29'],
          bbtReadings: include.bbt ? [] : undefined,
          symptomDays: include.symptoms ? [] : undefined,
          vitalsRows: include.vitals ? [] : undefined,
          noteDays: include.notes
            ? [
                {
                  date: '2026-11-02',
                  note: 'Travel',
                  symptomNote: SECRET_SYMPTOM_NOTE,
                  tags: [],
                },
              ]
            : undefined,
        });
        expect(report.meta.sections).toEqual(include);

        const preview = describeReportContents(toggles, { vitalsAvailable });
        const promised = preview.included.join(' | ');
        expect(promised.includes('symptom notes')).toBe(
          JSON.stringify(report).includes(SECRET_SYMPTOM_NOTE)
        );
        expect(promised.includes('Symptom frequency')).toBe('symptoms' in report);
        expect(promised.includes('Resting heart rate')).toBe('vitals' in report);
        expect(promised.includes('journal notes')).toBe('notes' in report);
        expect(promised.includes('(BBT)')).toBe('bbt' in report);
        expect(promised.includes('Your name')).toBe(report.meta.name !== null);
      }
    });
  }
});
