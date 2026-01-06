'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { logJournalEntry, getJournalEntryByDate } from '@/actions/journal-actions';
import { Plus, X } from 'lucide-react';
import { format } from 'date-fns';

interface JournalClientProps {
  initialDate?: string;
  onEntrySaved?: () => void;
}

export function JournalClient({ initialDate, onEntrySaved }: JournalClientProps) {
  const router = useRouter();
  const [showDialog, setShowDialog] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    date: initialDate || format(new Date(), 'yyyy-MM-dd'),
    mood: '',
    energy: '',
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
  });

  useEffect(() => {
    if (initialDate) {
      setFormData((prev) => ({ ...prev, date: initialDate }));
      loadExistingEntry(initialDate);
    }
  }, [initialDate]);

  const loadExistingEntry = async (date: string) => {
    const result = await getJournalEntryByDate(date);
    if (result.success && result.data) {
      setFormData({
        date,
        mood: result.data.mood?.toString() || '',
        energy: result.data.energy?.toString() || '',
        sleepHours: result.data.sleepHours?.toString() || '',
        notes: result.data.notes || '',
        tags: result.data.tags.join(', ') || '',
        gratitudeEntries: result.data.gratitudeEntries?.length > 0 ? result.data.gratitudeEntries : [''],
        gratitudeNotes: result.data.gratitudeNotes || '',
        goalsAchieved: result.data.goalsAchieved?.length > 0 ? result.data.goalsAchieved : [''],
        goalsProgress: result.data.goalsProgress?.length > 0 ? result.data.goalsProgress : [''],
        goalsNotes: result.data.goalsNotes || '',
        symptomsPhysical: result.data.symptomsPhysical?.length > 0 ? result.data.symptomsPhysical : [''],
        symptomsMental: result.data.symptomsMental?.length > 0 ? result.data.symptomsMental : [''],
        symptomsNotes: result.data.symptomsNotes || '',
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Parse tags (comma-separated)
    const tags = formData.tags
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    // Parse arrays (filter out empty strings)
    const gratitudeEntries = formData.gratitudeEntries.filter((e) => e.trim().length > 0);
    const goalsAchieved = formData.goalsAchieved.filter((g) => g.trim().length > 0);
    const goalsProgress = formData.goalsProgress.filter((g) => g.trim().length > 0);
    const symptomsPhysical = formData.symptomsPhysical.filter((s) => s.trim().length > 0);
    const symptomsMental = formData.symptomsMental.filter((s) => s.trim().length > 0);

    const result = await logJournalEntry({
      date: formData.date,
      mood: formData.mood ? parseInt(formData.mood) : undefined,
      energy: formData.energy ? parseInt(formData.energy) : undefined,
      sleepHours: formData.sleepHours ? parseFloat(formData.sleepHours) : undefined,
      notes: formData.notes || undefined,
      tags,
      gratitudeEntries,
      gratitudeNotes: formData.gratitudeNotes || undefined,
      goalsAchieved,
      goalsProgress,
      goalsNotes: formData.goalsNotes || undefined,
      symptomsPhysical,
      symptomsMental,
      symptomsNotes: formData.symptomsNotes || undefined,
    });

    if (result.success) {
      setShowDialog(false);
      setFormData({
        date: format(new Date(), 'yyyy-MM-dd'),
        mood: '',
        energy: '',
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
      });
      onEntrySaved?.();
      router.refresh();
    } else {
      alert(result.error || 'Failed to log entry');
    }

    setIsSubmitting(false);
  };

  return (
    <>
      <Button onClick={() => setShowDialog(true)} className="gap-2">
        <Plus className="h-4 w-4" />
        Log Today
      </Button>

      {showDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Log Journal Entry</h2>
              <button
                onClick={() => setShowDialog(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label htmlFor="journal-date" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Date
                </label>
                <Input
                  id="journal-date"
                  name="journal-date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="journal-mood" className="block text-sm font-medium text-gray-700 mb-1.5">
                    Mood (1-10)
                  </label>
                  <Input
                    id="journal-mood"
                    name="journal-mood"
                    type="number"
                    min="1"
                    max="10"
                    value={formData.mood}
                    onChange={(e) => setFormData({ ...formData, mood: e.target.value })}
                    placeholder="1-10"
                  />
                </div>

                <div>
                  <label htmlFor="journal-energy" className="block text-sm font-medium text-gray-700 mb-1.5">
                    Energy (1-10)
                  </label>
                  <Input
                    id="journal-energy"
                    name="journal-energy"
                    type="number"
                    min="1"
                    max="10"
                    value={formData.energy}
                    onChange={(e) => setFormData({ ...formData, energy: e.target.value })}
                    placeholder="1-10"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="journal-sleep-hours" className="block text-sm font-medium text-gray-700 mb-1.5">
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
                <label htmlFor="journal-notes" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Notes
                </label>
                <textarea
                  id="journal-notes"
                  name="journal-notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  className="flex w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
                  placeholder="How are you feeling today?"
                />
              </div>

              <div>
                <label htmlFor="journal-tags" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Tags (comma-separated)
                </label>
                <Input
                  id="journal-tags"
                  name="journal-tags"
                  value={formData.tags}
                  onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                  placeholder="e.g., workout, productive, stressed"
                />
              </div>

              {/* Gratitude Section */}
              <div className="border-t pt-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Gratitude</h3>
                {formData.gratitudeEntries.map((entry, index) => (
                  <div key={index} className="mb-2 flex gap-2">
                    <label htmlFor={`gratitude-input-${index}`} className="sr-only">
                      Gratitude entry {index + 1}
                    </label>
                    <Input
                      id={`gratitude-input-${index}`}
                      name={`gratitude-input-${index}`}
                      value={entry}
                      onChange={(e) => {
                        const newEntries = [...formData.gratitudeEntries];
                        newEntries[index] = e.target.value;
                        setFormData({ ...formData, gratitudeEntries: newEntries });
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
                          const newEntries = formData.gratitudeEntries.filter((_, i) => i !== index);
                          setFormData({ ...formData, gratitudeEntries: newEntries.length > 0 ? newEntries : [''] });
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
                  onClick={() => setFormData({ ...formData, gratitudeEntries: [...formData.gratitudeEntries, ''] })}
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
                  onChange={(e) => setFormData({ ...formData, gratitudeNotes: e.target.value })}
                  rows={2}
                  className="mt-2 flex w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                  placeholder="Additional gratitude notes..."
                />
              </div>

              {/* Goals Section */}
              <div className="border-t pt-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Goals</h3>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Achieved Today</label>
                  {formData.goalsAchieved.map((goal, index) => (
                    <div key={index} className="mb-2 flex gap-2">
                      <label htmlFor={`goal-achieved-input-${index}`} className="sr-only">
                        Goal achieved {index + 1}
                      </label>
                      <Input
                        id={`goal-achieved-input-${index}`}
                        name={`goal-achieved-input-${index}`}
                        value={goal}
                        onChange={(e) => {
                          const newGoals = [...formData.goalsAchieved];
                          newGoals[index] = e.target.value;
                          setFormData({ ...formData, goalsAchieved: newGoals });
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
                            const newGoals = formData.goalsAchieved.filter((_, i) => i !== index);
                            setFormData({ ...formData, goalsAchieved: newGoals.length > 0 ? newGoals : [''] });
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
                    onClick={() => setFormData({ ...formData, goalsAchieved: [...formData.goalsAchieved, ''] })}
                    className="mt-2"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Achieved Goal
                  </Button>
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">In Progress</label>
                  {formData.goalsProgress.map((goal, index) => (
                    <div key={index} className="mb-2 flex gap-2">
                      <label htmlFor={`goal-progress-input-${index}`} className="sr-only">
                        Goal in progress {index + 1}
                      </label>
                      <Input
                        id={`goal-progress-input-${index}`}
                        name={`goal-progress-input-${index}`}
                        value={goal}
                        onChange={(e) => {
                          const newGoals = [...formData.goalsProgress];
                          newGoals[index] = e.target.value;
                          setFormData({ ...formData, goalsProgress: newGoals });
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
                            const newGoals = formData.goalsProgress.filter((_, i) => i !== index);
                            setFormData({ ...formData, goalsProgress: newGoals.length > 0 ? newGoals : [''] });
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
                    onClick={() => setFormData({ ...formData, goalsProgress: [...formData.goalsProgress, ''] })}
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
                  onChange={(e) => setFormData({ ...formData, goalsNotes: e.target.value })}
                  rows={2}
                  className="mt-2 flex w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                  placeholder="Additional goal notes..."
                />
              </div>

              {/* Symptoms Section */}
              <div className="border-t pt-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Symptoms</h3>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Physical Symptoms</label>
                  {formData.symptomsPhysical.map((symptom, index) => (
                    <div key={index} className="mb-2 flex gap-2">
                      <label htmlFor={`symptom-physical-input-${index}`} className="sr-only">
                        Physical symptom {index + 1}
                      </label>
                      <Input
                        id={`symptom-physical-input-${index}`}
                        name={`symptom-physical-input-${index}`}
                        value={symptom}
                        onChange={(e) => {
                          const newSymptoms = [...formData.symptomsPhysical];
                          newSymptoms[index] = e.target.value;
                          setFormData({ ...formData, symptomsPhysical: newSymptoms });
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
                            const newSymptoms = formData.symptomsPhysical.filter((_, i) => i !== index);
                            setFormData({ ...formData, symptomsPhysical: newSymptoms.length > 0 ? newSymptoms : [''] });
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
                    onClick={() => setFormData({ ...formData, symptomsPhysical: [...formData.symptomsPhysical, ''] })}
                    className="mt-2"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Physical Symptom
                  </Button>
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Mental Symptoms</label>
                  {formData.symptomsMental.map((symptom, index) => (
                    <div key={index} className="mb-2 flex gap-2">
                      <label htmlFor={`symptom-mental-input-${index}`} className="sr-only">
                        Mental symptom {index + 1}
                      </label>
                      <Input
                        id={`symptom-mental-input-${index}`}
                        name={`symptom-mental-input-${index}`}
                        value={symptom}
                        onChange={(e) => {
                          const newSymptoms = [...formData.symptomsMental];
                          newSymptoms[index] = e.target.value;
                          setFormData({ ...formData, symptomsMental: newSymptoms });
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
                            const newSymptoms = formData.symptomsMental.filter((_, i) => i !== index);
                            setFormData({ ...formData, symptomsMental: newSymptoms.length > 0 ? newSymptoms : [''] });
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
                    onClick={() => setFormData({ ...formData, symptomsMental: [...formData.symptomsMental, ''] })}
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
                  onChange={(e) => setFormData({ ...formData, symptomsNotes: e.target.value })}
                  rows={2}
                  className="mt-2 flex w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                  placeholder="Additional symptom notes..."
                />
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowDialog(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting} className="flex-1">
                  {isSubmitting ? 'Saving...' : 'Save Entry'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

