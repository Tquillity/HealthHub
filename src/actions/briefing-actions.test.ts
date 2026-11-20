import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  class BriefingDateError extends Error {
    constructor() {
      super("This briefing is out of date. Refresh the page to see today's.");
    }
  }
  return {
    requireSessionUserId: vi.fn(),
    revalidatePath: vi.fn(),
    loadBriefingState: vi.fn(),
    dismissBriefing: vi.fn(),
    restoreBriefing: vi.fn(),
    dismissSuggestion: vi.fn(),
    rateSuggestion: vi.fn(),
    saveBriefingPreferences: vi.fn(),
    getDashboardHouseholdId: vi.fn(),
    BriefingDateError,
  };
});
vi.mock('@/lib/session', () => ({
  requireSessionUserId: mocks.requireSessionUserId,
}));
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock('@/lib/dashboard-data', () => ({
  getDashboardHouseholdId: mocks.getDashboardHouseholdId,
}));
vi.mock('@/lib/briefing/data', () => ({
  loadBriefingState: mocks.loadBriefingState,
  dismissBriefing: mocks.dismissBriefing,
  restoreBriefing: mocks.restoreBriefing,
  dismissSuggestion: mocks.dismissSuggestion,
  rateSuggestion: mocks.rateSuggestion,
  saveBriefingPreferences: mocks.saveBriefingPreferences,
  BriefingDateError: mocks.BriefingDateError,
}));
import {
  dismissBriefingSuggestion,
  dismissDailyBriefing,
  generateDailyBriefing,
  rateBriefingSuggestion,
  restoreDailyBriefing,
  updateBriefingPreferences,
} from './briefing-actions';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireSessionUserId.mockResolvedValue({ ok: true, userId: 'me' });
  mocks.loadBriefingState.mockResolvedValue({
    status: 'off',
    date: '2026-11-20',
  });
  mocks.saveBriefingPreferences.mockResolvedValue({ preferences: {} });
  mocks.getDashboardHouseholdId.mockResolvedValue('home');
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('generateDailyBriefing', () => {
  it("loads the signed-in user's briefing for their profile-timezone day", async () => {
    expect(await generateDailyBriefing()).toEqual({
      success: true,
      data: { status: 'off', date: '2026-11-20' },
    });
    // Meals come from the space the dashboard shows (cookie, checked against memberships).
    expect(mocks.getDashboardHouseholdId).toHaveBeenCalledWith('me');
    // No device day: the server picks the day exactly as for the dashboard render, so
    // a hide stored after a refresh is found again on reload.
    expect(mocks.loadBriefingState).toHaveBeenCalledWith('me', {
      householdId: 'home',
    });
  });

  it('rejects guests before loading anything', async () => {
    mocks.requireSessionUserId.mockResolvedValue({
      ok: false,
      error: 'Unauthorized',
    });
    expect(await generateDailyBriefing()).toEqual({
      success: false,
      error: 'Unauthorized',
    });
    expect(mocks.loadBriefingState).not.toHaveBeenCalled();
  });

  it('logs failures without details', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.loadBriefingState.mockRejectedValue(new Error('energy was 3'));
    expect(await generateDailyBriefing()).toEqual({
      success: false,
      error: 'Failed to prepare your briefing',
    });
    expect(JSON.stringify(error.mock.calls)).not.toContain('energy was 3');
  });
});

describe('feedback actions', () => {
  it('dismisses and restores the card for the signed-in user', async () => {
    expect(await dismissDailyBriefing('2026-11-20')).toEqual({
      success: true,
      data: null,
    });
    expect(mocks.dismissBriefing).toHaveBeenCalledWith('me', '2026-11-20');
    await restoreDailyBriefing('2026-11-20');
    expect(mocks.restoreBriefing).toHaveBeenCalledWith('me', '2026-11-20');
  });

  it('accepts only known suggestion keys and ratings', async () => {
    await dismissBriefingSuggestion({ date: '2026-11-20', key: 'meal.iron' });
    expect(mocks.dismissSuggestion).toHaveBeenCalledWith('me', {
      date: '2026-11-20',
      key: 'meal.iron',
    });

    const unknown = await dismissBriefingSuggestion({
      date: '2026-11-20',
      key: 'meal.<script>' as 'meal.iron',
    });
    expect(unknown.success).toBe(false);

    const withUser = await rateBriefingSuggestion({
      date: '2026-11-20',
      key: 'meal.iron',
      rating: 'helpful',
      userId: 'someone-else',
    } as Parameters<typeof rateBriefingSuggestion>[0]);
    expect(withUser.success).toBe(false);
    expect(mocks.rateSuggestion).not.toHaveBeenCalled();

    await rateBriefingSuggestion({
      date: '2026-11-20',
      key: 'meal.iron',
      rating: null,
    });
    expect(mocks.rateSuggestion).toHaveBeenCalledWith('me', {
      date: '2026-11-20',
      key: 'meal.iron',
      rating: null,
    });
  });

  it('passes on the out-of-date message', async () => {
    mocks.dismissBriefing.mockRejectedValue(new mocks.BriefingDateError());
    expect(await dismissDailyBriefing('2026-11-01')).toEqual({
      success: false,
      error: "This briefing is out of date. Refresh the page to see today's.",
    });
  });
});

describe('updateBriefingPreferences', () => {
  it('saves valid preferences and refreshes the pages', async () => {
    const result = await updateBriefingPreferences({
      frequency: 'weekly',
      sources: ['journal'],
    });
    expect(result.success).toBe(true);
    expect(mocks.saveBriefingPreferences).toHaveBeenCalledWith('me', {
      frequency: 'weekly',
      sources: ['journal'],
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/dashboard');
  });

  it('needs at least one source and known values', async () => {
    expect(await updateBriefingPreferences({ sources: [] })).toEqual({
      success: false,
      error: 'Choose at least one kind of data for your briefing',
    });
    const bad = await updateBriefingPreferences({
      frequency: 'hourly' as 'daily',
    });
    expect(bad.success).toBe(false);
    expect(mocks.saveBriefingPreferences).not.toHaveBeenCalled();
  });
});
