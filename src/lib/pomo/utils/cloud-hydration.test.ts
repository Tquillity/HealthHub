import { describe, expect, it } from 'vitest';
import {
  planCloudHydration,
  type LoadedPomoState,
} from '@/lib/pomo/utils/cloud-hydration';
import { createDefaultPomoStatePayload } from '@/lib/pomo/validation/pomo-state-schema';

const stats = { pomodoro: 3, short: 1, long: 0 };

const withHistory = () => {
  const payload = createDefaultPomoStatePayload();
  payload.timeStore.history = { '2026-09-28': stats };
  payload.timeStore.pomodorosCompleted = 3;
  return payload;
};

const loaded = (overrides: Partial<LoadedPomoState> = {}): LoadedPomoState => ({
  payload: withHistory(),
  source: 'stored',
  migrated: false,
  ...overrides,
});

describe('planCloudHydration', () => {
  it('applies a stored row as-is without writing it back', () => {
    const server = loaded();
    expect(planCloudHydration(server, null)).toEqual({
      payload: server.payload,
      writeBack: false,
      importedLocal: false,
    });
  });

  it('keeps a non-empty stored row over local data and does not write back', () => {
    const server = loaded();
    const plan = planCloudHydration(server, withHistory());
    expect(plan.payload).toBe(server.payload);
    expect(plan.writeBack).toBe(false);
    expect(plan.importedLocal).toBe(false);
  });

  it('writes back a row that was migrated while parsing', () => {
    const server = loaded({ migrated: true });
    const plan = planCloudHydration(server, null);
    expect(plan.payload).toBe(server.payload);
    expect(plan.writeBack).toBe(true);
  });

  it('imports local legacy data into an empty row and writes it back', () => {
    const local = withHistory();
    const plan = planCloudHydration(
      loaded({ payload: createDefaultPomoStatePayload(), source: 'empty' }),
      local
    );
    expect(plan).toEqual({
      payload: local,
      writeBack: true,
      importedLocal: true,
    });
  });

  it('does not write defaults back when there is no row and no local data', () => {
    const server = loaded({
      payload: createDefaultPomoStatePayload(),
      source: 'empty',
    });
    expect(planCloudHydration(server, null)).toEqual({
      payload: server.payload,
      writeBack: false,
      importedLocal: false,
    });
  });
});
