import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { findButtons } from '@/components/test-markup';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => {} }) }));
vi.mock('nuqs', () => ({ useQueryState: () => [null, async () => {}] }));
vi.mock('@/actions/organization-actions', () => ({ switchActiveOrganization: vi.fn() }));

import { OrgSwitcher } from './org-switcher';

const organizations = [
  { id: 'org_home', name: 'Home', type: 'HOUSEHOLD' as const, role: 'owner' as const },
  { id: 'org_club', name: 'Run club', type: 'COMMUNITY' as const, role: 'member' as const },
];

describe('OrgSwitcher', () => {
  const html = renderToStaticMarkup(
    createElement(OrgSwitcher, { organizations, activeOrganizationId: 'org_home' })
  );
  const [trigger] = findButtons(html);

  it('is a disclosure button, not a menu button', () => {
    expect(trigger.ariaLabel).toBe('Current space: Home. Switch space');
    expect(trigger.attributes).toContain('aria-expanded="false"');
    // aria-haspopup="true" means "menu", but the list is plain buttons without menu keys.
    expect(trigger.attributes).not.toContain('aria-haspopup');
    expect(html).not.toMatch(/role="menu/);
  });

  it('does not point aria-controls at a list that is not rendered', () => {
    expect(trigger.attributes).not.toContain('aria-controls');
    expect(html).not.toContain('Your spaces');
  });

  it('stays focusable while switching and announces the switch', () => {
    // `disabled` while switching dropped keyboard focus to the top of the page.
    expect(trigger.disabled).toBe(false);
    expect(trigger.attributes).toContain('aria-disabled:opacity-60');
    expect(html).toMatch(/<span role="status" class="sr-only">/);
  });
});
