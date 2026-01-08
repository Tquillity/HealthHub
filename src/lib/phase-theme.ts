/**
 * Phase Theme Utility
 * 
 * Provides Tailwind v4-compatible theme mappings for each cycle phase.
 * Enables thematic UI immersion where the entire interface adapts to the current phase.
 * 
 * Color Scheme:
 * - Menstrual: Rose tones (rest, recovery)
 * - Follicular: Fuchsia tones (energy building)
 * - Ovulation: Amber tones (peak energy)
 * - Luteal: Indigo tones (preparation)
 * 
 * Each phase includes:
 * - Text colors (for headings, body text)
 * - Background colors (for cards, sections)
 * - Border colors (for emphasis, separators)
 * - Gradient utilities (for hero sections, highlights)
 * 
 * Note on HEX Values:
 * The `color.primary`, `color.light`, and `color.dark` properties use hardcoded HEX values
 * instead of CSS variables. This is intentional for compatibility with:
 * - Recharts components (which require HEX strings for stroke/fill props)
 * - Inline style objects (which cannot use Tailwind classes)
 * - Third-party libraries that don't support CSS variable resolution
 * 
 * For Tailwind class-based styling, use the `text.*`, `bg.*`, `border.*`, and `gradient.*`
 * properties which reference Tailwind v4 color tokens that can be customized via globals.css.
 */

import { CyclePhase } from './cycle-calculator';

export interface PhaseTheme {
  // Text colors
  text: {
    primary: string; // Main text color
    secondary: string; // Muted text
    accent: string; // Accent text (phase name, highlights)
  };
  // Background colors
  bg: {
    primary: string; // Main background
    secondary: string; // Card backgrounds
    accent: string; // Highlighted sections
    muted: string; // Subtle backgrounds
  };
  // Border colors
  border: {
    primary: string; // Main borders
    accent: string; // Accent borders
    muted: string; // Subtle borders
  };
  // Gradient utilities
  gradient: {
    from: string; // Gradient start
    to: string; // Gradient end
    classes: string; // Tailwind gradient classes
  };
  // Raw color values for inline styles
  color: {
    primary: string; // Main phase color (hex)
    light: string; // Light variant (hex)
    dark: string; // Dark variant (hex)
  };
}

/**
 * Phase theme mappings
 * Uses Tailwind v4 color system with CSS variables where applicable
 */
export const PHASE_THEMES: Record<CyclePhase, PhaseTheme> = {
  menstrual: {
    text: {
      primary: 'text-gray-900',
      secondary: 'text-gray-600',
      accent: 'text-rose-600',
    },
    bg: {
      primary: 'bg-white',
      secondary: 'bg-rose-50',
      accent: 'bg-rose-100',
      muted: 'bg-rose-50/30',
    },
    border: {
      primary: 'border-rose-200',
      accent: 'border-rose-400',
      muted: 'border-rose-100',
    },
    gradient: {
      from: 'from-rose-500',
      to: 'to-rose-600',
      classes: 'bg-linear-to-br from-rose-500 to-rose-600',
    },
    color: {
      primary: '#f43f5e', // rose-500
      light: '#fce7f3', // rose-100
      dark: '#be123c', // rose-700
    },
  },
  follicular: {
    text: {
      primary: 'text-gray-900',
      secondary: 'text-gray-600',
      accent: 'text-fuchsia-600',
    },
    bg: {
      primary: 'bg-white',
      secondary: 'bg-fuchsia-50',
      accent: 'bg-fuchsia-100',
      muted: 'bg-fuchsia-50/30',
    },
    border: {
      primary: 'border-fuchsia-200',
      accent: 'border-fuchsia-400',
      muted: 'border-fuchsia-100',
    },
    gradient: {
      from: 'from-fuchsia-500',
      to: 'to-fuchsia-600',
      classes: 'bg-linear-to-br from-fuchsia-500 to-fuchsia-600',
    },
    color: {
      primary: '#d946ef', // fuchsia-500
      light: '#fae8ff', // fuchsia-100
      dark: '#a21caf', // fuchsia-700
    },
  },
  ovulation: {
    text: {
      primary: 'text-gray-900',
      secondary: 'text-gray-600',
      accent: 'text-amber-600',
    },
    bg: {
      primary: 'bg-white',
      secondary: 'bg-amber-50',
      accent: 'bg-amber-100',
      muted: 'bg-amber-50/30',
    },
    border: {
      primary: 'border-amber-200',
      accent: 'border-amber-400',
      muted: 'border-amber-100',
    },
    gradient: {
      from: 'from-amber-500',
      to: 'to-amber-600',
      classes: 'bg-linear-to-br from-amber-500 to-amber-600',
    },
    color: {
      primary: '#f59e0b', // amber-500
      light: '#fef3c7', // amber-100
      dark: '#b45309', // amber-700
    },
  },
  luteal: {
    text: {
      primary: 'text-gray-900',
      secondary: 'text-gray-600',
      accent: 'text-indigo-600',
    },
    bg: {
      primary: 'bg-white',
      secondary: 'bg-indigo-50',
      accent: 'bg-indigo-100',
      muted: 'bg-indigo-50/30',
    },
    border: {
      primary: 'border-indigo-200',
      accent: 'border-indigo-400',
      muted: 'border-indigo-100',
    },
    gradient: {
      from: 'from-indigo-500',
      to: 'to-indigo-600',
      classes: 'bg-linear-to-br from-indigo-500 to-indigo-600',
    },
    color: {
      primary: '#6366f1', // indigo-500
      light: '#e0e7ff', // indigo-100
      dark: '#4338ca', // indigo-700
    },
  },
};

/**
 * Get theme for a specific phase
 * 
 * @param phase - The cycle phase
 * @returns PhaseTheme object with all color mappings
 */
export function getPhaseTheme(phase: CyclePhase): PhaseTheme {
  return PHASE_THEMES[phase];
}

/**
 * Get theme classes for a component
 * Combines multiple theme properties into a single className string
 * 
 * @param phase - The cycle phase
 * @param variant - Which theme variant to use ('card', 'accent', 'muted')
 * @returns Combined className string
 */
export function getPhaseThemeClasses(
  phase: CyclePhase,
  variant: 'card' | 'accent' | 'muted' = 'card'
): string {
  const theme = PHASE_THEMES[phase];
  
  switch (variant) {
    case 'accent':
      return `${theme.bg.accent} ${theme.border.accent} ${theme.text.accent}`;
    case 'muted':
      return `${theme.bg.muted} ${theme.border.muted}`;
    case 'card':
    default:
      return `${theme.bg.secondary} ${theme.border.primary}`;
  }
}

