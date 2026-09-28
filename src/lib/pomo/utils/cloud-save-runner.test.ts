import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CLOUD_SAVE_RETRY_DELAYS_MS,
  createCloudSaveRunner,
  type CloudSaveOutcome,
} from '@/lib/pomo/utils/cloud-save-runner';

const ok = (updatedAt = '2026-09-28T10:00:00.000Z'): CloudSaveOutcome => ({
  success: true,
  updatedAt,
});
const fail = (error = 'Failed to save timer state'): CloudSaveOutcome => ({
  success: false,
  error,
});

const setup = (outcomes: CloudSaveOutcome[], enabled = { value: true }) => {
  const save = vi.fn(async () => outcomes.shift() ?? ok());
  const onSuccess = vi.fn();
  const onError = vi.fn();
  const runner = createCloudSaveRunner({
    save,
    isEnabled: () => enabled.value,
    onSuccess,
    onError,
  });
  return { runner, save, onSuccess, onError };
};

describe('createCloudSaveRunner', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('uses a 2s / 5s / 15s backoff', () => {
    expect(CLOUD_SAVE_RETRY_DELAYS_MS).toEqual([2000, 5000, 15000]);
  });

  it('retries a failed save with backoff and recovers', async () => {
    const { runner, save, onSuccess, onError } = setup([fail(), fail()]);

    await runner.saveNow();
    expect(save).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenLastCalledWith(
      'Failed to save timer state',
      true
    );

    await vi.advanceTimersByTimeAsync(1999);
    expect(save).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(save).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(5000);
    expect(save).toHaveBeenCalledTimes(3);
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it('stops after three retries (no infinite loop)', async () => {
    const { runner, save, onError } = setup(
      Array.from({ length: 10 }, () => fail())
    );

    await runner.saveNow();
    await vi.advanceTimersByTimeAsync(60_000);

    expect(save).toHaveBeenCalledTimes(4);
    expect(onError).toHaveBeenLastCalledWith(
      'Failed to save timer state',
      false
    );

    await vi.advanceTimersByTimeAsync(10 * 60_000);
    expect(save).toHaveBeenCalledTimes(4);
  });

  it('a manual retry resets the budget and saves immediately', async () => {
    const { runner, save, onSuccess } = setup([fail(), fail(), fail(), fail()]);

    await runner.saveNow();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(save).toHaveBeenCalledTimes(4);

    await runner.retryNow();
    expect(save).toHaveBeenCalledTimes(5);
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it('treats a thrown save as a failure', async () => {
    const onError = vi.fn();
    const runner = createCloudSaveRunner({
      save: async () => {
        throw new Error('network');
      },
      isEnabled: () => true,
      onSuccess: vi.fn(),
      onError,
    });

    await runner.saveNow();
    expect(onError).toHaveBeenCalledWith('Save failed', true);
    runner.cancel();
  });

  it('does not overlap saves; a request during a save runs once afterwards', async () => {
    let release: (() => void) | null = null;
    const save = vi.fn(
      () =>
        new Promise<CloudSaveOutcome>((resolve) => {
          release = () => resolve(ok());
        })
    );
    const runner = createCloudSaveRunner({
      save,
      isEnabled: () => true,
      onSuccess: vi.fn(),
      onError: vi.fn(),
    });

    const first = runner.saveNow();
    void runner.saveNow();
    void runner.saveNow();
    expect(save).toHaveBeenCalledTimes(1);

    release!();
    await vi.advanceTimersByTimeAsync(0);
    expect(save).toHaveBeenCalledTimes(2);
    release!();
    await first;
    expect(save).toHaveBeenCalledTimes(2);
  });

  it('does nothing when disabled and drops a scheduled retry once disabled', async () => {
    const enabled = { value: true };
    const { runner, save } = setup([fail(), fail()], enabled);

    await runner.saveNow();
    enabled.value = false;
    await vi.advanceTimersByTimeAsync(60_000);
    expect(save).toHaveBeenCalledTimes(1);

    await runner.saveNow();
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('cancel() drops a scheduled retry', async () => {
    const { runner, save } = setup([fail()]);
    await runner.saveNow();
    runner.cancel();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(save).toHaveBeenCalledTimes(1);
  });
});
