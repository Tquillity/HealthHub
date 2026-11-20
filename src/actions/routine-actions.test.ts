import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  activeMembership: vi.fn(),
  membershipIn: vi.fn(),
  writableMembershipIn: vi.fn(),
  routineCreate: vi.fn(),
  routineFindFirst: vi.fn(),
  routineFindMany: vi.fn(),
  routineUpdate: vi.fn(),
  routineDelete: vi.fn(),
}));

// The routines page sends the space it shows; the cookie (another tab) is never consulted.
vi.mock('@/lib/active-organization', () => ({
  getActiveMembership: mocks.activeMembership,
  getMembershipIn: mocks.membershipIn,
  getWritableMembershipIn: mocks.writableMembershipIn,
  SPACE_NOT_FOUND_ERROR: 'space not found',
}));
vi.mock('@/lib/session', () => ({ requireSessionUserId: mocks.session }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/db', () => ({
  prisma: {
    routine: {
      create: mocks.routineCreate,
      findFirst: mocks.routineFindFirst,
      findMany: mocks.routineFindMany,
      update: mocks.routineUpdate,
      delete: mocks.routineDelete,
    },
  },
}));

import { createRoutine, deleteRoutine, drawLottery, updateRoutine } from './routine-actions';

const membership = (organizationId: string) => ({
  memberId: `member-${organizationId}`,
  organizationId,
  role: 'member',
  organization: { id: organizationId, name: organizationId, type: 'HOUSEHOLD' },
});

const writes = [
  ['createRoutine', () => createRoutine('family', { name: 'Evening walk' })],
  ['updateRoutine', () => updateRoutine('family', { id: 'routine-1', name: 'Morning walk' })],
  ['deleteRoutine', () => deleteRoutine('family', 'routine-1')],
] as const;

const dbWrites = [mocks.routineCreate, mocks.routineFindFirst, mocks.routineUpdate, mocks.routineDelete];

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  mocks.session.mockResolvedValue({ ok: true, userId: 'user-1' });
  // The cookie names another space than the page the user is looking at.
  mocks.activeMembership.mockResolvedValue(membership('office'));
  mocks.membershipIn.mockImplementation(async (_userId: string, organizationId: string) =>
    membership(organizationId)
  );
  mocks.writableMembershipIn.mockImplementation(async (_userId: string, organizationId: string) => ({
    ok: true,
    membership: membership(organizationId),
  }));
  mocks.routineCreate.mockResolvedValue({ id: 'routine-2' });
  mocks.routineFindFirst.mockResolvedValue({ id: 'routine-1', organizationId: 'family' });
  mocks.routineFindMany.mockResolvedValue([{ id: 'routine-1', name: 'Walk' }]);
  mocks.routineUpdate.mockResolvedValue({ id: 'routine-1' });
  mocks.routineDelete.mockResolvedValue({ id: 'routine-1' });
});

describe('routine writes follow the space on screen', () => {
  it('creates the routine in the space the page showed', async () => {
    expect(await createRoutine('family', { name: 'Evening walk' })).toMatchObject({ success: true });
    expect(mocks.writableMembershipIn).toHaveBeenCalledWith('user-1', 'family');
    expect(mocks.routineCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ name: 'Evening walk', organizationId: 'family' }),
    });
  });

  it.each([
    ['updateRoutine', () => updateRoutine('family', { id: 'routine-1', name: 'Morning walk' })],
    ['deleteRoutine', () => deleteRoutine('family', 'routine-1')],
  ])('%s only finds routines of that space', async (_name, run) => {
    expect(await run()).toMatchObject({ success: true });
    expect(mocks.writableMembershipIn).toHaveBeenCalledWith('user-1', 'family');
    expect(mocks.routineFindFirst).toHaveBeenCalledWith({
      where: { id: 'routine-1', organizationId: 'family' },
    });
  });

  describe.each([
    ['a viewer of the space', 'view only'],
    ['no longer a member of the space', 'space not found'],
  ])('when the user is %s', (_case, error) => {
    it.each(writes)('%s writes nothing', async (_name, run) => {
      mocks.writableMembershipIn.mockResolvedValue({ ok: false, error });
      expect(await run()).toEqual({ success: false, error });
      for (const mock of dbWrites) expect(mock).not.toHaveBeenCalled();
    });
  });
});

describe('drawLottery follows the space on screen', () => {
  it('draws from the space the page showed, not the cookie', async () => {
    const result = await drawLottery('family', { energy: 'low', count: 1 });
    expect(result.success).toBe(true);
    expect(mocks.membershipIn).toHaveBeenCalledWith('user-1', 'family');
    expect(mocks.activeMembership).not.toHaveBeenCalled();
    expect(mocks.routineFindMany).toHaveBeenCalledWith({
      where: expect.objectContaining({ OR: [{ organizationId: 'family' }, { isSystem: true }] }),
    });
  });

  it('lets viewers draw (read-only) but refuses non-members and malformed ids', async () => {
    mocks.membershipIn.mockResolvedValueOnce({ ...membership('family'), role: 'viewer' });
    expect((await drawLottery('family', {})).success).toBe(true);

    mocks.membershipIn.mockResolvedValueOnce(null);
    expect(await drawLottery('family', {})).toEqual({
      success: false,
      error: 'space not found',
      data: null,
    });

    mocks.membershipIn.mockClear();
    mocks.routineFindMany.mockClear();
    expect(await drawLottery('', {})).toMatchObject({ success: false, error: 'space not found' });
    expect(mocks.membershipIn).not.toHaveBeenCalled();
    expect(mocks.routineFindMany).not.toHaveBeenCalled();
  });
});
