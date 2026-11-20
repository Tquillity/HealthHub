import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { findButtons, findTagById } from '@/components/test-markup';

const actions = vi.hoisted(() => ({
  updateMemberRole: vi.fn(),
  removeMember: vi.fn(),
  transferOwnership: vi.fn(),
  deleteInvitation: vi.fn(),
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => {} }) }));
vi.mock('@/actions/household-actions', () => actions);

import { MemberList } from './member-list';
import { PendingInvitations } from './pending-invitations';
import { CopyInviteLinkButton } from './copy-invite-link-button';

const members = [
  {
    id: 'mem_owner',
    userId: 'user_owner',
    name: 'Sam',
    email: 'sam@example.com',
    image: null,
    role: 'owner' as const,
    joinedAt: new Date('2026-01-01T00:00:00Z'),
  },
  {
    id: 'mem_alex',
    userId: 'user_alex',
    name: 'Alex',
    email: 'alex@example.com',
    image: null,
    role: 'admin' as const,
    joinedAt: new Date('2026-01-02T00:00:00Z'),
  },
];

const renderMemberList = () =>
  renderToStaticMarkup(
    createElement(MemberList, {
      members,
      currentUserId: 'user_owner',
      currentUserRole: 'owner',
      organizationName: 'Home',
    })
  );

/** WCAG 2.5.3: a voice-control user says the visible text, so the name must start with it. */
function expectLabelsStartWithVisibleText(html: string) {
  const labelled = findButtons(html).filter((button) => button.ariaLabel !== undefined);
  expect(labelled.length).toBeGreaterThan(0);
  for (const button of labelled) {
    expect(button.text).not.toBe('');
    expect(button.ariaLabel?.startsWith(button.text), `${button.ariaLabel} / ${button.text}`).toBe(
      true
    );
  }
}

describe('MemberList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('changes a role only with an explicit Save, not on select change', () => {
    const html = renderMemberList();
    const select = findTagById(html, 'member-role-1');
    expect(select).toBeDefined();
    // The select stays usable (disabling it while saving dropped keyboard focus) ...
    expect(select).not.toMatch(/\sdisabled=""/);
    // ... and saving is a separate 44px button, idle until another role is picked.
    const save = findButtons(html).find((button) => button.ariaLabel === 'Save role for Alex');
    expect(save).toBeDefined();
    expect(save?.text).toBe('Save');
    expect(save?.attributes).toContain('type="button"');
    expect(save?.attributes).toContain('min-h-[44px]');
    expect(save?.disabled).toBe(true);
    expect(actions.updateMemberRole).not.toHaveBeenCalled();
  });

  it('announces results in a status region', () => {
    expect(renderMemberList()).toMatch(/<p role="status" class="sr-only">/);
  });

  it('gives buttons accessible names that start with their visible text', () => {
    const html = renderMemberList();
    expect(findButtons(html).map((button) => button.ariaLabel)).toEqual(
      expect.arrayContaining(['Make owner: Alex', 'Remove Alex'])
    );
    expectLabelsStartWithVisibleText(html);
  });
});

describe('PendingInvitations', () => {
  it('gives buttons accessible names that start with their visible text', () => {
    const html = renderToStaticMarkup(
      createElement(PendingInvitations, {
        invitations: [
          {
            id: 'inv_1',
            email: 'pat@example.com',
            role: 'member',
            expiresAt: new Date('2026-12-01T00:00:00Z'),
          },
        ],
      })
    );
    expect(findButtons(html).map((button) => button.ariaLabel)).toEqual(
      expect.arrayContaining(['Copy link for pat@example.com', 'Cancel invite for pat@example.com'])
    );
    expectLabelsStartWithVisibleText(html);
  });
});

describe('CopyInviteLinkButton', () => {
  it('names the button after its visible text', () => {
    const html = renderToStaticMarkup(
      createElement(CopyInviteLinkButton, { path: '/invite/inv_1', email: 'pat@example.com' })
    );
    expect(findButtons(html)).toMatchObject([
      { text: 'Copy link', ariaLabel: 'Copy link for pat@example.com' },
    ]);
  });
});
