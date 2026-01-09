'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { parseAsString, useQueryState } from 'nuqs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createRoutine, updateRoutine, drawLottery } from '@/actions/routine-actions';
import { useUIStore } from '@/lib/store';
import { Plus, Sparkles, X } from 'lucide-react';
import type { Routine } from '@prisma/client';
import { RoutineCard } from './routine-card';
import { RoutinesGrid } from './routines-grid';
import { RoutineRichForm } from './routine-rich-form';

interface RoutinesClientProps {
  routines: Routine[];
}

export function RoutinesClient({ routines: initialRoutines }: RoutinesClientProps) {
  const router = useRouter();
  const showToast = useUIStore((state) => state.showToast);
  const [routines, setRoutines] = useState(initialRoutines);

  // Get filter params from URL
  const [query] = useQueryState('q', parseAsString.withDefault(''));
  const [category] = useQueryState('category', parseAsString);
  const [energyLevel] = useQueryState('energy', parseAsString);
  const [context] = useQueryState('context', parseAsString);
  const [difficulty] = useQueryState('difficulty', parseAsString);
  const [duration] = useQueryState('duration', parseAsString);

  // Filter routines client-side
  const filteredRoutines = useMemo(() => {
    return routines.filter((routine) => {
      if (query && !routine.name.toLowerCase().includes(query.toLowerCase()) && 
          !routine.description?.toLowerCase().includes(query.toLowerCase())) {
        return false;
      }
      if (category && routine.category !== category) return false;
      if (energyLevel && routine.energyLevel !== energyLevel) return false;
      if (context && routine.context !== context) return false;
      if (difficulty && routine.difficulty !== difficulty) return false;
      if (duration && routine.duration !== duration) return false;
      return true;
    });
  }, [routines, query, category, energyLevel, context, difficulty, duration]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showLotteryDialog, setShowLotteryDialog] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lotteryResult, setLotteryResult] = useState<Routine | null>(null);
  const [lotteryResults, setLotteryResults] = useState<Routine[]>([]);
  const [lotterySpinning, setLotterySpinning] = useState(false);
  const [lotteryEnergy, setLotteryEnergy] = useState<'low' | 'medium' | 'high'>('medium');
  const [lotteryMaxTime, setLotteryMaxTime] = useState(30);
  const [lotteryCount, setLotteryCount] = useState(1);
  const [lotteryContext, setLotteryContext] = useState<string>('');
  const [lotteryDuration, setLotteryDuration] = useState<string>('');
  const [lotteryDifficulty, setLotteryDifficulty] = useState<string>('');
  const [editingRoutine, setEditingRoutine] = useState<Routine | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: '',
    frequency: '',
    energyLevel: 'medium' as 'low' | 'medium' | 'high',
    estimatedTime: 15,
  });

  const handleCreateRoutine = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const result = editingRoutine
      ? await updateRoutine({ id: editingRoutine.id, ...formData })
      : await createRoutine(formData);

    if (result.success && result.data) {
      if (editingRoutine) {
        setRoutines(routines.map((r) => (r.id === editingRoutine.id ? result.data! : r)));
      } else {
        setRoutines([result.data, ...routines]);
      }
      setShowCreateDialog(false);
      setEditingRoutine(null);
      setFormData({
        name: '',
        description: '',
        category: '',
        frequency: '',
        energyLevel: 'medium',
        estimatedTime: 15,
      });
      showToast(editingRoutine ? 'Routine updated successfully!' : 'Routine created successfully!', 'success');
      router.refresh();
    } else {
      showToast(result.error || 'Failed to save routine', 'error');
    }

    setIsSubmitting(false);
  };

  const handleDrawLottery = async () => {
    setLotterySpinning(true);
    setLotteryResult(null);

    // Simulate spinning animation
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const result = await drawLottery({
      energy: lotteryEnergy,
      maxTime: lotteryMaxTime,
      count: lotteryCount,
      context: lotteryContext || undefined,
      duration: lotteryDuration || undefined,
      difficulty: lotteryDifficulty || undefined,
    });

    if (result.success && result.data) {
      if (Array.isArray(result.data) && result.data.length > 0) {
        setLotteryResult(result.data[0]); // Show first result
        if (result.data.length > 1) {
          // Store all results for display
          setLotteryResults(result.data);
        }
      } else {
        alert('No routines match your criteria. Try adjusting filters.');
      }
    } else if (result.success && (!result.data || (Array.isArray(result.data) && result.data.length === 0))) {
      alert('No routines match your criteria. Try adjusting filters.');
    } else {
      alert(result.error || 'Failed to draw lottery');
    }

    setLotterySpinning(false);
  };

  return (
    <>
      <div className="mb-6 flex gap-2">
        <Button
          variant="outline"
          onClick={() => setShowLotteryDialog(true)}
          className="gap-2"
        >
          <Sparkles className="h-4 w-4" />
          Spin the Wheel
        </Button>
        <Button onClick={() => setShowCreateDialog(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Add Routine
        </Button>
      </div>

      {filteredRoutines.length > 0 ? (
        <RoutinesGrid routines={filteredRoutines} />
      ) : (
        <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-12 text-center">
          <Sparkles className="mx-auto h-12 w-12 text-gray-300" />
          <h3 className="mt-4 text-lg font-medium text-gray-900">No routines found</h3>
          <p className="mt-2 text-sm text-gray-500">
            Try adjusting your filters or create a new routine.
          </p>
        </div>
      )}

      {/* Create/Edit Routine Dialog */}
      {showCreateDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-4xl max-h-[90vh] rounded-lg bg-white shadow-xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">
                {editingRoutine ? 'Edit Routine' : 'Create Routine'}
              </h2>
              <button
                onClick={() => {
                  setShowCreateDialog(false);
                  setEditingRoutine(null);
                  setFormData({
                    name: '',
                    description: '',
                    category: '',
                    frequency: '',
                    energyLevel: 'medium',
                    estimatedTime: 15,
                  });
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1">
              <RoutineRichForm
                routine={editingRoutine || undefined}
                onSuccess={() => {
                  setShowCreateDialog(false);
                  setEditingRoutine(null);
                  router.refresh();
                }}
                onCancel={() => {
                  setShowCreateDialog(false);
                  setEditingRoutine(null);
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Old Simple Form (kept for reference, but replaced by RoutineRichForm) */}
      {false && showCreateDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">
                {editingRoutine ? 'Edit Routine' : 'Create Routine'}
              </h2>
              <button
                onClick={() => {
                  setShowCreateDialog(false);
                  setEditingRoutine(null);
                  setFormData({
                    name: '',
                    description: '',
                    category: '',
                    frequency: '',
                    energyLevel: 'medium',
                    estimatedTime: 15,
                  });
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateRoutine} className="flex flex-col gap-4">
              <div>
                <label htmlFor="routine-create-name" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Name *
                </label>
                <Input
                  id="routine-create-name"
                  name="routine-create-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div>
                <label htmlFor="routine-create-description" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Description
                </label>
                <Input
                  id="routine-create-description"
                  name="routine-create-description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Category
                  </label>
                  <Input
                    value={formData.category}
                    onChange={(e) =>
                      setFormData({ ...formData, category: e.target.value })
                    }
                    placeholder="e.g., wellness"
                    className="mt-1"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Frequency
                  </label>
                  <Input
                    value={formData.frequency}
                    onChange={(e) =>
                      setFormData({ ...formData, frequency: e.target.value })
                    }
                    placeholder="e.g., daily"
                    className="mt-1"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Energy Level
                </label>
                <select
                  value={formData.energyLevel}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      energyLevel: e.target.value as 'low' | 'medium' | 'high',
                    })
                  }
                  className="mt-1 flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Estimated Time (minutes)
                </label>
                <Input
                  type="number"
                  min="1"
                  value={formData.estimatedTime}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      estimatedTime: parseInt(e.target.value) || 15,
                    })
                  }
                  className="mt-1"
                />
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreateDialog(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting} className="flex-1">
                  {isSubmitting ? 'Creating...' : 'Create'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Lottery Dialog */}
      {showLotteryDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Todo Lottery</h2>
              <button
                onClick={() => {
                  setShowLotteryDialog(false);
                  setLotteryResult(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Your Energy Level
                </label>
                <select
                  value={lotteryEnergy}
                  onChange={(e) =>
                    setLotteryEnergy(e.target.value as 'low' | 'medium' | 'high')
                  }
                  className="mt-1 flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Max Time Available (minutes)
                </label>
                <Input
                  type="number"
                  min="1"
                  value={lotteryMaxTime}
                  onChange={(e) =>
                    setLotteryMaxTime(parseInt(e.target.value) || 30)
                  }
                  className="mt-1"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Number of Routines
                </label>
                <select
                  value={lotteryCount}
                  onChange={(e) => setLotteryCount(parseInt(e.target.value))}
                  className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                >
                  <option value={1}>1 Routine</option>
                  <option value={2}>2 Routines</option>
                  <option value={3}>3 Routines</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Context (Optional)
                </label>
                <select
                  value={lotteryContext}
                  onChange={(e) => setLotteryContext(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="">Any Time</option>
                  <option value="morning">Morning</option>
                  <option value="evening">Evening</option>
                  <option value="anytime">Anytime</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Duration (Optional)
                </label>
                <select
                  value={lotteryDuration}
                  onChange={(e) => setLotteryDuration(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="">Any Duration</option>
                  <option value="5min">5 minutes</option>
                  <option value="15min">15 minutes</option>
                  <option value="30min">30 minutes</option>
                  <option value="60min">60 minutes</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Difficulty (Optional)
                </label>
                <select
                  value={lotteryDifficulty}
                  onChange={(e) => setLotteryDifficulty(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="">Any Difficulty</option>
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
              </div>

              <Button
                onClick={handleDrawLottery}
                disabled={lotterySpinning}
                className="w-full gap-2"
              >
                <Sparkles className="h-4 w-4" />
                {lotterySpinning ? 'Spinning...' : 'Spin the Wheel'}
              </Button>

              {lotteryResults.length > 0 && (
                <div className="mt-4 flex flex-col gap-3">
                  <p className="text-sm font-medium text-blue-900">
                    Your pick{lotteryResults.length > 1 ? 's' : ''}:
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {lotteryResults.map((routine) => (
                      <RoutineCard
                        key={routine.id}
                        routine={routine}
                        onClick={() => {}}
                        showAdminControls={false}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

