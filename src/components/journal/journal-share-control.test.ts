import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { findButtons, findTagById } from '@/components/test-markup';

const shareJournalEntry = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => {} }) }));
vi.mock('@/actions/journal-sharing-actions', () => ({ shareJournalEntry }));

import { JournalShareControl } from './journal-share-control';

const targets = [{ id: 'org_home', name: 'Home', type: 'HOUSEHOLD' as const }];

const render = (sharedOrganizationId: string | null) =>
  renderToStaticMarkup(
    createElement(JournalShareControl, { dateKey: '2026-11-20', sharedOrganizationId, targets })
  );

describe('JournalShareControl', () => {
  it('shares only with an explicit Save, not when the select changes', () => {
    const html = render(null);
    const select = findTagById(html, 'journal-share-target');
    expect(select).toBeDefined();
    // Browsing the options with arrow keys must not save, and the select stays focusable.
    expect(select).not.toMatch(/\sdisabled=""/);
    const save = findButtons(html).find((button) => button.text === 'Save');
    expect(save).toBeDefined();
    expect(save?.attributes).toContain('type="button"');
    expect(save?.attributes).toContain('min-h-[44px]');
    // Nothing to save until another choice is picked.
    expect(save?.disabled).toBe(true);
    expect(shareJournalEntry).not.toHaveBeenCalled();
  });

  it('shows the saved choice and announces results in a status region', () => {
    const html = render('org_home');
    expect(html).toMatch(/<option value="org_home" selected="">Share with Home<\/option>/);
    expect(html).toMatch(/<p role="status" class="sr-only">/);
    expect(html).not.toContain('Not saved yet');
  });
});
