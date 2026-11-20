import { describe, expect, it } from 'vitest';
import { describeReportContents } from './clinical-report-preview';

const OFF = {
  includeName: false,
  includeNotes: false,
  includeBbt: false,
  includeSymptoms: false,
  includeVitals: false,
};

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
});
