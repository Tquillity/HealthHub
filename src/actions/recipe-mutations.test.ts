import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const tx = {
    recipe: { create: vi.fn(), update: vi.fn() },
    ingredient: { create: vi.fn(), deleteMany: vi.fn() },
    ingredientAlternative: { createMany: vi.fn() },
    instruction: { createMany: vi.fn(), deleteMany: vi.fn() },
  };
  return {
    tx,
    session: vi.fn(),
    userFindUnique: vi.fn(),
    memberFindFirst: vi.fn(),
    recipeFindUnique: vi.fn(),
    writableMembershipIn: vi.fn(),
    membershipIn: vi.fn(),
  };
});

// The space the form was rendered for decides where a new recipe goes; the recipe's own
// space decides who may edit it. The active-space cookie is not consulted for writes.
vi.mock('@/lib/active-organization', () => ({
  getWritableMembershipIn: mocks.writableMembershipIn,
  getMembershipIn: mocks.membershipIn,
}));

vi.mock('@/lib/session', () => ({ requireSessionUserId: mocks.session }));
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  updateTag: vi.fn(),
}));
vi.mock('@/lib/db', () => ({
  prisma: {
    user: { findUnique: mocks.userFindUnique },
    member: { findFirst: mocks.memberFindFirst },
    recipe: { findUnique: mocks.recipeFindUnique },
    $transaction: (run: (tx: typeof mocks.tx) => Promise<unknown>) =>
      run(mocks.tx),
  },
}));

import { createRecipe, updateRecipe } from './recipe-mutations';

const baseRecipe = {
  name: 'Havrefrallor',
  tags: [],
  dietaryTags: [],
  isSecret: false,
  isPrivate: false,
  isHhChefsVerified: false,
  ingredients: [{ name: 'Havremjöl', quantity: 1050, unit: 'g' }],
  instructions: [{ stepNumber: 1, text: 'Blanda allt.' }],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  mocks.session.mockResolvedValue({ ok: true, userId: 'admin-user' });
  mocks.userFindUnique.mockResolvedValue({ role: 'admin' });
  mocks.memberFindFirst.mockResolvedValue({ organizationId: 'household' });
  const membership = {
    memberId: 'member-1',
    organizationId: 'household',
    role: 'owner',
    organization: { id: 'household', name: 'Home', type: 'HOUSEHOLD' },
  };
  mocks.writableMembershipIn.mockResolvedValue({ ok: true, membership });
  mocks.membershipIn.mockResolvedValue(membership);
  mocks.recipeFindUnique.mockResolvedValue({
    id: 'recipe-1',
    isSecret: false,
    isHhChefsVerified: false,
    isSystem: false,
  });
  mocks.tx.recipe.create.mockResolvedValue({ id: 'recipe-1' });
  mocks.tx.recipe.update.mockResolvedValue({ id: 'recipe-1' });
  mocks.tx.ingredient.create.mockResolvedValue({ id: 'ingredient-1' });
});

describe('createRecipe LEAN fields', () => {
  it('stores validated LEAN fields in canonical casing', async () => {
    const result = await createRecipe('household', {
      ...baseRecipe,
      leanRole: 'infrastructure' as 'Infrastructure',
      activeTime: 35,
      passiveTime: 0,
      yieldAmount: 36,
      yieldUnit: '  frallor ',
      batchEfficiency: 'High',
    });

    expect(result.success).toBe(true);
    expect(mocks.tx.recipe.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        leanRole: 'Infrastructure',
        activeTime: 35,
        passiveTime: 0,
        yieldAmount: 36,
        yieldUnit: 'frallor',
        batchEfficiency: 'High',
      }),
    });
  });

  it('stores null when LEAN fields are left out', async () => {
    await createRecipe('household', baseRecipe);
    expect(mocks.tx.recipe.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        leanRole: null,
        activeTime: null,
        passiveTime: null,
        yieldAmount: null,
        yieldUnit: null,
        batchEfficiency: null,
      }),
    });
  });

  it('rejects an unknown role before touching the database', async () => {
    const result = await createRecipe('household', {
      ...baseRecipe,
      leanRole: 'Batch' as 'Daily',
    });
    expect(result).toEqual({
      success: false,
      error: 'LEAN role must be Infrastructure, Process, Daily or Treat',
    });
    expect(mocks.tx.recipe.create).not.toHaveBeenCalled();
  });

  it('rejects a batch yield without a unit', async () => {
    const result = await createRecipe('household', { ...baseRecipe, yieldAmount: 36 });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/both a batch yield amount and a unit/);
    expect(mocks.tx.recipe.create).not.toHaveBeenCalled();
  });

  it('rejects fractional minutes', async () => {
    const result = await createRecipe('household', { ...baseRecipe, activeTime: 12.5 });
    expect(result.success).toBe(false);
    expect(mocks.tx.recipe.create).not.toHaveBeenCalled();
  });
});

describe('createRecipe space', () => {
  it('files the recipe under the space the form was rendered for', async () => {
    mocks.writableMembershipIn.mockImplementation(async (_userId: string, organizationId: string) => ({
      ok: true,
      membership: {
        memberId: 'member-2',
        organizationId,
        role: 'member',
        organization: { id: organizationId, name: 'Family', type: 'HOUSEHOLD' },
      },
    }));
    const result = await createRecipe('family', baseRecipe);
    expect(result.success).toBe(true);
    expect(mocks.writableMembershipIn).toHaveBeenCalledWith('admin-user', 'family');
    expect(mocks.tx.recipe.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ organizationId: 'family', isSystem: false }),
    });
  });

  it.each([
    ['a viewer of the space', 'view only'],
    ['no longer a member of the space', 'space not found'],
  ])('creates nothing when the user is %s', async (_case, error) => {
    mocks.writableMembershipIn.mockResolvedValue({ ok: false, error });
    expect(await createRecipe('family', baseRecipe)).toEqual({ success: false, error });
    expect(mocks.tx.recipe.create).not.toHaveBeenCalled();
    expect(mocks.tx.ingredient.create).not.toHaveBeenCalled();
  });
});

describe('updateRecipe LEAN fields', () => {
  it('clears LEAN fields sent as null', async () => {
    const result = await updateRecipe({
      id: 'recipe-1',
      leanRole: null,
      activeTime: null,
      passiveTime: null,
      yieldAmount: null,
      yieldUnit: null,
      batchEfficiency: null,
    });

    expect(result.success).toBe(true);
    expect(mocks.tx.recipe.update).toHaveBeenCalledWith({
      where: { id: 'recipe-1' },
      data: expect.objectContaining({
        leanRole: null,
        activeTime: null,
        passiveTime: null,
        yieldAmount: null,
        yieldUnit: null,
        batchEfficiency: null,
      }),
    });
  });

  it('leaves LEAN fields alone when they are not sent', async () => {
    await updateRecipe({ id: 'recipe-1', name: 'Renamed' });
    const { data } = mocks.tx.recipe.update.mock.calls[0][0];
    expect(data.name).toBe('Renamed');
    for (const field of [
      'leanRole',
      'activeTime',
      'passiveTime',
      'yieldAmount',
      'yieldUnit',
      'batchEfficiency',
    ]) {
      expect(data).not.toHaveProperty(field);
    }
  });

  it('updates a single half of the yield in a partial update', async () => {
    const result = await updateRecipe({ id: 'recipe-1', yieldAmount: 24 });
    expect(result.success).toBe(true);
    const { data } = mocks.tx.recipe.update.mock.calls[0][0];
    expect(data.yieldAmount).toBe(24);
    expect(data).not.toHaveProperty('yieldUnit');
  });

  it('rejects a yield that clears the unit but keeps the amount', async () => {
    const result = await updateRecipe({
      id: 'recipe-1',
      yieldAmount: 24,
      yieldUnit: '',
    });
    expect(result.success).toBe(false);
    expect(mocks.tx.recipe.update).not.toHaveBeenCalled();
  });
});

describe('recipe cycle fields', () => {
  it('stores phase tags and nutrient highlights in vocabulary order', async () => {
    const result = await createRecipe('household', {
      ...baseRecipe,
      phaseTags: ['luteal', 'Menstrual' as 'menstrual'],
      nutrientHighlights: ['magnesium', 'iron', 'iron'],
    });

    expect(result.success).toBe(true);
    expect(mocks.tx.recipe.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        phaseTags: ['menstrual', 'luteal'],
        nutrientHighlights: ['iron', 'magnesium'],
      }),
    });
  });

  it('stores empty lists when they are left out', async () => {
    await createRecipe('household', baseRecipe);
    expect(mocks.tx.recipe.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ phaseTags: [], nutrientHighlights: [] }),
    });
  });

  it('rejects values outside the vocabulary before touching the database', async () => {
    const phase = await createRecipe('household', {
      ...baseRecipe,
      phaseTags: ['pms' as 'luteal'],
    });
    expect(phase).toEqual({
      success: false,
      error: 'Cycle phase must be menstrual, follicular, ovulation or luteal',
    });
    const nutrient = await updateRecipe({
      id: 'recipe-1',
      nutrientHighlights: ['vitamin-z' as 'iron'],
    });
    expect(nutrient.success).toBe(false);
    expect(nutrient.error).toMatch(/^Nutrient must be one of: iron, /);
    expect(mocks.tx.recipe.create).not.toHaveBeenCalled();
    expect(mocks.tx.recipe.update).not.toHaveBeenCalled();
  });

  it('updates or clears the lists and leaves them alone when not sent', async () => {
    await updateRecipe({ id: 'recipe-1', phaseTags: ['follicular'], nutrientHighlights: [] });
    expect(mocks.tx.recipe.update.mock.calls[0][0].data).toMatchObject({
      phaseTags: ['follicular'],
      nutrientHighlights: [],
    });

    await updateRecipe({ id: 'recipe-1', name: 'Renamed' });
    const { data } = mocks.tx.recipe.update.mock.calls[1][0];
    expect(data).not.toHaveProperty('phaseTags');
    expect(data).not.toHaveProperty('nutrientHighlights');
  });
});
