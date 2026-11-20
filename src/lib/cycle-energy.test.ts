import { describe, expect, it } from 'vitest';
import { typicalEnergyForCycleDay, typicalPhaseEnergy } from './cycle-energy';

describe('typicalEnergyForCycleDay', () => {
  it('draws the same curve the cycle chart always showed', () => {
    const round = (value: number) => Math.round(value * 10) / 10;
    expect(round(typicalEnergyForCycleDay(1, 28))).toBe(3.2);
    expect(round(typicalEnergyForCycleDay(5, 28))).toBe(4);
    expect(round(typicalEnergyForCycleDay(14, 28))).toBe(7);
    expect(round(typicalEnergyForCycleDay(18, 28))).toBe(10);
    expect(round(typicalEnergyForCycleDay(19, 28))).toBe(8);
    expect(round(typicalEnergyForCycleDay(28, 28))).toBe(3.5);
  });

  it('stretches the luteal decline over longer cycles', () => {
    expect(typicalEnergyForCycleDay(35, 35)).toBeCloseTo(3.5);
    expect(typicalEnergyForCycleDay(28, 35)).toBeGreaterThan(3.5);
  });
});

describe('typicalPhaseEnergy', () => {
  it('averages the days the phase model gives each phase, as the chart bands do', () => {
    // 28 days: menstrual 1-5, follicular 6-10, ovulation 11-14, luteal 15-28.
    const meanOf = (first: number, last: number, cycleLength = 28) => {
      let total = 0;
      for (let day = first; day <= last; day++) {
        total += typicalEnergyForCycleDay(day, cycleLength);
      }
      return total / (last - first + 1);
    };
    expect(typicalPhaseEnergy('menstrual', 28)).toBeCloseTo(3.6);
    expect(typicalPhaseEnergy('follicular', 28)).toBeCloseTo(meanOf(6, 10));
    expect(typicalPhaseEnergy('follicular', 28)).toBeCloseTo(5);
    // Not the 9.25 of days 15-18, which the briefing and the chart call luteal.
    expect(typicalPhaseEnergy('ovulation', 28)).toBeCloseTo(meanOf(11, 14));
    expect(typicalPhaseEnergy('ovulation', 28)).toBeCloseTo(6.5);
    expect(typicalPhaseEnergy('luteal', 28)).toBeCloseTo(meanOf(15, 28));
    expect(typicalPhaseEnergy('luteal', 28)).toBeCloseTo(6.75);
  });

  it('follows the ovulation estimate on other cycle lengths', () => {
    // 25 days: ovulation days 8-11; 35 days: ovulation days 18-21.
    const meanOf = (first: number, last: number, cycleLength: number) => {
      let total = 0;
      for (let day = first; day <= last; day++) {
        total += typicalEnergyForCycleDay(day, cycleLength);
      }
      return total / (last - first + 1);
    };
    expect(typicalPhaseEnergy('ovulation', 25)).toBeCloseTo(meanOf(8, 11, 25));
    expect(typicalPhaseEnergy('ovulation', 35)).toBeCloseTo(
      meanOf(18, 21, 35)
    );
    expect(typicalPhaseEnergy('luteal', 35)).toBeCloseTo(meanOf(22, 35, 35));
  });

  it('handles the shortest cycles the profile allows', () => {
    expect(Number.isFinite(typicalPhaseEnergy('luteal', 20))).toBe(true);
    expect(Number.isFinite(typicalPhaseEnergy('luteal', 18))).toBe(true);
    // 20 days: ovulation on day 6 right after the period, so no follicular day.
    expect(typicalPhaseEnergy('follicular', 20)).toBeCloseTo(
      typicalEnergyForCycleDay(6, 20)
    );
  });
});
