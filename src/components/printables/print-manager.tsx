'use client';

import { useState, useRef, useMemo } from 'react';
import { useReactToPrint } from 'react-to-print';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { WeeklySheet } from './weekly-sheet';
import { WeeklyPlanData, TemplateVariant } from './types';
import { format, addDays, eachDayOfInterval } from 'date-fns';
import { Printer } from 'lucide-react';

interface Plan {
  id: string;
  startDate: Date | string;
  items: Array<{
    id: string;
    date: Date | string;
    mealType: string;
    recipe: { id: string; name: string };
  }>;
}

interface PrintManagerProps {
  plan: Plan;
  startDate: Date;
}

export function PrintManager({ plan, startDate }: PrintManagerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'portrait' | 'landscape'>('portrait');
  const [template, setTemplate] = useState<TemplateVariant>('classic');
  const [paperSize, setPaperSize] = useState<'A4' | 'A3'>('A4');
  const [density, setDensity] = useState<'comfortable' | 'compact'>('comfortable');
  const printRef = useRef<HTMLDivElement>(null);

  // Helper function to normalize a date to UTC midnight for consistent comparison
  const normalizeToUTCMidnight = (date: Date | string): string => {
    const d = date instanceof Date ? new Date(date) : new Date(date);
    // Normalize to UTC midnight to avoid timezone issues when comparing dates
    const utcDate = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    return utcDate.toISOString().split('T')[0];
  };

  // Transform plan data into WeeklyPlanData format
  const weeklyData: WeeklyPlanData = useMemo(() => {
    const start = startDate instanceof Date ? startDate : new Date(startDate);
    // Normalize to UTC midnight to avoid timezone shifts
    start.setUTCHours(0, 0, 0, 0);
    const end = addDays(start, 6); // Default to 7 days
    const days = eachDayOfInterval({ start, end });

    return {
      startDate: start,
      days: days.map((date) => {
        const dayName = format(date, 'EEEE'); // Full day name
        const dateStr = normalizeToUTCMidnight(date);

        // Get meals for this day
        const dayItems = plan.items.filter((item) => {
          const itemDateStr = normalizeToUTCMidnight(item.date);
          return itemDateStr === dateStr;
        });

        const meals = {
          breakfast: dayItems
            .filter((item) => item.mealType === 'breakfast')
            .map((item) => item.recipe.name)
            .join(', ') || undefined,
          lunch: dayItems
            .filter((item) => item.mealType === 'lunch')
            .map((item) => item.recipe.name)
            .join(', ') || undefined,
          dinner: dayItems
            .filter((item) => item.mealType === 'dinner')
            .map((item) => item.recipe.name)
            .join(', ') || undefined,
        };

        return {
          dayName,
          date,
          meals,
        };
      }),
    };
  }, [plan, startDate]);

  const handlePrint = useReactToPrint({
    content: () => printRef.current,
    documentTitle: `Meal Plan - ${format(new Date(startDate), 'MMM d, yyyy')}`,
  });

  const templates: Array<{ value: TemplateVariant; label: string }> = [
    { value: 'classic', label: 'Classic' },
    { value: 'minimal', label: 'Minimal' },
    { value: 'tracker', label: 'Tracker' },
    { value: 'chef', label: 'Chef' },
    { value: 'bubbly', label: 'Bubbly' },
    { value: 'retro', label: 'Retro' },
    { value: 'brutalist', label: 'Brutalist' },
    { value: 'botanical', label: 'Botanical' },
    { value: 'bullet', label: 'Bullet' },
    { value: 'index', label: 'Index' },
  ];

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        variant="outline"
        className="gap-2"
      >
        <Printer className="h-4 w-4" />
        Print
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] overflow-y-auto w-full">
          <DialogHeader>
            <DialogTitle>Print Meal Plan</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-6">
            {/* Controls */}
            <div className="flex flex-wrap items-center gap-4 border-b border-gray-200 pb-4">
              {/* Template Selection */}
              <div className="flex flex-col gap-2">
                <label htmlFor="template-select" className="text-sm font-medium">
                  Template
                </label>
                <div className="flex flex-wrap gap-2">
                  {templates.map((t) => (
                    <button
                      key={t.value}
                      id={`template-${t.value}`}
                      onClick={() => setTemplate(t.value)}
                      className={`px-3 py-1.5 text-sm rounded-md border transition-colors min-h-[44px] ${
                        template === t.value
                          ? 'bg-primary-500 text-white border-primary-500'
                          : 'bg-white border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Orientation */}
              <div className="flex flex-col gap-2">
                <label htmlFor="orientation-select" className="text-sm font-medium">
                  Orientation
                </label>
                <div className="flex gap-2">
                  <button
                    id="orientation-portrait"
                    onClick={() => setViewMode('portrait')}
                    className={`px-4 py-2 text-sm rounded-md border transition-colors min-h-[44px] ${
                      viewMode === 'portrait'
                        ? 'bg-primary-500 text-white border-primary-500'
                        : 'bg-white border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    Portrait
                  </button>
                  <button
                    id="orientation-landscape"
                    onClick={() => setViewMode('landscape')}
                    className={`px-4 py-2 text-sm rounded-md border transition-colors min-h-[44px] ${
                      viewMode === 'landscape'
                        ? 'bg-primary-500 text-white border-primary-500'
                        : 'bg-white border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    Landscape
                  </button>
                </div>
              </div>

              {/* Paper Size */}
              <div className="flex flex-col gap-2">
                <label htmlFor="paper-size-select" className="text-sm font-medium">
                  Paper Size
                </label>
                <div className="flex gap-2">
                  <button
                    id="paper-a4"
                    onClick={() => setPaperSize('A4')}
                    className={`px-4 py-2 text-sm rounded-md border transition-colors min-h-[44px] ${
                      paperSize === 'A4'
                        ? 'bg-primary-500 text-white border-primary-500'
                        : 'bg-white border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    A4
                  </button>
                  <button
                    id="paper-a3"
                    onClick={() => setPaperSize('A3')}
                    className={`px-4 py-2 text-sm rounded-md border transition-colors min-h-[44px] ${
                      paperSize === 'A3'
                        ? 'bg-primary-500 text-white border-primary-500'
                        : 'bg-white border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    A3
                  </button>
                </div>
              </div>

              {/* Density */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">Layout Density</label>
                <div className="flex gap-2">
                  <button
                    id="density-comfortable"
                    onClick={() => setDensity('comfortable')}
                    className={`px-4 py-2 text-sm rounded-md border transition-colors min-h-[44px] ${
                      density === 'comfortable'
                        ? 'bg-primary-500 text-white border-primary-500'
                        : 'bg-white border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    Comfortable
                  </button>
                  <button
                    id="density-compact"
                    onClick={() => setDensity('compact')}
                    className={`px-4 py-2 text-sm rounded-md border transition-colors min-h-[44px] ${
                      density === 'compact'
                        ? 'bg-primary-500 text-white border-primary-500'
                        : 'bg-white border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    Compact
                  </button>
                </div>
              </div>

              {/* Print Button */}
              <div className="flex items-end">
                <Button onClick={handlePrint} className="gap-2">
                  <Printer className="h-4 w-4" />
                  Print
                </Button>
              </div>
            </div>

            {/* Preview */}
            <div className="flex-1 rounded-lg bg-gray-200/70 p-6 overflow-y-auto w-full flex justify-center">
              <div ref={printRef}>
                <WeeklySheet
                  data={weeklyData}
                  variant={template}
                  viewMode={viewMode}
                  paperSize={paperSize}
                  density={density}
                />
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

