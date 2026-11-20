import { describe, expect, it } from 'vitest';
import type { ChartBbtOverlay, ThermalShiftSummary } from './cycle-insights';
import {
  bbtAxisDomain,
  bbtReadingStatus,
  formatShortDate,
  thermalShiftMessage,
} from './cycle-chart-overlays';

const noShift: ThermalShiftSummary = {
  cycleStart: '2026-03-01',
  detected: false,
  ovulationDate: null,
  shiftDate: null,
  confirmedDate: null,
  coverlineCelsius: null,
  validReadings: 4,
  readingsNeeded: 9,
};

const shift: ThermalShiftSummary = {
  ...noShift,
  detected: true,
  ovulationDate: '2026-03-14',
  shiftDate: '2026-03-15',
  confirmedDate: '2026-03-17',
  coverlineCelsius: 36.5,
  validReadings: 17,
};

describe('formatShortDate', () => {
  it('formats the calendar day without shifting it', () => {
    expect(formatShortDate('2026-03-05')).toBe('Mar 5');
  });
});

describe('thermalShiftMessage', () => {
  it('reports a bio-verified shift with the coverline in the user unit', () => {
    expect(thermalShiftMessage(shift, 'C')).toBe(
      'Ovulation bio-verified around Mar 14. Three readings stayed above your coverline of 36.50 °C.'
    );
    expect(thermalShiftMessage(shift, 'F')).toContain('97.70 °F');
  });

  it('counts readings until enough are logged', () => {
    expect(thermalShiftMessage(noShift, 'C')).toBe(
      '4 of 9 readings this cycle. Keep logging to see your temperature shift.'
    );
    expect(thermalShiftMessage({ ...noShift, validReadings: 12 }, 'C')).toBe(
      'No temperature shift yet this cycle. Keep logging each morning.'
    );
  });

  it('asks for a period start when there is none', () => {
    expect(thermalShiftMessage({ ...noShift, cycleStart: null }, 'C')).toBe(
      'Log when your period starts to follow your temperature by cycle.'
    );
  });
});

describe('bbtReadingStatus', () => {
  it('places readings around the shift', () => {
    expect(bbtReadingStatus('2026-03-10', shift)).toBe(
      'Before your temperature shift'
    );
    expect(bbtReadingStatus('2026-03-14', shift)).toBe(
      'Bio-verified ovulation day'
    );
    expect(bbtReadingStatus('2026-03-16', shift)).toBe(
      'After your temperature shift'
    );
    expect(bbtReadingStatus('2026-02-27', shift)).toBe('Previous cycle');
    expect(bbtReadingStatus('2026-03-10', noShift)).toBe(
      'Not verified yet: no temperature shift this cycle'
    );
  });
});

describe('bbtAxisDomain', () => {
  const overlay: ChartBbtOverlay = {
    unit: 'C',
    points: [
      { day: 1, date: '2026-03-01', celsius: 36.3, value: 36.3 },
      { day: 2, date: '2026-03-02', celsius: 36.8, value: 36.8 },
    ],
    shift: noShift,
    ovulationDay: null,
    coverline: null,
  };

  it('pads the readings, with extra room above for the marker', () => {
    expect(bbtAxisDomain(overlay)).toEqual([36.1, 37.2]);
  });

  it('includes the coverline', () => {
    expect(bbtAxisDomain({ ...overlay, coverline: 35.9 })).toEqual([
      35.7, 37.2,
    ]);
  });
});
