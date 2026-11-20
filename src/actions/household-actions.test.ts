import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  inviteMember: vi.fn(),
}));

vi.mock('next/headers', () => ({ headers: async () => new Headers() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/auth', () => ({ auth: { api: {} } }));
vi.mock('@/lib/session', () => ({ requireSessionUserId: mocks.session }));
vi.mock('@/lib/active-organization', () => ({
  clearActiveOrganizationCookie: vi.fn(),
  getActiveMembership: vi.fn(),
  setActiveOrganizationCookie: vi.fn(),
  SPACE_NOT_FOUND_ERROR: 'space not found',
}));
vi.mock('@/lib/household-management', () => ({ inviteMember: mocks.inviteMember }));

import { inviteMember } from './household-actions';

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  mocks.session.mockResolvedValue({ ok: true, userId: 'owner-1' });
  mocks.inviteMember.mockResolvedValue({
    ok: true,
    data: { id: 'inv_abc', email: 'coach@club.org', role: 'member', expiresAt: new Date() },
  });
});

describe('inviteMember action', () => {
  it('invites to the space the household page was rendered for', async () => {
    const result = await inviteMember({
      organizationId: 'running-club',
      email: ' Coach@Club.org ',
      role: 'member',
    });
    expect(result).toMatchObject({ success: true, data: { id: 'inv_abc' } });
    expect(mocks.inviteMember).toHaveBeenCalledWith(
      'owner-1',
      { organizationId: 'running-club', email: 'Coach@Club.org', role: 'member' },
      expect.any(Function)
    );
  });

  it.each([undefined, '', '   ', 'x'.repeat(129), 42])(
    'refuses a missing or malformed space id (%s) before touching the database',
    async (organizationId) => {
      const result = await inviteMember({
        organizationId: organizationId as string,
        email: 'coach@club.org',
        role: 'admin',
      });
      expect(result).toEqual({ success: false, error: 'space not found' });
      expect(mocks.inviteMember).not.toHaveBeenCalled();
    }
  );

  it('passes on the refusal for a space the user is not a member of', async () => {
    mocks.inviteMember.mockResolvedValue({ ok: false, error: 'space not found' });
    expect(
      await inviteMember({ organizationId: 'family', email: 'coach@club.org', role: 'admin' })
    ).toEqual({ success: false, error: 'space not found' });
  });

  it('still explains a bad email address', async () => {
    const result = await inviteMember({ organizationId: 'family', email: 'not-an-email' });
    expect(result).toEqual({ success: false, error: 'Please enter a valid email address' });
  });
});
