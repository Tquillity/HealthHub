import { describe, expect, it } from 'vitest';
import {
  QUICK_PREP_MAX_ACTIVE_MINUTES,
  activeTimeSchema,
  batchEfficiencySchema,
  formatMinutes,
  formatYield,
  getRecipeTimeSummary,
  isQuickPrep,
  isYieldPairIncomplete,
  leanRoleSchema,
  normalizeBatchEfficiency,
  normalizeLeanRole,
  passiveTimeSchema,
  yieldAmountSchema,
  yieldUnitSchema,
} from './lean-kitchen';

describe('normalizeLeanRole / normalizeBatchEfficiency', () => {
  it('maps any casing to the canonical value', () => {
    expect(normalizeLeanRole('infrastructure')).toBe('Infrastructure');
    expect(normalizeLeanRole('  TREAT ')).toBe('Treat');
    expect(normalizeBatchEfficiency('high')).toBe('High');
  });

  it('returns null for unknown, blank or non-string values', () => {
    expect(normalizeLeanRole('Batch')).toBeNull();
    expect(normalizeLeanRole('')).toBeNull();
    expect(normalizeLeanRole(null)).toBeNull();
    expect(normalizeLeanRole(3)).toBeNull();
    expect(normalizeBatchEfficiency('Base Unit')).toBeNull();
  });
});

describe('leanRoleSchema / batchEfficiencySchema', () => {
  it('accepts canonical values and normalises casing', () => {
    expect(leanRoleSchema.parse('Daily')).toBe('Daily');
    expect(leanRoleSchema.parse('process')).toBe('Process');
    expect(batchEfficiencySchema.parse('MEDIUM')).toBe('Medium');
  });

  it('treats blank and null as a cleared value', () => {
    expect(leanRoleSchema.parse('')).toBeNull();
    expect(leanRoleSchema.parse(null)).toBeNull();
    expect(batchEfficiencySchema.parse('  ')).toBeNull();
  });

  it('stays optional for partial updates', () => {
    expect(leanRoleSchema.optional().parse(undefined)).toBeUndefined();
    expect(batchEfficiencySchema.optional().parse(undefined)).toBeUndefined();
  });

  it('rejects unknown values with a friendly message', () => {
    const role = leanRoleSchema.safeParse('Batch');
    expect(role.success).toBe(false);
    expect(role.error?.issues[0]?.message).toMatch(/Infrastructure, Process/);
    expect(batchEfficiencySchema.safeParse('Base Unit').success).toBe(false);
    expect(leanRoleSchema.safeParse(42).success).toBe(false);
  });
});

describe('time and yield schemas', () => {
  it('accepts whole, non-negative minutes within bounds', () => {
    expect(activeTimeSchema.parse(0)).toBe(0);
    expect(passiveTimeSchema.parse(720)).toBe(720);
    expect(activeTimeSchema.parse(null)).toBeNull();
  });

  it('rejects fractional, negative or absurd minutes', () => {
    expect(activeTimeSchema.safeParse(12.5).success).toBe(false);
    expect(activeTimeSchema.safeParse(-1).success).toBe(false);
    expect(activeTimeSchema.safeParse(24 * 60 + 1).success).toBe(false);
    expect(passiveTimeSchema.safeParse(7 * 24 * 60 + 1).success).toBe(false);
  });

  it('allows fractional yields but not zero, NaN or Infinity', () => {
    expect(yieldAmountSchema.parse(2.5)).toBe(2.5);
    expect(yieldAmountSchema.safeParse(0).success).toBe(false);
    expect(yieldAmountSchema.safeParse(Number.NaN).success).toBe(false);
    expect(yieldAmountSchema.safeParse(Infinity).success).toBe(false);
  });

  it('trims the yield unit and limits its length', () => {
    expect(yieldUnitSchema.parse('  frallor ')).toBe('frallor');
    expect(yieldUnitSchema.parse('   ')).toBeNull();
    expect(yieldUnitSchema.safeParse('x'.repeat(41)).success).toBe(false);
  });

  it('flags a yield with only one part', () => {
    expect(isYieldPairIncomplete(36, 'frallor')).toBe(false);
    expect(isYieldPairIncomplete(null, null)).toBe(false);
    expect(isYieldPairIncomplete(undefined, null)).toBe(false);
    expect(isYieldPairIncomplete(36, null)).toBe(true);
    expect(isYieldPairIncomplete(undefined, 'dl')).toBe(true);
  });
});

describe('getRecipeTimeSummary', () => {
  it('uses active + passive when both are recorded', () => {
    expect(
      getRecipeTimeSummary({
        prepTime: 25,
        cookTime: 25,
        activeTime: 35,
        passiveTime: 240,
      })
    ).toEqual({
      activeMinutes: 35,
      passiveMinutes: 240,
      hasLeanTimes: true,
      totalMinutes: 275,
    });
  });

  it('counts a recorded zero as a LEAN time', () => {
    const summary = getRecipeTimeSummary({ activeTime: 5, passiveTime: 0 });
    expect(summary.hasLeanTimes).toBe(true);
    expect(summary.passiveMinutes).toBe(0);
    expect(summary.totalMinutes).toBe(5);
  });

  it('falls back to prep + cook without LEAN times', () => {
    expect(getRecipeTimeSummary({ prepTime: 10, cookTime: 30 })).toEqual({
      activeMinutes: null,
      passiveMinutes: null,
      hasLeanTimes: false,
      totalMinutes: 40,
    });
    expect(getRecipeTimeSummary({}).totalMinutes).toBe(0);
  });

  it('never reports less than a partially recorded LEAN time', () => {
    expect(
      getRecipeTimeSummary({ prepTime: 10, cookTime: 30, activeTime: 10 })
        .totalMinutes
    ).toBe(40);
    expect(
      getRecipeTimeSummary({ prepTime: 5, passiveTime: 120 }).totalMinutes
    ).toBe(120);
  });
});

describe('isQuickPrep', () => {
  it('includes recipes at or under the limit', () => {
    expect(isQuickPrep({ activeTime: 0 })).toBe(true);
    expect(isQuickPrep({ activeTime: QUICK_PREP_MAX_ACTIVE_MINUTES })).toBe(
      true
    );
  });

  it('excludes recipes over the limit or without a recorded active time', () => {
    expect(isQuickPrep({ activeTime: QUICK_PREP_MAX_ACTIVE_MINUTES + 1 })).toBe(
      false
    );
    expect(isQuickPrep({ activeTime: null })).toBe(false);
    expect(isQuickPrep({})).toBe(false);
  });
});

describe('formatMinutes / formatYield', () => {
  it('formats minutes and hours', () => {
    expect(formatMinutes(0)).toBe('0 min');
    expect(formatMinutes(45)).toBe('45 min');
    expect(formatMinutes(120)).toBe('2 h');
    expect(formatMinutes(160)).toBe('2 h 40 min');
  });

  it('formats a yield only when both parts exist', () => {
    expect(formatYield(36, 'frallor')).toBe('36 frallor');
    expect(formatYield(2.5, ' dl ')).toBe('2.5 dl');
    expect(formatYield(1 / 3, 'kg')).toBe('0.33 kg');
    expect(formatYield(36, '')).toBeNull();
    expect(formatYield(null, 'dl')).toBeNull();
  });
});
