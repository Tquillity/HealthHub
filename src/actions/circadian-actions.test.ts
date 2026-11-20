import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  class CircadianNotEnabledError extends Error {
    constructor() {
      super('Turn on circadian insights in your profile.');
    }
  }
  class EnergyCheckInClosedError extends Error {
    constructor() {
      super('Energy check-ins are open from 06:00 to 22:00 your time.');
    }
  }
  return {
    requireSessionUserId: vi.fn(),
    revalidatePath: vi.fn(),
    saveEnergyNow: vi.fn(),
    updateCircadianPreferences: vi.fn(),
    clearTimeOfDayEnergy: vi.fn(),
    CircadianNotEnabledError,
    EnergyCheckInClosedError,
  };
});
vi.mock('@/lib/session', () => ({
  requireSessionUserId: mocks.requireSessionUserId,
}));
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock('@/lib/circadian-data', () => ({
  saveEnergyNow: mocks.saveEnergyNow,
  updateCircadianPreferences: mocks.updateCircadianPreferences,
  clearTimeOfDayEnergy: mocks.clearTimeOfDayEnergy,
  CircadianNotEnabledError: mocks.CircadianNotEnabledError,
  EnergyCheckInClosedError: mocks.EnergyCheckInClosedError,
}));
import {
  deleteAllTimeOfDayEnergy,
  logEnergyNow,
  updateCircadianPreferences,
} from './circadian-actions';

const guest = { ok: false, error: 'Unauthorized' } as const;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireSessionUserId.mockResolvedValue({ ok: true, userId: 'me' });
  mocks.saveEnergyNow.mockResolvedValue({
    date: '2026-11-20',
    slot: 'morning',
    energy: 7,
  });
  mocks.updateCircadianPreferences.mockResolvedValue({ enabled: true });
  mocks.clearTimeOfDayEnergy.mockResolvedValue(3);
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('logEnergyNow', () => {
  it('saves the rating for the signed-in user (the server picks the slot)', async () => {
    expect(await logEnergyNow({ energy: 7 })).toEqual({
      success: true,
      data: { date: '2026-11-20', slot: 'morning', energy: 7 },
    });
    expect(mocks.saveEnergyNow).toHaveBeenCalledWith('me', 7);
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/dashboard');
  });

  it('rejects guests and invalid ratings before touching data', async () => {
    mocks.requireSessionUserId.mockResolvedValueOnce(guest);
    expect(await logEnergyNow({ energy: 7 })).toEqual({
      success: false,
      error: 'Unauthorized',
    });
    for (const energy of [0, 11, 5.5, Number.NaN]) {
      expect((await logEnergyNow({ energy })).success).toBe(false);
    }
    expect(
      (await logEnergyNow({ energy: '7' } as unknown as { energy: number }))
        .success
    ).toBe(false);
    expect(mocks.saveEnergyNow).not.toHaveBeenCalled();
  });

  it('passes on opt-in and night-time messages', async () => {
    mocks.saveEnergyNow.mockRejectedValueOnce(
      new mocks.CircadianNotEnabledError()
    );
    expect(await logEnergyNow({ energy: 5 })).toEqual({
      success: false,
      error: 'Turn on circadian insights in your profile.',
    });
    mocks.saveEnergyNow.mockRejectedValueOnce(
      new mocks.EnergyCheckInClosedError()
    );
    expect(await logEnergyNow({ energy: 5 })).toMatchObject({
      success: false,
      error: expect.stringContaining('06:00 to 22:00'),
    });
  });

  it('logs only the error class on unexpected failures, never the value', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    mocks.saveEnergyNow.mockRejectedValueOnce(
      new Error('Invalid value energyMorning: 9')
    );
    expect(await logEnergyNow({ energy: 9 })).toEqual({
      success: false,
      error: 'Failed to save your energy',
    });
    const logged = consoleError.mock.calls.flat().join(' ');
    expect(logged).not.toContain('9');
    expect(logged).not.toContain('energyMorning');
  });
});

describe('updateCircadianPreferences', () => {
  it('turns the opt-in on or off for the signed-in user', async () => {
    expect(await updateCircadianPreferences({ enabled: true })).toEqual({
      success: true,
      data: { enabled: true },
    });
    expect(mocks.updateCircadianPreferences).toHaveBeenCalledWith('me', {
      enabled: true,
    });
  });

  it("passes on the device's time zone, trimmed", async () => {
    await updateCircadianPreferences({
      enabled: true,
      deviceTimeZone: ' Europe/Stockholm ',
    });
    expect(mocks.updateCircadianPreferences).toHaveBeenCalledWith('me', {
      enabled: true,
      deviceTimeZone: 'Europe/Stockholm',
    });
    expect(
      (
        await updateCircadianPreferences({
          enabled: true,
          deviceTimeZone: 'x'.repeat(101),
        })
      ).success
    ).toBe(false);
  });

  it('rejects guests and anything but a boolean', async () => {
    mocks.requireSessionUserId.mockResolvedValueOnce(guest);
    expect((await updateCircadianPreferences({ enabled: true })).success).toBe(
      false
    );
    expect(
      (
        await updateCircadianPreferences({
          enabled: 'yes',
        } as unknown as { enabled: boolean })
      ).success
    ).toBe(false);
    expect(mocks.updateCircadianPreferences).not.toHaveBeenCalled();
  });
});

describe('deleteAllTimeOfDayEnergy', () => {
  it("clears only the signed-in user's check-ins", async () => {
    expect(await deleteAllTimeOfDayEnergy()).toEqual({
      success: true,
      data: { clearedDays: 3 },
    });
    expect(mocks.clearTimeOfDayEnergy).toHaveBeenCalledWith('me');
  });

  it('rejects guests', async () => {
    mocks.requireSessionUserId.mockResolvedValueOnce(guest);
    expect(await deleteAllTimeOfDayEnergy()).toEqual({
      success: false,
      error: 'Unauthorized',
    });
    expect(mocks.clearTimeOfDayEnergy).not.toHaveBeenCalled();
  });
});
