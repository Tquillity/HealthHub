'use client';

import { useState } from 'react';
import { DndContext, useDraggable, useDroppable, DragOverlay, defaultDropAnimationSideEffects } from '@dnd-kit/core';
import { addDays, format, isToday, isPast, startOfDay } from 'date-fns';
import { Trash2, UtensilsCrossed } from 'lucide-react';
import { addMealToPlan, removeMealFromPlan } from '@/actions/meal-actions';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { RotateCcw } from 'lucide-react';

type RecipeLite = {
  id: string;
  name: string;
  category?: string | null;
  imageUrl?: string | null;
};

type PlanItem = {
  id: string;
  date: Date | string;
  mealType: string;
  recipe: { id: string; name: string };
};

type Plan = {
  id: string;
  startDate: Date | string;
  endDate?: Date | string;
  items: PlanItem[];
};

function DraggableRecipe({ recipe }: { recipe: RecipeLite }) {
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: `recipe-${recipe.id}`,
    data: { recipeId: recipe.id, type: 'new-meal' },
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className="cursor-grab rounded-md border border-gray-200 bg-white p-3 text-sm shadow-sm hover:border-blue-500 active:cursor-grabbing"
    >
      <p className="truncate font-medium">{recipe.name}</p>
      <span className="text-xs capitalize text-gray-500">
        {recipe.category || 'Meal'}
      </span>
    </div>
  );
}

function DaySlot({
  date,
  mealType,
  items,
  isPastDay,
}: {
  date: Date;
  mealType: string;
  items: PlanItem[];
  isPastDay: boolean;
}) {
  const dateStr = date.toISOString();
  const { setNodeRef, isOver } = useDroppable({
    id: `${dateStr}::${mealType}`,
    data: { date: dateStr, mealType },
    disabled: isPastDay, // Disable dropping on past days
  });

  const dayIsToday = isToday(date);

  return (
    <div
      ref={setNodeRef}
      className={`min-h-[80px] rounded-lg border-2 p-2 transition-colors ${
        isPastDay
          ? 'border-gray-100 bg-gray-50/30 opacity-60 cursor-not-allowed'
          : isOver
          ? 'border-blue-400 bg-blue-50'
          : dayIsToday
          ? 'border-blue-200 bg-blue-50/30'
          : 'border-dashed border-gray-200 bg-gray-50/50'
      }`}
    >
      {items.map((item) => (
        <div
          key={item.id}
          className="group relative mb-2 rounded border border-blue-100 bg-white p-2 text-xs shadow-sm"
        >
          <span className="block truncate font-medium">{item.recipe.name}</span>
          {!isPastDay && (
            <button
              onClick={() => removeMealFromPlan(item.id)}
              className="absolute right-1 top-1 cursor-pointer opacity-0 transition-opacity group-hover:opacity-100"
              aria-label="Remove meal"
            >
              <Trash2 className="h-3 w-3 text-red-400 hover:text-red-600" />
            </button>
          )}
        </div>
      ))}

      {items.length === 0 && (
        <span
          className={`pointer-events-none text-xs capitalize ${
            isPastDay ? 'text-gray-200' : 'text-gray-300'
          }`}
        >
          {mealType}
        </span>
      )}
    </div>
  );
}

export default function MealBoard({
  plan,
  recipes,
  duration = '1week',
  startDate: startDateProp,
  endDate: endDateProp,
  useDefaultStart = true,
}: {
  plan: Plan;
  recipes: RecipeLite[];
  duration?: string;
  startDate?: Date | string;
  endDate?: Date | string;
  useDefaultStart?: boolean;
}) {
  const router = useRouter();
  const [activeId, setActiveId] = useState<string | null>(null);
  
  const startDate = startDateProp ? new Date(startDateProp) : new Date(plan.startDate);
  const endDate = endDateProp
    ? new Date(endDateProp)
    : plan.endDate
      ? new Date(plan.endDate)
      : addDays(startDate, 6);
  
  // Calculate number of days to show
  let daysToShow = 7;
  if (duration === '2weeks') daysToShow = 14;
  if (duration === '1month') daysToShow = 30;
  
  const allDays = Array.from({ length: daysToShow }).map((_, i) =>
    addDays(startDate, i)
  );
  
  // Filter out past days if using default start (today)
  const visibleDays = useDefaultStart
    ? allDays.filter((day) => !isPast(startOfDay(day)) || isToday(day))
    : allDays;
  
  const mealTypes = ['breakfast', 'lunch', 'dinner'];

  // Find the active recipe for the overlay
  const activeRecipe = activeId ? recipes.find(r => `recipe-${r.id}` === activeId) : null;

  const handleDragStart = (event: { active: { id: string | number } }) => {
    setActiveId(String(event.active.id));
  };

  const handleDragEnd = async (event: {
    active: { data: { current?: { type?: string; recipeId?: string } } };
    over: { data: { current?: { date?: string; mealType?: string } } } | null;
  }) => {
    const { active, over } = event;
    setActiveId(null);

    if (over && active?.data?.current?.type === 'new-meal') {
      const recipeId = active.data.current.recipeId as string;
      const date = over.data.current?.date;
      const mealType = over.data.current?.mealType;

      if (!date || !mealType) return;

      await addMealToPlan(plan.id, recipeId, date, mealType);
    }
  };

  const handleJumpToToday = () => {
    router.refresh();
  };

  const openMealGenerator = () => {
    document.getElementById('meal-plan-generator-trigger')?.click();
  };

  const isPlanEmpty = plan.items.length === 0;

  return (
    // dnd-kit generates accessibility IDs (e.g. aria-describedby) that can differ between SSR and client.
    // Providing a stable DndContext id prevents hydration mismatches in Next.js.
    <DndContext id="meal-planner-dnd" onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex h-[calc(100vh-200px)] flex-col gap-6 lg:flex-row">
        {/* Sidebar */}
        <div className="w-full shrink-0 pr-2 lg:w-64">
          <div className="sticky top-0 rounded-xl border border-gray-200 bg-white p-4">
            <h3 className="mb-4 font-bold text-gray-700">Recipes</h3>
            {recipes.length === 0 ? (
              <EmptyState
                variant="compact"
                icon={UtensilsCrossed}
                title="No recipes yet"
                description="Browse or create recipes to drag onto your plan."
                action={{ label: 'Browse recipes', href: '/recipes' }}
              />
            ) : (
            <div className="flex flex-col gap-2 max-h-[calc(100vh-300px)] overflow-y-auto">
              {recipes.map((r) => (
                <DraggableRecipe key={r.id} recipe={r} />
              ))}
            </div>
            )}
          </div>
        </div>

        {/* Calendar */}
        <div className="min-w-[800px] flex-1 overflow-x-auto">
          {isPlanEmpty && (
            <div className="mb-4">
              <EmptyState
                variant="compact"
                icon={UtensilsCrossed}
                title="Your plan is empty"
                description="Generate a plan from your preferences or drag recipes from the sidebar."
                action={{ label: 'Generate meal plan', onClick: openMealGenerator }}
                secondaryAction={{ label: 'Browse recipes', href: '/recipes' }}
              />
            </div>
          )}
          {/* Header with date range and jump to today */}
          <div className="mb-4 flex items-center justify-between">
            <div className="text-sm text-gray-600">
              <span className="font-medium">
                {format(visibleDays[0] || startDate, 'MMM d')} -{' '}
                {format(visibleDays[visibleDays.length - 1] || endDate, 'MMM d, yyyy')}
              </span>
              {useDefaultStart && (
                <span className="ml-2 text-xs text-gray-400">
                  (Past days hidden)
                </span>
              )}
            </div>
            {useDefaultStart && (
              <Button
                onClick={handleJumpToToday}
                variant="outline"
                size="sm"
                className="gap-2"
              >
                <RotateCcw className="h-3 w-3" />
                Jump to Today
              </Button>
            )}
          </div>

          <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${visibleDays.length}, minmax(120px, 1fr))` }}>
            {visibleDays.map((day) => {
              const dayIsToday = isToday(day);
              const dayIsPast = isPast(startOfDay(day)) && !dayIsToday;
              
              return (
                <div key={day.toISOString()} className="flex flex-col gap-2">
                  <div
                    className={`rounded-lg py-2 text-center text-sm font-semibold ${
                      dayIsToday
                        ? 'bg-blue-600 text-white'
                        : dayIsPast
                        ? 'bg-gray-200 text-gray-400'
                        : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    <div>{format(day, 'EEE')}</div>
                    <div className="text-xs">{format(day, 'd')}</div>
                    {dayIsToday && (
                      <div className="mt-1 text-[10px] font-normal">Today</div>
                    )}
                  </div>

                  {mealTypes.map((type) => {
                    const items = plan.items.filter((item) => {
                      const itemDate = new Date(item.date);
                      return (
                        itemDate.toDateString() === day.toDateString() &&
                        item.mealType === type
                      );
                    });

                    return (
                      <DaySlot
                        key={`${day.toISOString()}-${type}`}
                        date={day}
                        mealType={type}
                        items={items}
                        isPastDay={dayIsPast}
                      />
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <DragOverlay dropAnimation={{
        sideEffects: defaultDropAnimationSideEffects({
          styles: { active: { opacity: '0.5' } },
        }),
      }}>
        {activeId && activeRecipe ? (
          <div className="w-56 cursor-grabbing rounded-md border-2 border-blue-500 bg-white p-3 text-sm shadow-xl opacity-90">
            <p className="truncate font-bold text-blue-600">{activeRecipe.name}</p>
            <span className="text-xs capitalize text-gray-500">{activeRecipe.category || 'Meal'}</span>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}



