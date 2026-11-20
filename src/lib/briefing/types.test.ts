import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BRIEFING_PREFERENCES,
  isSuggestionKey,
  parseBriefingPreferences,
} from './types';

describe('parseBriefingPreferences', () => {
  it('reads stored preferences in canonical source order', () => {
    expect(
      parseBriefingPreferences({
        briefingFrequency: 'weekly',
        briefingSources: ['vitals', 'journal'],
        briefingDetail: 'detailed',
      })
    ).toEqual({
      frequency: 'weekly',
      sources: ['journal', 'vitals'],
      detail: 'detailed',
    });
  });

  it('falls back to the defaults for unknown values', () => {
    expect(
      parseBriefingPreferences({
        briefingFrequency: 'hourly',
        briefingSources: ['journal', 'location'],
        briefingDetail: 'verbose',
      })
    ).toEqual({
      frequency: DEFAULT_BRIEFING_PREFERENCES.frequency,
      sources: ['journal'],
      detail: DEFAULT_BRIEFING_PREFERENCES.detail,
    });
  });
});

describe('isSuggestionKey', () => {
  it('accepts only known keys', () => {
    expect(isSuggestionKey('meal.iron')).toBe(true);
    expect(isSuggestionKey('briefing')).toBe(false);
    expect(isSuggestionKey('meal.anything')).toBe(false);
  });
});
