import type {
  getJournalEntryByDate,
  logJournalEntry,
} from '@/actions/journal-actions';
import { changedTimeOfDayEnergy } from './time-of-day-energy-fields';

/**
 * The journal form's values, the snapshot they are compared with on save, and what a save
 * sends. Pure, so journal-form.test.ts covers it; journal-client.tsx only wires it up.
 */

export type JournalForm = ReturnType<typeof emptyJournalForm>;

/** The stored entry fields the form shows (from `getJournalEntryByDate`, decrypted). */
export type StoredJournalEntry = Pick<
  NonNullable<Awaited<ReturnType<typeof getJournalEntryByDate>>['data']>,
  | 'mood'
  | 'energy'
  | 'energyMorning'
  | 'energyAfternoon'
  | 'energyEvening'
  | 'sleepHours'
  | 'notes'
  | 'tags'
  | 'gratitudeEntries'
  | 'gratitudeNotes'
  | 'goalsAchieved'
  | 'goalsProgress'
  | 'goalsNotes'
  | 'symptomsPhysical'
  | 'symptomsMental'
  | 'symptomsNotes'
>;

export type JournalSaveInput = Parameters<typeof logJournalEntry>[0];

/**
 * The form and a snapshot of it as the day's entry loaded. A save sends only the
 * time-of-day ratings that differ from the snapshot, so the snapshot is replaced together
 * with the form whenever a day loads or the form is reset.
 */
export type JournalFormState = { form: JournalForm; loaded: JournalForm };

export function emptyJournalForm(date: string) {
  return {
    date,
    mood: '',
    energy: '',
    energyMorning: '',
    energyAfternoon: '',
    energyEvening: '',
    sleepHours: '',
    notes: '',
    tags: '',
    gratitudeEntries: [''],
    gratitudeNotes: '',
    goalsAchieved: [''],
    goalsProgress: [''],
    goalsNotes: '',
    symptomsPhysical: [''],
    symptomsMental: [''],
    symptomsNotes: '',
  };
}

function listOrBlank(values: string[] | null | undefined): string[] {
  return values && values.length > 0 ? values : [''];
}

function entryToForm(date: string, entry: StoredJournalEntry): JournalForm {
  return {
    date,
    mood: entry.mood?.toString() || '',
    energy: entry.energy?.toString() || '',
    energyMorning: entry.energyMorning?.toString() || '',
    energyAfternoon: entry.energyAfternoon?.toString() || '',
    energyEvening: entry.energyEvening?.toString() || '',
    sleepHours: entry.sleepHours?.toString() || '',
    notes: entry.notes || '',
    tags: entry.tags.join(', ') || '',
    gratitudeEntries: listOrBlank(entry.gratitudeEntries),
    gratitudeNotes: entry.gratitudeNotes || '',
    goalsAchieved: listOrBlank(entry.goalsAchieved),
    goalsProgress: listOrBlank(entry.goalsProgress),
    goalsNotes: entry.goalsNotes || '',
    symptomsPhysical: listOrBlank(entry.symptomsPhysical),
    symptomsMental: listOrBlank(entry.symptomsMental),
    symptomsNotes: entry.symptomsNotes || '',
  };
}

/** A blank form for `date`, which is also its snapshot (a new day, or after a save). */
export function blankJournalForm(date: string): JournalFormState {
  const form = emptyJournalForm(date);
  return { form, loaded: form };
}

/** The day's stored entry (or none) has loaded: the form shows it, as its new snapshot. */
export function loadedJournalForm(
  date: string,
  entry: StoredJournalEntry | null
): JournalFormState {
  const form = entry ? entryToForm(date, entry) : emptyJournalForm(date);
  return { form, loaded: form };
}

function filled(values: string[]): string[] {
  return values.filter((value) => value.trim().length > 0);
}

/**
 * What saving the form sends. Cleared fields are sent as null (not undefined) so the
 * server clears the stored value. The time-of-day ratings are sent only while their fields
 * are shown, and only the ones edited since the day loaded (`changedTimeOfDayEnergy`):
 * the dashboard check-in writes them too, so one made while the form was open is kept.
 */
export function journalSavePayload(
  { form, loaded }: JournalFormState,
  showTimeOfDayEnergy: boolean
): JournalSaveInput {
  return {
    date: form.date,
    mood: form.mood ? parseInt(form.mood, 10) : null,
    energy: form.energy ? parseInt(form.energy, 10) : null,
    ...(showTimeOfDayEnergy && changedTimeOfDayEnergy(loaded, form)),
    sleepHours: form.sleepHours ? parseFloat(form.sleepHours) : null,
    notes: form.notes.trim() ? form.notes : null,
    // Comma-separated
    tags: form.tags
      .split(',')
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0),
    gratitudeEntries: filled(form.gratitudeEntries),
    gratitudeNotes: form.gratitudeNotes.trim() ? form.gratitudeNotes : null,
    goalsAchieved: filled(form.goalsAchieved),
    goalsProgress: filled(form.goalsProgress),
    goalsNotes: form.goalsNotes.trim() ? form.goalsNotes : null,
    symptomsPhysical: filled(form.symptomsPhysical),
    symptomsMental: filled(form.symptomsMental),
    symptomsNotes: form.symptomsNotes.trim() ? form.symptomsNotes : null,
  };
}
