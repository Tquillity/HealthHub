'use client';

import { useTimeStore } from '@/lib/pomo-store/useTimeStore';
import { subDays, format } from 'date-fns';

export const seedDevData = () => {
  const history: Record<string, { pomodoro: number; short: number; long: number }> = {};

  const daysToGenerate = 730;
  
  for (let i = 0; i < daysToGenerate; i++) {
    const date = subDays(new Date(), i);
    const key = format(date, 'yyyy-MM-dd');

    const dayOfWeek = date.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const workChance = isWeekend ? 0.3 : 0.7;
    
    const isOffDay = Math.random() < 0.1;
    
    if (!isOffDay && Math.random() < workChance) {
      const maxPomos = isWeekend ? 6 : 12;
      const minPomos = isWeekend ? 0 : 2;
      const pomos = Math.floor(Math.random() * (maxPomos - minPomos + 1)) + minPomos;
      
      if (pomos > 0) {
        history[key] = {
          pomodoro: pomos,
          short: Math.floor(pomos * 0.8),
          long: Math.floor(pomos * 0.2)
        };
      } else {
        history[key] = { pomodoro: 0, short: 0, long: 0 };
      }
    } else {
      history[key] = { pomodoro: 0, short: 0, long: 0 };
    }
  }

  useTimeStore.setState({ history });
  alert("Seeded 2 years (730 days) of realistic dev data.");
  window.location.reload();
};