import type { Metadata } from 'next';
import { TimerPageClient } from '@/components/timer/timer-page-client';
import { createPageMetadata } from '@/lib/site-metadata';

export const metadata: Metadata = createPageMetadata({
  title: 'Focus Timer',
  description:
    'Free Pomodoro timer with offline-friendly sessions, ambient audio, task tracking, and customizable focus intervals.',
  path: '/timer',
});

export default function TimerPage() {
  return <TimerPageClient />;
}
