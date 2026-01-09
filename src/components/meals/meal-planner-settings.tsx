'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { updateProfile } from '@/actions/profile-actions';
import { Settings, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { useUIStore } from '@/lib/store';

interface MealPlannerSettingsProps {
  initialDuration?: string | null;
  initialStartDate?: string | null;
}

type MealPlanDuration = '1week' | '2weeks' | '1month';

const DEFAULT_DURATION: MealPlanDuration = '1week';
const isMealPlanDuration = (value: string): value is MealPlanDuration =>
  value === '1week' || value === '2weeks' || value === '1month';

export function MealPlannerSettings({
  initialDuration = '1week',
  initialStartDate = null,
}: MealPlannerSettingsProps) {
  const router = useRouter();
  const showToast = useUIStore((state) => state.showToast);
  const [showDialog, setShowDialog] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [duration, setDuration] = useState<MealPlanDuration>(
    initialDuration && isMealPlanDuration(initialDuration) ? initialDuration : DEFAULT_DURATION,
  );
  const [startDate, setStartDate] = useState<string>(
    initialStartDate || new Date().toISOString().split('T')[0]
  );
  const [useToday, setUseToday] = useState(!initialStartDate);

  // Quick presets
  const handlePreset = (preset: 'thisWeek' | 'nextWeek' | 'thisMonth') => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    switch (preset) {
      case 'thisWeek':
        setDuration('1week');
        setUseToday(true);
        setStartDate(today.toISOString().split('T')[0]);
        break;
      case 'nextWeek':
        {
          const nextWeek = new Date(today);
          nextWeek.setDate(today.getDate() + (7 - today.getDay() + 1)); // Next Monday
          setDuration('1week');
          setUseToday(false);
          setStartDate(nextWeek.toISOString().split('T')[0]);
        }
        break;
      case 'thisMonth':
        setDuration('1month');
        setUseToday(true);
        setStartDate(today.toISOString().split('T')[0]);
        break;
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    
    const result = await updateProfile({
      mealPlanDuration: duration,
      mealPlanStartDate: useToday ? null : startDate,
    });

    setIsSaving(false);

    if (result.success) {
      showToast('Meal planner settings saved successfully!', 'success');
      setShowDialog(false);
      router.refresh();
    } else {
      showToast(result.error || 'Failed to save settings', 'error');
    }
  };

  return (
    <>
      <Button
        onClick={() => setShowDialog(true)}
        variant="outline"
        size="sm"
        className="gap-2"
      >
        <Settings className="h-4 w-4" />
        Settings
      </Button>

      {showDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Meal Planner Settings</h2>
              <p className="mt-2 text-sm text-gray-500">
                Customize your meal planning view and preferences.
              </p>
            </div>

            <div className="flex flex-col gap-6">
              {/* Quick Presets */}
              <div className="flex flex-col gap-2">
                <label className="block text-sm font-medium text-gray-700">
                  Quick Presets
                </label>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handlePreset('thisWeek')}
                  >
                    This Week
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handlePreset('nextWeek')}
                  >
                    Next Week
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handlePreset('thisMonth')}
                  >
                    This Month
                  </Button>
                </div>
              </div>

              {/* Duration Selector */}
              <div className="flex flex-col gap-2">
                <label className="block text-sm font-medium text-gray-700">
                  Plan Duration
                </label>
                <div className="flex gap-2">
                  {(
                    [
                      { value: '1week', label: '1 Week' },
                      { value: '2weeks', label: '2 Weeks' },
                      { value: '1month', label: '1 Month' },
                    ] as const
                  ).map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setDuration(option.value)}
                      className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                        duration === option.value
                          ? 'bg-primary-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Start Date */}
              <div className="flex flex-col gap-2">
                <label htmlFor="meal-planner-start-date" className="block text-sm font-medium text-gray-700">
                  Start Date
                </label>
                <div className="flex flex-col gap-2">
                  <label htmlFor="meal-planner-use-today" className="flex items-center gap-2">
                    <input
                      id="meal-planner-use-today"
                      name="meal-planner-use-today"
                      type="checkbox"
                      checked={useToday}
                      onChange={(e) => {
                        setUseToday(e.target.checked);
                        if (e.target.checked) {
                          setStartDate(new Date().toISOString().split('T')[0]);
                        }
                      }}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm text-gray-700">Always start from today</span>
                  </label>
                  
                  {!useToday && (
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                      <Input
                        id="meal-planner-start-date"
                        name="meal-planner-start-date"
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="pl-10"
                        min={new Date().toISOString().split('T')[0]}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Date Range Preview */}
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="text-xs font-medium text-gray-500 mb-1">Preview</p>
                <p className="text-sm text-gray-700">
                  {(() => {
                    const start = useToday ? new Date() : new Date(startDate);
                    start.setHours(0, 0, 0, 0);
                    
                    let days = 7;
                    if (duration === '2weeks') days = 14;
                    if (duration === '1month') days = 30;
                    
                    const end = new Date(start);
                    end.setDate(start.getDate() + days - 1);
                    
                    return `${format(start, 'MMM d')} - ${format(end, 'MMM d, yyyy')}`;
                  })()}
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowDialog(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleSave}
                  disabled={isSaving}
                >
                  {isSaving ? 'Saving...' : 'Save Settings'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

