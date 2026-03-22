'use client';

import { useEffect } from 'react';
import { useTimeStore } from '@/lib/pomo-store/useTimeStore';
import { useSettingsStore } from '@/lib/pomo-store/useSettingsStore';

export const useTheme = () => {
  const { mode } = useTimeStore();
  const themeColors = useSettingsStore((state) => state.themeColors);

  useEffect(() => {
    const primaryColor = themeColors[mode];
    const root = document.documentElement;
    const previousPrimary = root.style.getPropertyValue('--theme-primary');
    const previousSecondary = root.style.getPropertyValue('--theme-secondary');
    const previousBackground = root.style.getPropertyValue('--theme-bg');

    root.style.setProperty('--theme-primary', primaryColor);
    root.style.setProperty(
      '--theme-secondary',
      `color-mix(in srgb, ${primaryColor}, white 20%)`
    );
    root.style.setProperty('--theme-bg', primaryColor);

    return () => {
      if (previousPrimary) {
        root.style.setProperty('--theme-primary', previousPrimary);
      } else {
        root.style.removeProperty('--theme-primary');
      }

      if (previousSecondary) {
        root.style.setProperty('--theme-secondary', previousSecondary);
      } else {
        root.style.removeProperty('--theme-secondary');
      }

      if (previousBackground) {
        root.style.setProperty('--theme-bg', previousBackground);
      } else {
        root.style.removeProperty('--theme-bg');
      }
    };
  }, [mode, themeColors]);
};
