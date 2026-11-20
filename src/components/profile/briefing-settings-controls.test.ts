import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { BriefingSettings } from '@/lib/briefing/data';
import type { BriefingPreferences } from '@/lib/briefing/types';

vi.mock('@/actions/briefing-actions', () => ({ updateBriefingPreferences: vi.fn() }));

import { BriefingSettingsControls } from './briefing-settings-controls';
import {
  createPreferenceSaver,
  SAVE_FAILED,
  type PreferenceSaveResult,
} from './briefing-preference-saver';

const settings = (preferences: Partial<BriefingPreferences> = {}): BriefingSettings => ({
  preferences: {
    frequency: 'daily',
    sources: ['journal', 'cycle', 'meals', 'vitals'],
    detail: 'brief',
    ...preferences,
  },
  timezone: 'Europe/Stockholm',
  nextBriefing: '2026-11-20',
  trackVitals: true,
  cycleTracking: true,
});

const render = (value: BriefingSettings) =>
  renderToStaticMarkup(createElement(BriefingSettingsControls, { settings: value }));

/** Each input with the label that wraps it. */
function labelledInputs(html: string) {
  return [...html.matchAll(/<label([^>]*)>\s*(<input[^>]*>)/g)].map(([, label, input]) => ({
    label,
    input,
  }));
}

describe('BriefingSettingsControls', () => {
  it('makes each 44px row the label of its radio or checkbox', () => {
    const html = render(settings());
    const inputs = html.match(/<input[^>]*>/g) ?? [];
    expect(inputs).toHaveLength(9);
    const rows = labelledInputs(html);
    // Every input sits inside its label, so the whole row toggles it.
    expect(rows).toHaveLength(inputs.length);
    for (const row of rows) {
      expect(row.label).toContain('min-h-[44px]');
      expect(row.label).toContain('items-center');
    }
  });

  it("says the journal source covers the circadian card's check-in for right now", () => {
    const html = render(settings());
    const journal = labelledInputs(html).find((row) =>
      row.input.includes('name="briefing-source-journal"')
    );
    const hintId = journal?.input.match(/aria-describedby="([^"]+)"/)?.[1];
    expect(hintId).toBeTruthy();
    expect(html).toContain(
      `<p id="${hintId}" class="pl-7 text-xs text-gray-500">Mood, energy, sleep and symptoms, compared with your own usual. With circadian insights on, also your energy check-in for right now.</p>`
    );
  });

  it('never disables a choice, and keeps the last source focusable', () => {
    const html = render(settings({ sources: ['journal'] }));
    expect(html).not.toMatch(/<input[^>]*\sdisabled=""/);
    const journal = labelledInputs(html).find((row) =>
      row.input.includes('name="briefing-source-journal"')
    );
    expect(journal?.input).toContain('aria-disabled="true"');
    expect(html).toContain('Keep at least one on, or set the briefing to Never.');
    expect(html).toMatch(/<p role="status" class="sr-only"><\/p>/);
  });
});

function deferred() {
  let resolve!: (value: PreferenceSaveResult) => void;
  const promise = new Promise<PreferenceSaveResult>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

const saved = (preferences: Partial<BriefingPreferences>): PreferenceSaveResult => ({
  success: true,
  data: settings(preferences),
});

describe('createPreferenceSaver', () => {
  const setup = () => {
    const requests: { patch: Partial<BriefingPreferences>; reply: ReturnType<typeof deferred> }[] =
      [];
    const events: string[] = [];
    const saver = createPreferenceSaver({
      send: (patch) => {
        const reply = deferred();
        requests.push({ patch, reply });
        return reply.promise;
      },
      onSaving: (saving) => events.push(saving ? 'saving' : 'idle'),
      onSaved: (value, more) =>
        events.push(`saved:${value.preferences.frequency}${more ? ':more' : ''}`),
      onFailed: (error) => events.push(`failed:${error}`),
    });
    return { saver, requests, events };
  };
  const flush = () => new Promise((r) => setTimeout(r, 0));

  it('merges changes made while a save runs into one next request', async () => {
    const { saver, requests, events } = setup();
    // Arrow keys through the radio group: Daily → Weekly → Never, then a detail change.
    saver.save({ frequency: 'weekly' });
    saver.save({ frequency: 'never' });
    saver.save({ detail: 'detailed' });
    expect(requests.map((r) => r.patch)).toEqual([{ frequency: 'weekly' }]);

    requests[0].reply.resolve(saved({ frequency: 'weekly' }));
    await flush();
    expect(requests.map((r) => r.patch)).toEqual([
      { frequency: 'weekly' },
      { frequency: 'never', detail: 'detailed' },
    ]);
    requests[1].reply.resolve(saved({ frequency: 'never' }));
    await flush();
    // The first result is not shown (a newer change was queued); the last one is.
    expect(events).toEqual(['saving', 'saved:weekly:more', 'saved:never', 'idle']);
  });

  it('drops queued changes when a save fails, and treats a thrown request as a failure', async () => {
    const { saver, requests, events } = setup();
    saver.save({ frequency: 'weekly' });
    saver.save({ frequency: 'never' });
    requests[0].reply.resolve({ success: false, error: 'Nope' });
    await flush();
    expect(requests).toHaveLength(1);
    expect(events).toEqual(['saving', 'idle', 'failed:Nope']);

    const failing = createPreferenceSaver({
      send: () => Promise.reject(new Error('offline')),
      onSaving: () => {},
      onSaved: () => {},
      onFailed: (error) => events.push(`failed:${error}`),
    });
    failing.save({ detail: 'brief' });
    await flush();
    expect(events.at(-1)).toBe(`failed:${SAVE_FAILED}`);
  });
});
