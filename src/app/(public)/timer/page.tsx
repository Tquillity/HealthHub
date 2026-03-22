import type { Metadata } from 'next';
import { TimerPageClient } from '@/components/timer/timer-page-client';

export const metadata: Metadata = {
  title: 'Focus Timer',
  description:
    'A free Pomodoro timer with offline-friendly task tracking, ambient audio, and customizable focus sessions.',
};

export default function TimerPage() {
  return <TimerPageClient />;
}
