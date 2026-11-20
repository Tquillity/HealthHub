import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { projectCycleStatus } from '@/lib/cycle-status-sharing';

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) =>
    createElement('a', { href, ...rest }, children),
}));
vi.mock('nuqs', () => ({
  parseAsBoolean: { withDefault: () => ({}) },
  useQueryState: () => [false, () => undefined],
}));

import { SupportStatusCard } from './support-status-card';

const text = (html: string) =>
  html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, ' ');

describe('SupportStatusCard', () => {
  it('says nobody shares with you, not that nobody shares at all', () => {
    // Someone may share with the members who were there before you, and not (yet) with you.
    const html = text(
      renderToStaticMarkup(
        createElement(SupportStatusCard, { organizationName: 'Our home', statuses: [] })
      )
    );
    expect(html).toContain(
      "Nobody in Our home shares their cycle status with you right now. Sharing is always each person's own choice."
    );
    expect(html).not.toContain('is sharing');
  });

  it('lists the statuses shared with you', () => {
    const status = projectCycleStatus(
      {
        id: 'user_robin',
        name: 'Robin Partner',
        level: 'PHASE',
        snapshot: { phase: 'follicular', cycleDay: 8, daysUntilNextPeriod: 21 },
        todayEnergy: null,
        supportMessage: null,
      },
      { focus: 'both', timeOfDay: 'unknown' }
    );
    if (!status) throw new Error('no status');
    const html = text(
      renderToStaticMarkup(
        createElement(SupportStatusCard, { organizationName: 'Our home', statuses: [status] })
      )
    );
    expect(html).toContain('Robin');
    expect(html).not.toContain('Nobody in Our home');
  });
});
