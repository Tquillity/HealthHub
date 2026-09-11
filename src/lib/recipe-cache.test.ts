import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  inCache: false,
  session: vi.fn(),
  memberships: vi.fn(),
  user: vi.fn(),
  recipe: vi.fn(),
  recipes: vi.fn(),
}));

vi.mock('@/lib/session', () => ({
  getSessionUserId: () => {
    if (mocks.inCache) throw new Error('Session read inside cache');
    return mocks.session();
  },
}));
vi.mock('@/lib/db', () => ({
  prisma: {
    member: { findMany: mocks.memberships },
    user: { findUnique: mocks.user },
    recipe: { findFirst: mocks.recipe, findMany: mocks.recipes },
  },
}));
vi.mock('next/cache', () => ({
  unstable_cache: <Args extends unknown[], Result>(
    query: (...args: Args) => Promise<Result>
  ) => {
    const values = new Map<string, Result>();
    return async (...args: Args) => {
      const key = JSON.stringify(args);
      if (values.has(key)) return values.get(key);
      mocks.inCache = true;
      try {
        const result = await query(...args);
        values.set(key, result);
        return result;
      } finally {
        mocks.inCache = false;
      }
    };
  },
}));

import { getCachedRecipe, getCachedRecipes } from './recipe-cache';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.inCache = false;
  mocks.session.mockResolvedValue(null);
  mocks.memberships.mockResolvedValue([]);
  mocks.user.mockResolvedValue({ role: 'user' });
  mocks.recipe.mockResolvedValue(null);
  mocks.recipes.mockResolvedValue([]);
});

describe('recipe cache visibility', () => {
  it('reads the guest session outside cache and queries only public system recipes', async () => {
    await getCachedRecipe('guest-example');
    expect(mocks.recipe).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            { id: 'guest-example' },
            { isSystem: true, isSecret: false, isPrivate: false },
          ],
        },
      })
    );
    expect(mocks.memberships).not.toHaveBeenCalled();
  });

  it('includes household membership in the key and drops access after membership removal', async () => {
    mocks.session.mockResolvedValue('member');
    mocks.memberships.mockResolvedValue([
      { organizationId: 'household-a' },
      { organizationId: 'household-b' },
    ]);
    mocks.recipe
      .mockResolvedValueOnce({ id: 'household-example' })
      .mockResolvedValueOnce(null);
    expect((await getCachedRecipe('household-example')).data).toEqual({
      id: 'household-example',
    });
    expect(mocks.recipe).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            { id: 'household-example' },
            {
              AND: [
                {
                  OR: [
                    { isSystem: true },
                    { organizationId: { in: ['household-a', 'household-b'] } },
                  ],
                },
                { isSecret: false },
                { isPrivate: false },
              ],
            },
          ],
        },
      })
    );
    mocks.memberships.mockResolvedValue([]);
    expect((await getCachedRecipe('household-example')).data).toBeNull();
    expect(mocks.recipe).toHaveBeenCalledTimes(2);
  });

  it('does not serve a superadmin cache entry after the role is revoked', async () => {
    mocks.session.mockResolvedValue('admin');
    mocks.user.mockResolvedValue({ role: 'superadmin' });
    mocks.recipe
      .mockResolvedValueOnce({ id: 'secret-example' })
      .mockResolvedValueOnce(null);
    await getCachedRecipe('secret-example');
    mocks.user.mockResolvedValue({ role: 'admin' });
    expect((await getCachedRecipe('secret-example')).data).toBeNull();
    expect(mocks.recipe).toHaveBeenCalledTimes(2);
  });

  it('applies search filters alongside visibility and shares repeated guest reads', async () => {
    await getCachedRecipes({ query: 'lentils', dietaryTags: ['vegan'] });
    await getCachedRecipes({ query: 'lentils', dietaryTags: ['vegan'] });
    expect(mocks.session).toHaveBeenCalledTimes(2);
    expect(mocks.recipes).toHaveBeenCalledTimes(1);
    expect(mocks.recipes).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: expect.arrayContaining([
            { isSystem: true, isSecret: false, isPrivate: false },
            { dietaryTags: { hasSome: ['vegan'] } },
          ]),
        },
      })
    );
  });

  it('propagates database failures instead of caching an empty recipe result', async () => {
    mocks.recipe.mockRejectedValueOnce(new Error('Database unavailable'));
    await expect(getCachedRecipe('db-failure')).rejects.toThrow(
      'Database unavailable'
    );
    await expect(getCachedRecipe('db-failure')).resolves.toEqual({
      success: false,
      data: null,
    });
    expect(mocks.recipe).toHaveBeenCalledTimes(2);
  });
});
