/**
 * Print colours and constants shared by the clinical summary PDF and its charts.
 * Print-safe hex values (like the recharts code), darker than the app's on-screen
 * shades for contrast on paper; every coloured series also has a text label.
 */

import type { CyclePhase } from '@/lib/cycle-calculator';

export const PDF_COLORS = {
  ink: '#111827', // gray-900
  muted: '#4b5563', // gray-600
  faint: '#6b7280', // gray-500
  rule: '#d1d5db', // gray-300
  grid: '#e5e7eb', // gray-200
  soft: '#f3f4f6', // gray-100
  brand: '#0369a1', // primary-700
  brandSoft: '#e0f2fe', // primary-100
  white: '#ffffff',
} as const;

/** Darker (700) phase colours than the app's 500s, for contrast on paper. */
export const PDF_PHASE_COLORS: Record<CyclePhase, string> = {
  menstrual: '#be123c', // rose-700
  follicular: '#a21caf', // fuchsia-700
  ovulation: '#b45309', // amber-700
  luteal: '#4338ca', // indigo-700
};

/** Content width of an A4 page with 40 pt side margins. */
export const PDF_CONTENT_WIDTH = 515;

export const REPORT_DISCLAIMER =
  'Generated from self-reported data; not a diagnosis.';
