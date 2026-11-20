import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  activeMembership: vi.fn(),
  userFindUnique: vi.fn(),
}));

vi.mock('@/lib/active-organization', () => ({
  getActiveMembership: mocks.activeMembership,
}));
vi.mock('@/lib/db', () => ({
  prisma: { user: { findUnique: mocks.userFindUnique } },
}));

import { buildRecipeVisibilityFilter } from './recipe-shared';

const householdIds = (filter: unknown) =>
  JSON.stringify(filter).match(/"in":\[[^\]]*\]/g) ?? [];

beforeEach(() => {
  vi.clearAllMocks();
  mocks.activeMembership.mockResolvedValue({ organizationId: 'office' });
  mocks.userFindUnique.mockResolvedValue({ role: 'user' });
});

describe('buildRecipeVisibilityFilter', () => {
  it('shows the active space recipes by default', async () => {
    const filter = await buildRecipeVisibilityFilter('user-1');
    expect(householdIds(filter)).toEqual(['"in":["office"]']);
  });

  it('uses the space a write targets instead of the cookie', async () => {
    const filter = await buildRecipeVisibilityFilter('user-1', 'family');
    expect(householdIds(filter)).toEqual(['"in":["family"]']);
    expect(mocks.activeMembership).not.toHaveBeenCalled();
  });

  it('shows only public system recipes to signed-out visitors', async () => {
    expect(await buildRecipeVisibilityFilter(null, 'family')).toEqual({
      isSystem: true,
      isSecret: false,
      isPrivate: false,
    });
  });
});
