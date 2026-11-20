'use client';

import { useState, useMemo } from 'react';
import { flushSync } from 'react-dom';
import { useRouter } from 'next/navigation';
import { parseAsString, useQueryState } from 'nuqs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { drawLottery } from '@/actions/routine-actions';
import { Plus, Sparkles, X } from 'lucide-react';
import type { Routine } from '@prisma/client';
import { EmptyState } from '@/components/ui/empty-state';
import { useUIStore } from '@/lib/store';
import {
  getRevealMode,
  readMotionEnvironment,
  runInViewTransition,
} from '@/lib/view-transitions';
import { RoutineCard } from './routine-card';
import { RoutinesGrid } from './routines-grid';
import { RoutineRichForm } from './routine-rich-form';

interface RoutinesClientProps {
  /** The space the page was rendered for; new routines and the lottery use it. */
  organizationId: string;
  /** That space's routines plus system ones. A refresh passes the new list. */
  routines: Routine[];
}

/** How long the "Spinning..." state lasts in browsers without View Transitions. */
const LOTTERY_FALLBACK_SPIN_MS = 1500;

/**
 * view-transition-name values. They must match the ::view-transition-* rules in
 * src/app/globals.css, and each must be unique on the page while a transition runs.
 */
const LOTTERY_DIALOG_TRANSITION_NAME = 'lottery-dialog';
const lotteryPickTransitionName = (index: number) => `lottery-pick-${index}`;

const NO_MATCH_MESSAGE = 'No routines match your criteria. Try adjusting filters.';

export function RoutinesClient({ organizationId, routines }: RoutinesClientProps) {
  const router = useRouter();
  const showToast = useUIStore((state) => state.showToast);

  // Get filter params from URL
  const [query, setQuery] = useQueryState('q', parseAsString.withDefault(''));
  const [category, setCategory] = useQueryState('category', parseAsString);
  const [energyLevel, setEnergyLevel] = useQueryState('energy', parseAsString);
  const [context, setContext] = useQueryState('context', parseAsString);
  const [difficulty, setDifficulty] = useQueryState(
    'difficulty',
    parseAsString
  );
  const [duration, setDuration] = useQueryState('duration', parseAsString);

  const hasActiveFilters = Boolean(
    query || category || energyLevel || context || difficulty || duration
  );

  const clearFilters = () => {
    void setQuery(null);
    void setCategory(null);
    void setEnergyLevel(null);
    void setContext(null);
    void setDifficulty(null);
    void setDuration(null);
  };

  // Filter routines client-side
  const filteredRoutines = useMemo(() => {
    return routines.filter((routine) => {
      if (
        query &&
        !routine.name.toLowerCase().includes(query.toLowerCase()) &&
        !routine.description?.toLowerCase().includes(query.toLowerCase())
      ) {
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
  const [lotteryResults, setLotteryResults] = useState<Routine[]>([]);
  const [lotterySpinning, setLotterySpinning] = useState(false);
  const [lotteryEnergy, setLotteryEnergy] = useState<'low' | 'medium' | 'high'>(
    'medium'
  );
  const [lotteryMaxTime, setLotteryMaxTime] = useState(30);
  const [lotteryCount, setLotteryCount] = useState(1);
  const [lotteryContext, setLotteryContext] = useState<string>('');
  const [lotteryDuration, setLotteryDuration] = useState<string>('');
  const [lotteryDifficulty, setLotteryDifficulty] = useState<string>('');
  const [editingRoutine, setEditingRoutine] = useState<Routine | null>(null);

  const handleDrawLottery = async () => {
    // View Transitions morph the picks in; older browsers keep the fixed spin, and
    // reduced-motion users get the result as soon as it arrives.
    const revealMode = getRevealMode(readMotionEnvironment(document, window));
    setLotterySpinning(true);
    setLotteryResults([]);

    let result: Awaited<ReturnType<typeof drawLottery>>;
    try {
      [result] = await Promise.all([
        drawLottery(organizationId, {
          energy: lotteryEnergy,
          maxTime: lotteryMaxTime,
          count: lotteryCount,
          context: lotteryContext || undefined,
          duration: lotteryDuration || undefined,
          difficulty: lotteryDifficulty || undefined,
        }),
        revealMode === 'timed'
          ? new Promise((resolve) => setTimeout(resolve, LOTTERY_FALLBACK_SPIN_MS))
          : undefined,
      ]);
    } catch {
      showToast('Failed to draw lottery', 'error');
      setLotterySpinning(false);
      return;
    }

    const picks = result.success && Array.isArray(result.data) ? result.data : [];
    if (picks.length > 0) {
      // flushSync commits the picks inside the transition callback, so the browser captures the
      // new cards as the "after" state and morphs them in instead of snapping.
      runInViewTransition(
        revealMode === 'view-transition' ? document : undefined,
        () => {
          flushSync(() => {
            setLotteryResults(picks);
            setLotterySpinning(false);
          });
        }
      );
      return;
    }

    if (result.success) {
      showToast(NO_MATCH_MESSAGE, 'warning');
    } else {
      showToast(result.error || 'Failed to draw lottery', 'error');
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
        <RoutinesGrid organizationId={organizationId} routines={filteredRoutines} />
      ) : (
        <EmptyState
          icon={Sparkles}
          title={
            routines.length === 0 ? 'No routines yet' : 'No routines found'
          }
          description={
            routines.length === 0
              ? 'Create your first routine or spin the lottery when you have habits to pick from.'
              : 'Try adjusting your filters or create a new routine.'
          }
          action={{
            label: 'Add Routine',
            onClick: () => setShowCreateDialog(true),
          }}
          secondaryAction={
            hasActiveFilters
              ? { label: 'Clear filters', onClick: clearFilters }
              : undefined
          }
        />
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
                type="button"
                aria-label="Close"
                onClick={() => {
                  setShowCreateDialog(false);
                  setEditingRoutine(null);
                }}
                className="flex min-h-[44px] min-w-[44px] items-center justify-center text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>

            <div className="overflow-y-auto flex-1">
              <RoutineRichForm
                organizationId={organizationId}
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

      {/* Lottery Dialog */}
      {showLotteryDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div
            className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl"
            style={{ viewTransitionName: LOTTERY_DIALOG_TRANSITION_NAME }}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Todo Lottery</h2>
              <button
                type="button"
                aria-label="Close"
                onClick={() => {
                  setShowLotteryDialog(false);
                  setLotteryResults([]);
                }}
                className="flex min-h-[44px] min-w-[44px] items-center justify-center text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>

            <div className="flex flex-col gap-4">
              <div>
                <label
                  htmlFor="lottery-energy"
                  className="block text-sm font-medium text-gray-700"
                >
                  Your Energy Level
                </label>
                <select
                  id="lottery-energy"
                  value={lotteryEnergy}
                  onChange={(e) =>
                    setLotteryEnergy(
                      e.target.value as 'low' | 'medium' | 'high'
                    )
                  }
                  className="mt-1 flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="lottery-max-time"
                  className="block text-sm font-medium text-gray-700"
                >
                  Max Time Available (minutes)
                </label>
                <Input
                  id="lottery-max-time"
                  type="number"
                  min="1"
                  max="1440"
                  value={lotteryMaxTime}
                  onChange={(e) =>
                    setLotteryMaxTime(
                      Math.min(
                        1440,
                        Math.max(1, parseInt(e.target.value) || 30)
                      )
                    )
                  }
                  className="mt-1"
                />
              </div>

              <div>
                <label
                  htmlFor="lottery-count"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Number of Routines
                </label>
                <select
                  id="lottery-count"
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
                <label
                  htmlFor="lottery-context"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Context (Optional)
                </label>
                <select
                  id="lottery-context"
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
                <label
                  htmlFor="lottery-duration"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Duration (Optional)
                </label>
                <select
                  id="lottery-duration"
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
                <label
                  htmlFor="lottery-difficulty"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Difficulty (Optional)
                </label>
                <select
                  id="lottery-difficulty"
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
                    {lotteryResults.map((routine, index) => (
                      <div
                        key={routine.id}
                        className="grid"
                        style={{
                          viewTransitionName: lotteryPickTransitionName(index),
                        }}
                      >
                        <RoutineCard
                          organizationId={organizationId}
                          routine={routine}
                          onClick={() => {}}
                          showAdminControls={false}
                        />
                      </div>
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
