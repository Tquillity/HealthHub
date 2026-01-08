'use client';

import { WeeklyPlanData, TemplateVariant } from './types';
import { DayCard } from './day-card';
import { NotesCard } from './notes-card';

interface WeeklySheetProps {
  data: WeeklyPlanData;
  variant: TemplateVariant;
  viewMode: 'portrait' | 'landscape';
  paperSize: 'A4' | 'A3';
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
}: WeeklySheetProps) {
  const paperStyle = PAPER_SIZES[paperSize];
  const isPortrait = viewMode === 'portrait';

  // Group days into pairs (2 days per sheet)
  const dayPairs: Array<[typeof data.days[0], typeof data.days[1]?]> = [];
  for (let i = 0; i < data.days.length; i += 2) {
    dayPairs.push([data.days[i], data.days[i + 1]]);
  }

  return (
    <div className="print-container">
      {dayPairs.map(([day1, day2], pairIndex) => (
        <div
          key={pairIndex}
          className="print-page"
          style={{
            width: isPortrait ? paperStyle.width : paperStyle.height,
            height: isPortrait ? paperStyle.height : paperStyle.width,
            pageBreakAfter: pairIndex < dayPairs.length - 1 ? 'always' : 'auto',
          }}
        >
          <div
            className={`w-full h-full p-4 ${
              isPortrait
                ? 'flex flex-col gap-4'
                : 'grid grid-cols-2 gap-4'
            }`}
          >
            {/* Day 1 */}
            <div className={isPortrait ? 'flex-1' : 'h-full'}>
              <DayCard
                dayName={day1.dayName}
                variant={variant}
                meals={day1.meals}
                className="h-full"
              />
            </div>

            {/* Day 2 (if exists) */}
            {day2 && (
              <div className={isPortrait ? 'flex-1' : 'h-full'}>
                <DayCard
                  dayName={day2.dayName}
                  variant={variant}
                  meals={day2.meals}
                  className="h-full"
                />
              </div>
            )}

            {/* Notes Card (only on last pair if odd number of days) */}
            {!day2 && pairIndex === dayPairs.length - 1 && (
              <div className={isPortrait ? 'flex-1' : 'h-full'}>
                <NotesCard variant={variant} className="h-full" />
              </div>
            )}
          </div>
        </div>
      ))}

      {/* Add a notes page at the end if we have an even number of days */}
      {data.days.length % 2 === 0 && (
        <div
          className="print-page"
          style={{
            width: isPortrait ? paperStyle.width : paperStyle.height,
            height: isPortrait ? paperStyle.height : paperStyle.width,
          }}
        >
          <div
            className={`w-full h-full p-4 ${
              isPortrait
                ? 'flex flex-col gap-4'
                : 'grid grid-cols-2 gap-4'
            }`}
          >
            <div className={isPortrait ? 'flex-1' : 'h-full'}>
              <NotesCard variant={variant} className="h-full" />
            </div>
            <div className={isPortrait ? 'flex-1' : 'h-full'}>
              <NotesCard
                title="Shopping List"
                variant={variant}
                className="h-full"
              />
            </div>
          </div>
        </div>
      )}

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
          @media screen {
            .print-container {
              background: white;
            }
            .print-page {
              background: white;
              margin-bottom: 20px;
              box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
            }
          }
        `
      }} />
    </div>
  );
}

