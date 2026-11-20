import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  blankJournalForm,
  journalSavePayload,
  loadedJournalForm,
  type JournalFormState,
  type StoredJournalEntry,
} from './journal-form';

const DAY = '2026-11-20';

function stored(values: Partial<StoredJournalEntry> = {}): StoredJournalEntry {
  return {
    mood: null,
    energy: null,
    energyMorning: null,
    energyAfternoon: null,
    energyEvening: null,
    sleepHours: null,
    notes: null,
    tags: [],
    gratitudeEntries: [],
    gratitudeNotes: null,
    goalsAchieved: [],
    goalsProgress: [],
    goalsNotes: null,
    symptomsPhysical: [],
    symptomsMental: [],
    symptomsNotes: null,
    ...values,
  };
}

/** An edit in the form: the snapshot stays as the day loaded. */
function edit(
  state: JournalFormState,
  values: Partial<JournalFormState['form']>
): JournalFormState {
  return { ...state, form: { ...state.form, ...values } };
}

const TIME_OF_DAY = ['energyMorning', 'energyAfternoon', 'energyEvening'];

function timeOfDayIn(payload: object): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(payload).filter(([key]) => TIME_OF_DAY.includes(key))
  );
}

describe('journalSavePayload', () => {
  // The day loaded with a morning and an afternoon check-in (made on the dashboard).
  const loaded = loadedJournalForm(
    DAY,
    stored({ mood: 6, energyMorning: 6, energyAfternoon: 7 })
  );

  it('does not send a time-of-day rating that was filled when the form loaded and left as it was', () => {
    const payload = journalSavePayload(edit(loaded, { mood: '8' }), true);
    expect(payload.mood).toBe(8);
    // Not even the loaded value: a newer dashboard check-in must be kept.
    expect(timeOfDayIn(payload)).toEqual({});
  });

  it('sends an edited rating, and a cleared one as null', () => {
    expect(
      timeOfDayIn(
        journalSavePayload(
          edit(loaded, { energyAfternoon: '3', energyEvening: '5' }),
          true
        )
      )
    ).toEqual({ energyAfternoon: 3, energyEvening: 5 });
    expect(
      timeOfDayIn(journalSavePayload(edit(loaded, { energyMorning: '' }), true))
    ).toEqual({ energyMorning: null });
  });

  it('sends no time-of-day rating while the fields are hidden', () => {
    expect(
      timeOfDayIn(
        journalSavePayload(
          edit(loaded, { energyMorning: '', energyEvening: '5' }),
          false
        )
      )
    ).toEqual({});
  });

  it('compares with the day that loaded last, and with a blank form after a save', () => {
    // Another day loads: its own ratings are the snapshot now.
    const other = loadedJournalForm(
      '2026-11-19',
      stored({ energyAfternoon: 3, energyEvening: 4 })
    );
    expect(other.loaded).toEqual(other.form);
    expect(other.form.energyAfternoon).toBe('3');
    expect(timeOfDayIn(journalSavePayload(other, true))).toEqual({});
    expect(
      timeOfDayIn(
        journalSavePayload(edit(other, { energyAfternoon: '' }), true)
      )
    ).toEqual({ energyAfternoon: null });

    // A day without an entry, and the blank form after a save.
    for (const state of [loadedJournalForm(DAY, null), blankJournalForm(DAY)]) {
      expect(state.loaded).toEqual(state.form);
      expect(timeOfDayIn(journalSavePayload(state, true))).toEqual({});
      expect(
        timeOfDayIn(
          journalSavePayload(edit(state, { energyMorning: '6' }), true)
        )
      ).toEqual({ energyMorning: 6 });
    }
  });

  it('sends cleared fields as null and leaves out blank list items', () => {
    const state = loadedJournalForm(
      DAY,
      stored({
        mood: 5,
        sleepHours: 7.5,
        notes: 'Slept well',
        tags: ['rest', 'walk'],
        gratitudeEntries: ['Sun'],
      })
    );
    expect(state.form).toMatchObject({
      mood: '5',
      sleepHours: '7.5',
      tags: 'rest, walk',
      gratitudeEntries: ['Sun'],
      goalsAchieved: [''],
    });
    expect(journalSavePayload(state, false)).toEqual({
      date: DAY,
      mood: 5,
      energy: null,
      sleepHours: 7.5,
      notes: 'Slept well',
      tags: ['rest', 'walk'],
      gratitudeEntries: ['Sun'],
      gratitudeNotes: null,
      goalsAchieved: [],
      goalsProgress: [],
      goalsNotes: null,
      symptomsPhysical: [],
      symptomsMental: [],
      symptomsNotes: null,
    });
    expect(
      journalSavePayload(
        edit(state, {
          mood: '',
          notes: '  ',
          tags: ' rest, ,yoga ',
          gratitudeEntries: ['Sun', ' '],
        }),
        false
      )
    ).toMatchObject({
      mood: null,
      notes: null,
      tags: ['rest', 'yoga'],
      gratitudeEntries: ['Sun'],
    });
  });
});

describe('journal-client wiring', () => {
  // The unit tests run without a DOM, so check the few lines that connect the form to
  // these helpers: a load or a reset replaces the form and its snapshot together, and a
  // save is built from both.
  const source = readFileSync(
    path.join(__dirname, 'journal-client.tsx'),
    'utf8'
  );

  it('refreshes the snapshot on every load and reset, and saves from it', () => {
    expect(source).toContain(
      'setFormState(loadedJournalForm(date, result.data));'
    );
    expect(source).toContain(
      "setFormState(blankJournalForm(format(new Date(), 'yyyy-MM-dd')));"
    );
    expect(source).toContain(
      'journalSavePayload(formState, showTimeOfDayEnergy)'
    );
    // Only those helpers set the snapshot; edits change the form alone.
    expect(source).not.toMatch(/loaded\s*:/);
    expect(source).toContain('setFormState((state) => ({ ...state, form }))');
  });
});
