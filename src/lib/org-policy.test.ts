import { describe, expect, it } from 'vitest';
import type { GroceryItem } from './grocery-aggregate';
import {
  applyGroceryPrivacy,
  canShareJournalWith,
  canShowAggregate,
  canAlignMealPlanWithCycle,
  canShowIndividualCycleStatus,
  canViewSharedJournals,
  CYCLE_STATUS_ORG_TYPES,
  getOrgPolicy,
  joinPrivacyNote,
  MIN_AGGREGATE_GROUP_SIZE,
  ORGANIZATION_TYPES,
} from './org-policy';

describe('intimacy scale', () => {
  it('has a policy for every organization type', () => {
    for (const type of ORGANIZATION_TYPES) {
      expect(getOrgPolicy(type).label).toBeTruthy();
    }
  });

  it('households fully share meals and allow opt-in individual sharing', () => {
    expect(getOrgPolicy('HOUSEHOLD')).toMatchObject({
      mealPlans: 'shared',
      grocerySources: true,
      individualSharing: 'opt-in',
      cycleStatusSharing: 'opt-in',
      aggregatesOnly: false,
    });
  });

  it('collectives share groceries, make meals opt-in and keep journals private unless shared', () => {
    expect(getOrgPolicy('COLLECTIVE')).toMatchObject({
      mealPlans: 'opt-in',
      grocerySources: true,
      individualSharing: 'opt-in',
      cycleStatusSharing: 'never',
    });
  });

  it('communities and workplaces never show individuals', () => {
    for (const type of ['COMMUNITY', 'CORPORATE'] as const) {
      expect(getOrgPolicy(type)).toMatchObject({
        individualSharing: 'never',
        cycleStatusSharing: 'never',
        aggregatesOnly: true,
        grocerySources: false,
      });
    }
  });
});

describe('journal sharing', () => {
  it('allows sharing with and reading in households and collectives only', () => {
    expect(canShareJournalWith('HOUSEHOLD')).toBe(true);
    expect(canShareJournalWith('COLLECTIVE')).toBe(true);
    expect(canShareJournalWith('COMMUNITY')).toBe(false);
    expect(canShareJournalWith('CORPORATE')).toBe(false);
    expect(canViewSharedJournals('COMMUNITY')).toBe(false);
    expect(canViewSharedJournals('CORPORATE')).toBe(false);
    expect(canViewSharedJournals('HOUSEHOLD')).toBe(true);
  });
});

describe('canShowIndividualCycleStatus (partner sync)', () => {
  it('needs both a household and the person opting in', () => {
    expect(canShowIndividualCycleStatus('HOUSEHOLD', { sharerOptedIn: true })).toBe(true);
    expect(canShowIndividualCycleStatus('HOUSEHOLD', { sharerOptedIn: false })).toBe(false);
    expect(canShowIndividualCycleStatus('COMMUNITY', { sharerOptedIn: true })).toBe(false);
    expect(canShowIndividualCycleStatus('CORPORATE', { sharerOptedIn: true })).toBe(false);
  });

  it('keeps cycle status out of collectives, even though journal days may be shared there', () => {
    expect(canShowIndividualCycleStatus('COLLECTIVE', { sharerOptedIn: true })).toBe(false);
    expect(canShareJournalWith('COLLECTIVE')).toBe(true);
    expect(CYCLE_STATUS_ORG_TYPES).toEqual(['HOUSEHOLD']);
  });
});

describe('canAlignMealPlanWithCycle (cycle-aware meal planning)', () => {
  it("allows a plan aligned with one person's cycle in households only", () => {
    expect(canAlignMealPlanWithCycle('HOUSEHOLD')).toBe(true);
    // The shared plan would hint at the person's phase to a wider circle
    expect(canAlignMealPlanWithCycle('COLLECTIVE')).toBe(false);
    expect(canAlignMealPlanWithCycle('COMMUNITY')).toBe(false);
    expect(canAlignMealPlanWithCycle('CORPORATE')).toBe(false);
  });
});

describe('joinPrivacyNote (invitation screens)', () => {
  it('says joining shares nothing, for every type', () => {
    for (const type of ORGANIZATION_TYPES) {
      expect(joinPrivacyNote(type)).toMatch(/^Joining shares nothing from your journal or cycle\. /);
    }
  });

  it('names cycle status as a separate choice in households only', () => {
    expect(joinPrivacyNote('HOUSEHOLD')).toBe(
      'Joining shares nothing from your journal or cycle. Both stay private unless you choose to share a journal day, or your cycle status, with this household.'
    );
    expect(joinPrivacyNote('COLLECTIVE')).toBe(
      'Joining shares nothing from your journal or cycle. Your journal stays private unless you choose to share a day here, and your cycle status is never shown here.'
    );
    for (const type of ['COMMUNITY', 'CORPORATE'] as const) {
      expect(joinPrivacyNote(type)).toBe(
        "Joining shares nothing from your journal or cycle. Nobody here can see anyone's journal or cycle."
      );
    }
  });
});

describe('canShowAggregate', () => {
  it('requires the minimum group size', () => {
    expect(MIN_AGGREGATE_GROUP_SIZE).toBe(5);
    expect(canShowAggregate(4)).toBe(false);
    expect(canShowAggregate(5)).toBe(true);
    expect(canShowAggregate(0)).toBe(false);
    expect(canShowAggregate(Number.NaN)).toBe(false);
  });
});

describe('applyGroceryPrivacy', () => {
  const items: GroceryItem[] = [
    {
      name: 'Oats',
      unit: 'g',
      totalQuantity: 200,
      recipes: [{ recipeName: 'Porridge', quantity: 200, mealType: 'breakfast', date: '2026-01-05' }],
    },
  ];

  it('keeps sources in households and collectives', () => {
    expect(applyGroceryPrivacy(items, 'HOUSEHOLD')).toBe(items);
    expect(applyGroceryPrivacy(items, 'COLLECTIVE')).toBe(items);
  });

  it('drops where items came from in communities and workplaces, keeping totals', () => {
    for (const type of ['COMMUNITY', 'CORPORATE'] as const) {
      expect(applyGroceryPrivacy(items, type)).toEqual([
        { name: 'Oats', unit: 'g', totalQuantity: 200, recipes: [] },
      ]);
    }
  });
});
