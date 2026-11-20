import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireSessionUserId: vi.fn(),
  revalidatePath: vi.fn(),
  allowedTimeOfDayEnergy: vi.fn(),
  upsert: vi.fn(),
}));
vi.mock('@/lib/session', () => ({
  requireSessionUserId: mocks.requireSessionUserId,
}));
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock('@/lib/circadian-data', () => ({
  allowedTimeOfDayEnergy: mocks.allowedTimeOfDayEnergy,
}));
vi.mock('@/lib/db', () => ({
  prisma: { journalEntry: { upsert: mocks.upsert } },
}));
import { logJournalEntry } from './journal-actions';

const baseEntry = {
  date: '2026-11-20',
  tags: [],
  gratitudeEntries: [],
  goalsAchieved: [],
  goalsProgress: [],
  symptomsPhysical: [],
  symptomsMental: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('BETTER_AUTH_SECRET', 'test-secret-minimum-32-characters-long');
  mocks.requireSessionUserId.mockResolvedValue({ ok: true, userId: 'me' });
  mocks.allowedTimeOfDayEnergy.mockImplementation(
    async (_userId: string, input: Record<string, unknown>) => {
      const sent: Record<string, unknown> = {};
      for (const key of ['energyMorning', 'energyAfternoon', 'energyEvening']) {
        if (input[key] !== undefined) sent[key] = input[key];
      }
      return sent;
    }
  );
  mocks.upsert.mockImplementation(
    async (args: { create: Record<string, unknown> }) => ({
      ...args.create,
      id: 'entry',
      createdAt: new Date(),
      updatedAt: new Date(),
    })
  );
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('logJournalEntry: energy by time of day', () => {
  it('saves the time-of-day ratings the opt-in allows', async () => {
    const result = await logJournalEntry({
      ...baseEntry,
      energy: 6,
      energyMorning: 8,
      energyAfternoon: null,
    });
    expect(result.success).toBe(true);
    expect(mocks.allowedTimeOfDayEnergy).toHaveBeenCalledWith(
      'me',
      expect.objectContaining({ energyMorning: 8, energyAfternoon: null })
    );
    const [{ update }] = mocks.upsert.mock.calls[0];
    expect(update).toMatchObject({
      energy: 6,
      energyMorning: 8,
      energyAfternoon: null,
    });
    // Not sent: left unchanged.
    expect(update).not.toHaveProperty('energyEvening');
  });

  it('writes no time-of-day ratings while the opt-in is off', async () => {
    mocks.allowedTimeOfDayEnergy.mockResolvedValue({});
    await logJournalEntry({ ...baseEntry, energyEvening: 4 });
    const [{ update, create }] = mocks.upsert.mock.calls[0];
    expect(update).not.toHaveProperty('energyEvening');
    expect(create).not.toHaveProperty('energyEvening');
  });

  it('rejects ratings outside 1-10 before touching the database', async () => {
    for (const energyMorning of [0, 11, 6.5]) {
      const result = await logJournalEntry({ ...baseEntry, energyMorning });
      expect(result.success).toBe(false);
    }
    expect(mocks.allowedTimeOfDayEnergy).not.toHaveBeenCalled();
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
});
