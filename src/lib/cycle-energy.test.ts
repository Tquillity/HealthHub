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
  it('is lowest in the menstrual phase and highest around ovulation', () => {
    const menstrual = typicalPhaseEnergy('menstrual', 28);
    const follicular = typicalPhaseEnergy('follicular', 28);
    const ovulation = typicalPhaseEnergy('ovulation', 28);
    const luteal = typicalPhaseEnergy('luteal', 28);
    expect(menstrual).toBeCloseTo(3.6);
    expect(follicular).toBeCloseTo(5.67, 1);
    expect(ovulation).toBeCloseTo(9.25);
    expect(luteal).toBeCloseTo(5.75);
    expect(menstrual).toBeLessThan(follicular);
    expect(follicular).toBeLessThan(ovulation);
    expect(luteal).toBeLessThan(ovulation);
  });

  it('handles the shortest cycles the profile allows', () => {
    expect(Number.isFinite(typicalPhaseEnergy('luteal', 20))).toBe(true);
    expect(Number.isFinite(typicalPhaseEnergy('luteal', 18))).toBe(true);
  });
});
