'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  logJournalEntry,
  getJournalEntryByDate,
} from '@/actions/journal-actions';
import { useUIStore } from '@/lib/store';
import { Plus, X } from 'lucide-react';
import { format } from 'date-fns';

interface JournalClientProps {
  initialDate?: string;
  onEntrySaved?: () => void;
  /** Morning, afternoon and evening energy (circadian insights opt-in). */
  showTimeOfDayEnergy?: boolean;
}

const TIME_OF_DAY_ENERGY_FIELDS = [
  { key: 'energyMorning', label: 'Morning', hours: '06-12' },
  { key: 'energyAfternoon', label: 'Afternoon', hours: '12-18' },
  { key: 'energyEvening', label: 'Evening', hours: '18-22' },
] as const;

/** Rating text to the value to send: empty clears it (`null`). */
function ratingOrNull(value: string): number | null {
  return value ? parseInt(value, 10) : null;
}

/**
 * Saving sends cleared fields as null, so the form may only be edited and saved once
 * the chosen day's stored entry has loaded. Otherwise a quick save (or a failed load)
 * would overwrite the stored entry with a blank form.
 */
type LoadState = 'idle' | 'loading' | 'ready' | 'error';

type FormData = ReturnType<typeof emptyForm>;

type StoredEntry = NonNullable<
  Awaited<ReturnType<typeof getJournalEntryByDate>>['data']
>;

function emptyForm(date: string) {
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

function entryToForm(date: string, entry: StoredEntry): FormData {
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

export function JournalClient({
  initialDate,
  onEntrySaved,
  showTimeOfDayEnergy = false,
}: JournalClientProps) {
  const router = useRouter();
  const showToast = useUIStore((state) => state.showToast);
  const [showDialog, setShowDialog] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState(() =>
    emptyForm(initialDate || format(new Date(), 'yyyy-MM-dd'))
  );
  const [loadState, setLoadState] = useState<LoadState>('idle');
  // Only the newest load may fill the form: picking another date while a load is in
  // flight must not let the older response overwrite the form (or its date).
  const latestLoadId = useRef(0);

  const loadExistingEntry = useCallback(async (date: string) => {
    const loadId = ++latestLoadId.current;
    setLoadState('loading');
    let result: Awaited<ReturnType<typeof getJournalEntryByDate>>;
    try {
      result = await getJournalEntryByDate(date);
    } catch {
      result = {
        success: false,
        error: 'Failed to fetch journal entry',
        data: null,
      };
    }
    if (loadId !== latestLoadId.current) return;
    if (!result.success) {
      setLoadState('error');
      return;
    }
    setFormData(result.data ? entryToForm(date, result.data) : emptyForm(date));
    setLoadState('ready');
  }, []);

  useEffect(() => {
    if (initialDate) {
      setFormData(emptyForm(initialDate));
      void loadExistingEntry(initialDate);
    }
  }, [initialDate, loadExistingEntry]);

  const openDialog = () => {
    setShowDialog(true);
    void loadExistingEntry(formData.date);
  };

  const changeDate = (date: string) => {
    setFormData(emptyForm(date));
    if (date) {
      void loadExistingEntry(date);
    } else {
      // No date picked: cancel any load in flight and keep saving off.
      latestLoadId.current++;
      setLoadState('idle');
    }
  };

  const canEdit = loadState === 'ready';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit || isSubmitting) return;
    setIsSubmitting(true);

    // Parse tags (comma-separated)
    const tags = formData.tags
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    // Parse arrays (filter out empty strings)
    const gratitudeEntries = formData.gratitudeEntries.filter(
      (e) => e.trim().length > 0
    );
    const goalsAchieved = formData.goalsAchieved.filter(
      (g) => g.trim().length > 0
    );
    const goalsProgress = formData.goalsProgress.filter(
      (g) => g.trim().length > 0
    );
    const symptomsPhysical = formData.symptomsPhysical.filter(
      (s) => s.trim().length > 0
    );
    const symptomsMental = formData.symptomsMental.filter(
      (s) => s.trim().length > 0
    );

    // Cleared fields are sent as null (not undefined) so the server clears the stored value.
    const result = await logJournalEntry({
      date: formData.date,
      mood: formData.mood ? parseInt(formData.mood, 10) : null,
      energy: formData.energy ? parseInt(formData.energy, 10) : null,
      // Left out (unchanged) unless the fields are shown.
      ...(showTimeOfDayEnergy && {
        energyMorning: ratingOrNull(formData.energyMorning),
        energyAfternoon: ratingOrNull(formData.energyAfternoon),
        energyEvening: ratingOrNull(formData.energyEvening),
      }),
      sleepHours: formData.sleepHours ? parseFloat(formData.sleepHours) : null,
      notes: formData.notes.trim() ? formData.notes : null,
      tags,
      gratitudeEntries,
      gratitudeNotes: formData.gratitudeNotes.trim()
        ? formData.gratitudeNotes
        : null,
      goalsAchieved,
      goalsProgress,
      goalsNotes: formData.goalsNotes.trim() ? formData.goalsNotes : null,
      symptomsPhysical,
      symptomsMental,
      symptomsNotes: formData.symptomsNotes.trim()
        ? formData.symptomsNotes
        : null,
    });

    if (result.success) {
      setShowDialog(false);
      setFormData(emptyForm(format(new Date(), 'yyyy-MM-dd')));
      setLoadState('idle');
      showToast('Journal entry saved successfully!', 'success');
      onEntrySaved?.();
      router.refresh();
    } else {
      showToast(result.error || 'Failed to log entry', 'error');
    }

    setIsSubmitting(false);
  };

  return (
    <>
      <Button onClick={openDialog} className="gap-2">
        <Plus className="h-4 w-4" />
        Log Today
      </Button>

      {showDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">
                Log Journal Entry
              </h2>
              <button
                onClick={() => setShowDialog(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label
                  htmlFor="journal-date"
                  className="block text-sm font-medium text-gray-700 mb-1.5"
                >
                  Date
                </label>
                <Input
                  id="journal-date"
                  name="journal-date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => changeDate(e.target.value)}
                />
                {loadState === 'loading' && (
                  <p role="status" className="mt-1.5 text-sm text-gray-500">
                    Loading this day&apos;s entry...
                  </p>
                )}
                {loadState === 'error' && (
                  <div
                    role="alert"
                    className="mt-1.5 flex items-center justify-between gap-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700"
                  >
                    <span>
                      Couldn&apos;t load this day&apos;s entry, so saving is
                      paused to keep it safe.
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void loadExistingEntry(formData.date)}
                    >
                      Try again
                    </Button>
                  </div>
                )}
              </div>

              {/* Disabled until the day's stored entry has loaded (see LoadState). */}
              <fieldset
                disabled={!canEdit}
                className="m-0 flex min-w-0 flex-col gap-4 border-0 p-0 disabled:opacity-60"
              >
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="journal-mood"
                      className="block text-sm font-medium text-gray-700 mb-1.5"
                    >
                      Mood (1-10)
                    </label>
                    <Input
                      id="journal-mood"
                      name="journal-mood"
                      type="number"
                      min="1"
                      max="10"
                      value={formData.mood}
                      onChange={(e) =>
                        setFormData({ ...formData, mood: e.target.value })
                      }
                      placeholder="1-10"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="journal-energy"
                      className="block text-sm font-medium text-gray-700 mb-1.5"
                    >
                      Energy (1-10)
                    </label>
                    <Input
                      id="journal-energy"
                      name="journal-energy"
                      type="number"
                      min="1"
                      max="10"
                      value={formData.energy}
                      onChange={(e) =>
                        setFormData({ ...formData, energy: e.target.value })
                      }
                      placeholder="1-10"
                    />
                  </div>
                </div>

                {showTimeOfDayEnergy && (
                  <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
                    <legend className="mb-1.5 text-sm font-medium text-gray-700">
                      Energy by time of day (1-10)
                    </legend>
                    <div className="grid grid-cols-3 gap-4">
                      {TIME_OF_DAY_ENERGY_FIELDS.map((field) => (
                        <div key={field.key} className="flex flex-col gap-1.5">
                          <label
                            htmlFor={`journal-${field.key}`}
                            className="text-sm text-gray-700"
                          >
                            {field.label}{' '}
                            <span className="text-xs text-gray-500">
                              ({field.hours})
                            </span>
                          </label>
                          <Input
                            id={`journal-${field.key}`}
                            name={`journal-${field.key}`}
                            type="number"
                            min="1"
                            max="10"
                            value={formData[field.key]}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                [field.key]: e.target.value,
                              })
                            }
                            placeholder="1-10"
                          />
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500">
                      Optional. Rate how you felt in each part of the day to see
                      your own rhythm in Analytics.
                    </p>
                  </fieldset>
                )}

                <div>
                  <label
                    htmlFor="journal-sleep-hours"
                    className="block text-sm font-medium text-gray-700 mb-1.5"
                  >
                    Sleep Hours
                  </label>
                  <Input
                    id="journal-sleep-hours"
                    name="journal-sleep-hours"
                    type="number"
                    min="0"
                    max="24"
                    step="0.5"
                    value={formData.sleepHours}
                    onChange={(e) =>
                      setFormData({ ...formData, sleepHours: e.target.value })
                    }
                    placeholder="e.g., 7.5"
                  />
                </div>

                <div>
                  <label
                    htmlFor="journal-notes"
                    className="block text-sm font-medium text-gray-700 mb-1.5"
                  >
                    Notes
                  </label>
                  <textarea
                    id="journal-notes"
                    name="journal-notes"
                    value={formData.notes}
                    onChange={(e) =>
                      setFormData({ ...formData, notes: e.target.value })
                    }
                    rows={3}
                    className="flex w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
                    placeholder="How are you feeling today?"
                  />
                </div>

                <div>
                  <label
                    htmlFor="journal-tags"
                    className="block text-sm font-medium text-gray-700 mb-1.5"
                  >
                    Tags (comma-separated)
                  </label>
                  <Input
                    id="journal-tags"
                    name="journal-tags"
                    value={formData.tags}
                    onChange={(e) =>
                      setFormData({ ...formData, tags: e.target.value })
                    }
                    placeholder="e.g., workout, productive, stressed"
                  />
                </div>

                {/* Gratitude Section */}
                <div className="border-t pt-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">
                    Gratitude
                  </h3>
                  {formData.gratitudeEntries.map((entry, index) => (
                    <div key={index} className="mb-2 flex gap-2">
                      <label
                        htmlFor={`gratitude-input-${index}`}
                        className="sr-only"
                      >
                        Gratitude entry {index + 1}
                      </label>
                      <Input
                        id={`gratitude-input-${index}`}
                        name={`gratitude-input-${index}`}
                        value={entry}
                        onChange={(e) => {
                          const newEntries = [...formData.gratitudeEntries];
                          newEntries[index] = e.target.value;
                          setFormData({
                            ...formData,
                            gratitudeEntries: newEntries,
                          });
                        }}
                        placeholder={`What are you grateful for? ${index + 1}`}
                        className="flex-1"
                      />
                      {formData.gratitudeEntries.length > 1 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const newEntries = formData.gratitudeEntries.filter(
                              (_, i) => i !== index
                            );
                            setFormData({
                              ...formData,
                              gratitudeEntries:
                                newEntries.length > 0 ? newEntries : [''],
                            });
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setFormData({
                        ...formData,
                        gratitudeEntries: [...formData.gratitudeEntries, ''],
                      })
                    }
                    className="mt-2"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Gratitude
                  </Button>
                  <label htmlFor="journal-gratitude-notes" className="sr-only">
                    Additional gratitude notes
                  </label>
                  <textarea
                    id="journal-gratitude-notes"
                    name="journal-gratitude-notes"
                    value={formData.gratitudeNotes}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        gratitudeNotes: e.target.value,
                      })
                    }
                    rows={2}
                    className="mt-2 flex w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                    placeholder="Additional gratitude notes..."
                  />
                </div>

                {/* Goals Section */}
                <div className="border-t pt-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">
                    Goals
                  </h3>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Achieved Today
                    </label>
                    {formData.goalsAchieved.map((goal, index) => (
                      <div key={index} className="mb-2 flex gap-2">
                        <label
                          htmlFor={`goal-achieved-input-${index}`}
                          className="sr-only"
                        >
                          Goal achieved {index + 1}
                        </label>
                        <Input
                          id={`goal-achieved-input-${index}`}
                          name={`goal-achieved-input-${index}`}
                          value={goal}
                          onChange={(e) => {
                            const newGoals = [...formData.goalsAchieved];
                            newGoals[index] = e.target.value;
                            setFormData({
                              ...formData,
                              goalsAchieved: newGoals,
                            });
                          }}
                          placeholder={`Goal achieved ${index + 1}`}
                          className="flex-1"
                        />
                        {formData.goalsAchieved.length > 1 && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const newGoals = formData.goalsAchieved.filter(
                                (_, i) => i !== index
                              );
                              setFormData({
                                ...formData,
                                goalsAchieved:
                                  newGoals.length > 0 ? newGoals : [''],
                              });
                            }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setFormData({
                          ...formData,
                          goalsAchieved: [...formData.goalsAchieved, ''],
                        })
                      }
                      className="mt-2"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add Achieved Goal
                    </Button>
                  </div>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      In Progress
                    </label>
                    {formData.goalsProgress.map((goal, index) => (
                      <div key={index} className="mb-2 flex gap-2">
                        <label
                          htmlFor={`goal-progress-input-${index}`}
                          className="sr-only"
                        >
                          Goal in progress {index + 1}
                        </label>
                        <Input
                          id={`goal-progress-input-${index}`}
                          name={`goal-progress-input-${index}`}
                          value={goal}
                          onChange={(e) => {
                            const newGoals = [...formData.goalsProgress];
                            newGoals[index] = e.target.value;
                            setFormData({
                              ...formData,
                              goalsProgress: newGoals,
                            });
                          }}
                          placeholder={`Goal in progress ${index + 1}`}
                          className="flex-1"
                        />
                        {formData.goalsProgress.length > 1 && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const newGoals = formData.goalsProgress.filter(
                                (_, i) => i !== index
                              );
                              setFormData({
                                ...formData,
                                goalsProgress:
                                  newGoals.length > 0 ? newGoals : [''],
                              });
                            }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setFormData({
                          ...formData,
                          goalsProgress: [...formData.goalsProgress, ''],
                        })
                      }
                      className="mt-2"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add Progress Goal
                    </Button>
                  </div>
                  <label htmlFor="journal-goals-notes" className="sr-only">
                    Additional goal notes
                  </label>
                  <textarea
                    id="journal-goals-notes"
                    name="journal-goals-notes"
                    value={formData.goalsNotes}
                    onChange={(e) =>
                      setFormData({ ...formData, goalsNotes: e.target.value })
                    }
                    rows={2}
                    className="mt-2 flex w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                    placeholder="Additional goal notes..."
                  />
                </div>

                {/* Symptoms Section */}
                <div className="border-t pt-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">
                    Symptoms
                  </h3>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Physical Symptoms
                    </label>
                    {formData.symptomsPhysical.map((symptom, index) => (
                      <div key={index} className="mb-2 flex gap-2">
                        <label
                          htmlFor={`symptom-physical-input-${index}`}
                          className="sr-only"
                        >
                          Physical symptom {index + 1}
                        </label>
                        <Input
                          id={`symptom-physical-input-${index}`}
                          name={`symptom-physical-input-${index}`}
                          value={symptom}
                          onChange={(e) => {
                            const newSymptoms = [...formData.symptomsPhysical];
                            newSymptoms[index] = e.target.value;
                            setFormData({
                              ...formData,
                              symptomsPhysical: newSymptoms,
                            });
                          }}
                          placeholder={`Physical symptom ${index + 1}`}
                          className="flex-1"
                        />
                        {formData.symptomsPhysical.length > 1 && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const newSymptoms =
                                formData.symptomsPhysical.filter(
                                  (_, i) => i !== index
                                );
                              setFormData({
                                ...formData,
                                symptomsPhysical:
                                  newSymptoms.length > 0 ? newSymptoms : [''],
                              });
                            }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setFormData({
                          ...formData,
                          symptomsPhysical: [...formData.symptomsPhysical, ''],
                        })
                      }
                      className="mt-2"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add Physical Symptom
                    </Button>
                  </div>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Mental Symptoms
                    </label>
                    {formData.symptomsMental.map((symptom, index) => (
                      <div key={index} className="mb-2 flex gap-2">
                        <label
                          htmlFor={`symptom-mental-input-${index}`}
                          className="sr-only"
                        >
                          Mental symptom {index + 1}
                        </label>
                        <Input
                          id={`symptom-mental-input-${index}`}
                          name={`symptom-mental-input-${index}`}
                          value={symptom}
                          onChange={(e) => {
                            const newSymptoms = [...formData.symptomsMental];
                            newSymptoms[index] = e.target.value;
                            setFormData({
                              ...formData,
                              symptomsMental: newSymptoms,
                            });
                          }}
                          placeholder={`Mental symptom ${index + 1}`}
                          className="flex-1"
                        />
                        {formData.symptomsMental.length > 1 && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const newSymptoms =
                                formData.symptomsMental.filter(
                                  (_, i) => i !== index
                                );
                              setFormData({
                                ...formData,
                                symptomsMental:
                                  newSymptoms.length > 0 ? newSymptoms : [''],
                              });
                            }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setFormData({
                          ...formData,
                          symptomsMental: [...formData.symptomsMental, ''],
                        })
                      }
                      className="mt-2"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add Mental Symptom
                    </Button>
                  </div>
                  <label htmlFor="journal-symptoms-notes" className="sr-only">
                    Additional symptom notes
                  </label>
                  <textarea
                    id="journal-symptoms-notes"
                    name="journal-symptoms-notes"
                    value={formData.symptomsNotes}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        symptomsNotes: e.target.value,
                      })
                    }
                    rows={2}
                    className="mt-2 flex w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                    placeholder="Additional symptom notes..."
                  />
                </div>
              </fieldset>

              <div className="flex gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowDialog(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting || !canEdit}
                  className="flex-1"
                >
                  {isSubmitting
                    ? 'Saving...'
                    : loadState === 'loading'
                      ? 'Loading...'
                      : 'Save Entry'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
