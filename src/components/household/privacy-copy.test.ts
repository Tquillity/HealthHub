import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { OrganizationType } from '@prisma/client';
import type { CycleShareHousehold, OwnCycleShare, SharedLevel } from '@/lib/cycle-status-sharing';

/**
 * What the invitation and household screens say about the journal and cycle (finding 10 of
 * the partner sync review). Consent for cycle status is per household and starts at nothing,
 * so joining shares nothing, and the household page states what you actually share there.
 */

const mocks = vi.hoisted(() => ({
  sessionUserId: vi.fn(),
  invitationForUser: vi.fn(),
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) =>
    createElement('a', { href, ...rest }, children),
}));
vi.mock('@/lib/session', () => ({ getSessionUserId: mocks.sessionUserId }));
vi.mock('@/lib/household-management', () => ({ getInvitationForUser: mocks.invitationForUser }));
vi.mock('@/components/household/invitation-response', () => ({
  InvitationResponse: () => createElement('div', { 'data-stub': 'InvitationResponse' }),
}));

import { OrgPrivacyCard } from './org-privacy-card';
import { InvitationsForYou } from './invitations-for-you';
import InvitePage from '@/app/(public)/invite/[id]/page';

const text = (html: string) =>
  html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ');

const JOINING_SHARES_NOTHING = 'Joining shares nothing from your journal or cycle.';

describe('OrgPrivacyCard', () => {
  const robin = { name: 'Robin Partner', seesStatus: true };
  const carol = { name: 'Carol Later', seesStatus: false };
  const shareOf = (
    level: SharedLevel | null,
    members: CycleShareHousehold['members'] = [robin],
    cycleConfigured = true
  ): OwnCycleShare => ({
    household: {
      id: 'org_home',
      name: 'Our home',
      share: level && { level, coversMembersJoinedBy: '2026-11-01T00:00:00.000Z' },
      members,
      listedMembersJoinedBy: '2026-11-01T00:00:00.000Z',
    },
    cycleConfigured,
  });
  const render = (type: OrganizationType, yourCycleShare?: OwnCycleShare | null) =>
    text(renderToStaticMarkup(createElement(OrgPrivacyCard, { type, yourCycleShare })));

  it('says you share your cycle status with this household, at which level and who sees it', () => {
    const html = render('HOUSEHOLD', shareOf('ENERGY'));
    expect(html).toContain(
      'You share your cycle status with this household: Phase and energy. Seen by Robin Partner.'
    );
    expect(html).toContain('Change or stop it in Profile');
    expect(html).not.toContain('Private.');
  });

  it('does not suggest that members who joined later see the share', () => {
    expect(render('HOUSEHOLD', shareOf('PHASE', [robin, carol]))).toContain(
      'Phase only. Seen by Robin Partner. Carol Later joined later and sees nothing until you include them.'
    );
    // Shared before the partner joined: nobody there sees it.
    expect(render('HOUSEHOLD', shareOf('FULL', [carol]))).toContain(
      'Full status. Nobody here sees it yet. Carol Later joined later and sees nothing until you include them.'
    );
    expect(render('HOUSEHOLD', shareOf('FULL', []))).toContain(
      'Full status. Nobody else is in this household yet. People who join later see nothing until you include them.'
    );
  });

  it('says nobody sees the share while cycle tracking is not set up', () => {
    const html = render('HOUSEHOLD', shareOf('FULL', [robin], false));
    expect(html).toContain(
      'Full status. Nobody sees it until cycle tracking and your last period date are set.'
    );
    expect(html).not.toContain('Seen by');
  });

  it('calls the cycle private in a household only when you do not share it there', () => {
    for (const share of [undefined, null, shareOf(null)]) {
      const html = render('HOUSEHOLD', share);
      expect(html).toContain(
        'Private. You can share a single journal day, or your cycle status, with this household, and stop any time.'
      );
      expect(html).not.toContain('You share your cycle status');
    }
  });

  it('links to the cycle sharing settings with a full-size target', () => {
    const html = renderToStaticMarkup(
      createElement(OrgPrivacyCard, { type: 'HOUSEHOLD', yourCycleShare: shareOf('FULL') })
    );
    const link = html.match(/<a[^>]*href="\/profile#cycle-sharing"[^>]*>/)?.[0];
    expect(link).toBeDefined();
    expect(link).toContain('min-h-[44px]');
  });

  it('never claims a share where cycle status is not shown', () => {
    for (const type of ['COLLECTIVE', 'COMMUNITY', 'CORPORATE'] as const) {
      const html = render(type, shareOf('FULL'));
      expect(html).not.toContain('You share your cycle status');
      expect(html).not.toContain('/profile#cycle-sharing');
    }
    expect(render('COLLECTIVE')).toContain('Cycle status is only ever shown to households.');
    expect(render('CORPORATE')).toContain("Nobody here can see anyone's journal or cycle.");
  });
});

describe('InvitationsForYou', () => {
  it('says what joining shares for each invitation', () => {
    const html = text(
      renderToStaticMarkup(
        createElement(InvitationsForYou, {
          invitations: [
            {
              id: 'inv_home',
              organizationName: 'Our home',
              organizationType: 'HOUSEHOLD',
              role: 'member',
              inviterName: 'Robin',
              expiresAt: new Date('2026-12-01T00:00:00Z'),
            },
            {
              id: 'inv_work',
              organizationName: 'Work team',
              organizationType: 'CORPORATE',
              role: 'member',
              inviterName: null,
              expiresAt: new Date('2026-12-01T00:00:00Z'),
            },
          ],
        })
      )
    );
    expect(html.split(JOINING_SHARES_NOTHING)).toHaveLength(3);
    expect(html).toContain('or your cycle status, with this household.');
    expect(html).toContain("Nobody here can see anyone's journal or cycle.");
  });
});

describe('invite page', () => {
  const invitation = (organizationType: OrganizationType) => ({
    ok: true,
    data: {
      id: 'inv_12345678',
      organizationName: 'Our home',
      organizationType,
      role: 'member',
      inviterName: 'Robin',
      expiresAt: new Date('2026-12-01T00:00:00Z'),
      alreadyMember: false,
    },
  });

  const renderPage = async () =>
    text(
      renderToStaticMarkup(await InvitePage({ params: Promise.resolve({ id: 'inv_12345678' }) }))
    );

  beforeEach(() => {
    mocks.sessionUserId.mockResolvedValue('user_me');
  });

  it('says joining a household shares nothing, and that cycle status is a separate choice', async () => {
    mocks.invitationForUser.mockResolvedValue(invitation('HOUSEHOLD'));
    const html = await renderPage();
    expect(mocks.invitationForUser).toHaveBeenCalledWith('user_me', 'inv_12345678');
    expect(html).toContain(
      `${JOINING_SHARES_NOTHING} Both stay private unless you choose to share a journal day, or your cycle status, with this household.`
    );
    expect(html).not.toContain('day by day');
  });

  it('says cycle status is never shown in a collective', async () => {
    mocks.invitationForUser.mockResolvedValue(invitation('COLLECTIVE'));
    expect(await renderPage()).toContain('your cycle status is never shown here.');
  });
});
