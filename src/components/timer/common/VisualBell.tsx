'use client';

import { useEffect, useState } from 'react';
import { events } from '@/lib/pomo/services/event.service';

export const VisualBell = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    let timeoutId: number | null = null;
    const handleTimerComplete = () => {
      if (prefersReducedMotion) return;
      setIsVisible(true);
      if (timeoutId !== null) window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => setIsVisible(false), 1000);
    };

    const unsubscribe = events.on('timer:complete', handleTimerComplete);
    return () => {
      unsubscribe();
      if (timeoutId !== null) window.clearTimeout(timeoutId);
    };
  }, [prefersReducedMotion]);

  if (!isVisible || prefersReducedMotion) return null;

  return (
    <div className="fixed inset-0 bg-white pointer-events-none z-100 animate-flash" />
  );
};
