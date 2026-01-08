'use client';

import { useState } from 'react';
import { format, startOfMonth, endOfMonth, getDaysInMonth, addMonths, subMonths, isSameDay } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { JournalEntry } from '@prisma/client';

interface JournalCalendarProps {
  entries: JournalEntry[];
  selectedDate: string | null;
  onDateSelect: (date: string) => void;
  onEntryClick: (entry: JournalEntry) => void;
}

export function JournalCalendar({
  entries,
  selectedDate,
  onDateSelect,
  onEntryClick,
}: JournalCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const getEntryForDate = (date: Date) => {
    return entries.find((entry) => {
      const entryDate = new Date(entry.date);
      return isSameDay(entryDate, date);
    });
  };

  const getMoodColor = (mood: number | null) => {
    if (mood === null) return 'bg-gray-100';
    if (mood >= 8) return 'bg-green-100 text-green-800';
    if (mood >= 6) return 'bg-yellow-100 text-yellow-800';
    if (mood >= 4) return 'bg-orange-100 text-orange-800';
    return 'bg-red-100 text-red-800';
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentMonth((prev) => {
      const newMonth = new Date(prev);
      if (direction === 'prev') {
        newMonth.setMonth(prev.getMonth() - 1);
      } else {
        newMonth.setMonth(prev.getMonth() + 1);
      }
      return newMonth;
    });
  };

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = getDaysInMonth(currentMonth);
  const startingDayOfWeek = monthStart.getDay();

  const days: (Date | null)[] = [];
  for (let i = 0; i < startingDayOfWeek; i++) {
    days.push(null);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    days.push(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day));
  }

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
      {/* Calendar Header */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => navigateMonth('prev')}
          className="p-2 rounded-lg transition-colors hover:bg-gray-100"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        <h2 className="text-xl font-semibold text-gray-900">
          {format(currentMonth, 'MMMM yyyy')}
        </h2>

        <button
          onClick={() => navigateMonth('next')}
          className="p-2 rounded-lg transition-colors hover:bg-gray-100"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1">
        {/* Day Headers */}
        {dayNames.map((day) => (
          <div
            key={day}
            className="p-2 text-center text-sm font-medium text-gray-500"
          >
            {day}
          </div>
        ))}

        {/* Calendar Days */}
        {days.map((day, index) => {
          if (!day) {
            return <div key={index} className="p-2 min-h-[80px]" />;
          }

          const entry = getEntryForDate(day);
          const dayStr = format(day, 'yyyy-MM-dd');
          const isToday = isSameDay(day, new Date());
          const isSelected = selectedDate === dayStr;

          return (
            <div
              key={dayStr}
              className={`p-2 min-h-[80px] border rounded-lg cursor-pointer transition-colors ${
                isToday
                  ? 'bg-primary-50 border-primary-200'
                  : isSelected
                  ? 'bg-primary-100 border-primary-300'
                  : 'border-gray-200 hover:bg-gray-50'
              }`}
              onClick={() => {
                onDateSelect(dayStr);
                if (entry) {
                  onEntryClick(entry);
                }
              }}
            >
              <div className="flex flex-col h-full">
                <div
                  className={`text-sm font-medium ${
                    isToday ? 'text-primary-600' : 'text-gray-900'
                  }`}
                >
                  {day.getDate()}
                </div>

                {entry && (
                  <div className="flex-1 flex flex-col justify-center gap-1 mt-1">
                    {entry.mood !== null && (
                      <div
                        className={`text-xs px-1 py-0.5 rounded-full text-center ${getMoodColor(entry.mood)}`}
                      >
                        😊 {entry.mood}
                      </div>
                    )}
                    {entry.energy !== null && (
                      <div className="text-xs px-1 py-0.5 rounded-full text-center bg-blue-100 text-blue-800">
                        ⚡ {entry.energy}
                      </div>
                    )}
                    {entry.sleepHours !== null && (
                      <div className="text-xs px-1 py-0.5 rounded-full text-center bg-purple-100 text-purple-800">
                        😴 {entry.sleepHours}h
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-6 pt-6 border-t border-gray-200">
        <h3 className="text-sm font-medium text-gray-900 mb-3">Legend</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-green-100"></div>
            <span>Mood: 8-10</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-yellow-100"></div>
            <span>Mood: 6-7</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-orange-100"></div>
            <span>Mood: 4-5</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-red-100"></div>
            <span>Mood: 1-3</span>
          </div>
        </div>
      </div>
    </div>
  );
}

