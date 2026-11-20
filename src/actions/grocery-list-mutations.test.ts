import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  writableMembershipIn: vi.fn(),
  itemCreate: vi.fn(),
  itemUpdateMany: vi.fn(),
}));

// Writes go to the space the page showed; the cookie (another tab) is never consulted.
vi.mock('@/lib/active-organization', () => ({
  getWritableMembershipIn: mocks.writableMembershipIn,
}));
vi.mock('@/lib/session', () => ({ requireSessionUserId: mocks.session }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/db', () => ({
  prisma: {
    shoppingListItem: { create: mocks.itemCreate, updateMany: mocks.itemUpdateMany },
  },
}));

import {
  addScaledIngredientsToGroceryList,
  addShoppingItem,
  toggleShoppingItem,
} from './grocery-list-mutations';

const VIEW_ONLY = 'view only';
const NOT_FOUND = 'space not found';

const membershipIn = (organizationId: string) => ({
  ok: true,
  membership: {
    memberId: `member-${organizationId}`,
    organizationId,
    role: 'member',
    organization: { id: organizationId, name: organizationId, type: 'HOUSEHOLD' },
  },
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  mocks.session.mockResolvedValue({ ok: true, userId: 'user-1' });
  mocks.writableMembershipIn.mockImplementation(async (_userId: string, organizationId: string) =>
    membershipIn(organizationId)
  );
  mocks.itemCreate.mockImplementation(async ({ data }) => ({ id: 'item-1', ...data }));
  mocks.itemUpdateMany.mockResolvedValue({ count: 1 });
});

describe('grocery writes follow the space on screen', () => {
  it('adds a manual item to the space the page was rendered for', async () => {
    expect(await addShoppingItem('family', 'Oat milk')).toEqual({ success: true });
    expect(mocks.writableMembershipIn).toHaveBeenCalledWith('user-1', 'family');
    expect(mocks.itemCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ organizationId: 'family', name: 'Oat milk' }),
    });
  });

  it('adds scaled recipe ingredients to that space', async () => {
    const result = await addScaledIngredientsToGroceryList(
      'family',
      [{ name: 'Rice', quantity: 2, unit: 'dl' }],
      'recipe-1'
    );
    expect(result.success).toBe(true);
    expect(mocks.writableMembershipIn).toHaveBeenCalledWith('user-1', 'family');
    expect(mocks.itemCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ organizationId: 'family', sourceRecipeId: 'recipe-1' }),
    });
  });

  it('toggles an item only within that space', async () => {
    expect(await toggleShoppingItem('family', 'item-1', true)).toEqual({ success: true });
    expect(mocks.itemUpdateMany).toHaveBeenCalledWith({
      where: { id: 'item-1', organizationId: 'family' },
      data: { isChecked: true },
    });
  });

  it.each([
    ['a viewer of the space', VIEW_ONLY],
    ['no longer a member of the space', NOT_FOUND],
  ])('writes nothing when the user is %s', async (_case, error) => {
    mocks.writableMembershipIn.mockResolvedValue({ ok: false, error });

    expect(await addShoppingItem('family', 'Pregnancy test')).toEqual({ success: false, error });
    expect(
      await addScaledIngredientsToGroceryList('family', [{ name: 'Rice', quantity: 2, unit: 'dl' }])
    ).toEqual({ success: false, error });
    expect(await toggleShoppingItem('family', 'item-1', true)).toEqual({ success: false, error });
    expect(mocks.itemCreate).not.toHaveBeenCalled();
    expect(mocks.itemUpdateMany).not.toHaveBeenCalled();
  });
});
