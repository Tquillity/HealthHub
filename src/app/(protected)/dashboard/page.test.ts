import { isValidElement, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

/**
 * Heading order on the dashboard: the page title (h1) comes before the daily briefing,
 * whose title is an h2 and whose suggestions are h3, so the outline starts at the h1.
 */

const stub = vi.hoisted(() => (name: string) => {
  const component = () => null;
  Object.defineProperty(component, 'name', { value: name });
  return component;
});

vi.mock('next/navigation', () => ({
  redirect: (path: string) => {
    throw new Error(`redirect ${path}`);
  },
}));
vi.mock('@/lib/session', () => ({
  getServerSession: async () => ({ user: { id: 'user_1', name: 'Sam Lee' } }),
}));
vi.mock('@/components/dashboard/daily-briefing-card', () => ({
  DailyBriefingCard: stub('DailyBriefingCard'),
}));
vi.mock('@/components/dashboard/dashboard-quick-actions', () => ({
  DashboardQuickActions: stub('DashboardQuickActions'),
}));
vi.mock('@/components/dashboard/dashboard-health-tip', () => ({
  DashboardHealthTip: stub('DashboardHealthTip'),
}));
vi.mock('@/components/dashboard/dashboard-focus-goal', () => ({
  DashboardFocusGoal: stub('DashboardFocusGoal'),
}));
vi.mock('@/components/dashboard/dashboard-stats', () => ({
  DashboardStats: stub('DashboardStats'),
}));
vi.mock('@/components/dashboard/dashboard-recent-routines', () => ({
  DashboardRecentRoutines: stub('DashboardRecentRoutines'),
}));
vi.mock('@/components/dashboard/vitals-card', () => ({ VitalsCard: stub('VitalsCard') }));

import DashboardPage from './page';

/** Element names in document order: intrinsic tags, and components by name. */
function documentOrder(node: ReactNode, out: string[] = []): string[] {
  if (Array.isArray(node)) {
    for (const child of node) documentOrder(child, out);
    return out;
  }
  if (!isValidElement<{ children?: ReactNode; fallback?: ReactNode }>(node)) return out;
  const type = node.type;
  out.push(typeof type === 'string' ? type : ((type as { name?: string }).name ?? ''));
  documentOrder(node.props.children, out);
  return out;
}

describe('DashboardPage heading order', () => {
  it('renders the page h1 before the daily briefing card', async () => {
    const order = documentOrder(await DashboardPage());
    const h1 = order.indexOf('h1');
    const briefing = order.indexOf('DailyBriefingCard');
    expect(h1).toBeGreaterThan(-1);
    expect(briefing).toBeGreaterThan(h1);
    // No other heading comes before the h1.
    expect(order.slice(0, h1).filter((name) => /^h[1-6]$/.test(name))).toEqual([]);
  });
});
