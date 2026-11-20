import { isEmptyPomoPayload } from '@/lib/pomo/utils/pomo-server-progress';
import type { PomoStatePayload } from '@/lib/pomo/validation/pomo-state-schema';

/** What `getPomoState` returns for a premium user. */
export type LoadedPomoState = {
  payload: PomoStatePayload;
  /** `empty`: no row exists yet (defaults). `stored`: parsed from the user's row. */
  source: 'empty' | 'stored';
  /** True when legacy data was dropped while parsing, so the row should be rewritten. */
  migrated: boolean;
};

export type CloudHydrationPlan = {
  /** Payload to apply to the local stores. */
  payload: PomoStatePayload;
  /** Whether the applied payload differs from the server row and must be saved back. */
  writeBack: boolean;
  /** Whether pre-upgrade local data was imported into an empty cloud row. */
  importedLocal: boolean;
};

/**
 * Decide what to apply after loading cloud state, and whether it must be written back.
 * A payload used exactly as loaded is not saved again; only local data imported into an
 * empty row, or a row migrated while parsing, is written back.
 */
export function planCloudHydration(
  loaded: LoadedPomoState,
  localPayload: PomoStatePayload | null
): CloudHydrationPlan {
  if (localPayload && isEmptyPomoPayload(loaded.payload)) {
    return { payload: localPayload, writeBack: true, importedLocal: true };
  }
  return {
    payload: loaded.payload,
    writeBack: loaded.migrated,
    importedLocal: false,
  };
}
