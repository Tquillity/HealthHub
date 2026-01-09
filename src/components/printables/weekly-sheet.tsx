'use client';

import { WeeklyPlanData, TemplateVariant } from './types';
import { DayCard } from './day-card';
import { NotesCard } from './notes-card';

interface WeeklySheetProps {
  data: WeeklyPlanData;
  variant: TemplateVariant;
  viewMode: 'portrait' | 'landscape';
  paperSize: 'A4' | 'A3';
  density: 'comfortable' | 'compact';
}

const PAPER_SIZES = {
  A4: { width: '210mm', height: '297mm' },
  A3: { width: '297mm', height: '420mm' },
};

export function WeeklySheet({
  data,
  variant,
  viewMode,
  paperSize,
  density,
}: WeeklySheetProps) {
  const paperStyle = PAPER_SIZES[paperSize];
  const isPortrait = viewMode === 'portrait';

  const daysPerPage = density === 'compact' ? 4 : 2;

  // Chunk days into groups based on density
  const dayGroups: Array<Array<(typeof data.days)[number]>> = [];
  for (let i = 0; i < data.days.length; i += daysPerPage) {
    dayGroups.push(data.days.slice(i, i + daysPerPage));
  }

  return (
    <div className="print-container">
      {dayGroups.map((group, groupIndex) => (
        <div
          key={groupIndex}
          className="print-page"
          style={{
            width: isPortrait ? paperStyle.width : paperStyle.height,
            height: isPortrait ? paperStyle.height : paperStyle.width,
            pageBreakAfter: groupIndex < dayGroups.length - 1 ? 'always' : 'auto',
          }}
        >
          <div
            className={`w-full h-full p-4 ${
              density === 'compact'
                ? isPortrait
                  ? 'grid grid-cols-2 grid-rows-2 gap-4'
                  : 'grid grid-cols-4 gap-4'
                : isPortrait
                  ? 'flex flex-col gap-4'
                  : 'grid grid-cols-2 gap-4'
            }`}
          >
            {group.map((day) => (
              <div key={day.date.toISOString()} className={isPortrait ? 'flex-1' : 'h-full'}>
                <DayCard
                  dayName={day.dayName}
                  variant={variant}
                  meals={day.meals}
                  className="h-full"
                />
              </div>
            ))}

            {/* Fill remaining slots with Notes (only on last page) */}
            {groupIndex === dayGroups.length - 1 &&
              Array.from({ length: daysPerPage - group.length }).map((_, i) => (
                <div key={`notes-${i}`} className={isPortrait ? 'flex-1' : 'h-full'}>
                  <NotesCard
                    title={i === 0 ? 'Notes & Shopping' : 'Shopping List'}
                    variant={variant}
                    className="h-full"
                  />
                </div>
              ))}
          </div>
        </div>
      ))}

      <style dangerouslySetInnerHTML={{
        __html: `
          @media print {
            body * {
              visibility: hidden;
            }
            .print-container,
            .print-container * {
              visibility: visible;
            }
            .print-container {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
            }
            .print-page {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
          }
        `
      }} />
    </div>
  );
}

