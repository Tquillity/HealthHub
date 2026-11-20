import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const url = process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL) : null;
const isolated = Boolean(
  url &&
  ['localhost', '127.0.0.1'].includes(url.hostname) &&
  url.pathname === '/healthhub_e2e'
);

describe.skipIf(!isolated)(
  'account deletion against isolated PostgreSQL',
  () => {
    const run = randomUUID().slice(0, 8);
    const leaving = {
      id: `del-leaving-${run}`,
      email: `Leaving-${run}@Example.com`,
    };
    const staying = {
      id: `del-staying-${run}`,
      email: `staying-${run}@example.com`,
    };
    const personal = `del-personal-${run}`;
    const shared = `del-shared-${run}`;
    const other = `del-other-${run}`;
    const blob = (name: string) =>
      `https://abc123.public.blob.vercel-storage.com/recipes/${name}-${run}.jpg`;
    let pool: Pool;
    let client: PrismaClient;
    let deleteAccountData: (typeof import('./account-deletion'))['deleteAccountData'];

    beforeAll(async () => {
      pool = new Pool({ connectionString: process.env.DATABASE_URL });
      client = new PrismaClient({ adapter: new PrismaPg(pool) });
      ({ deleteAccountData } = await import('./account-deletion'));

      for (const u of [leaving, staying]) {
        await client.user.create({ data: { ...u, name: u.id } });
      }
      for (const id of [personal, shared, other]) {
        await client.organization.create({ data: { id, name: id, slug: id } });
      }
      await client.member.createMany({
        data: [
          {
            id: `m1-${run}`,
            organizationId: personal,
            userId: leaving.id,
            role: 'owner',
          },
          {
            id: `m2-${run}`,
            organizationId: shared,
            userId: leaving.id,
            role: 'owner',
          },
          {
            id: `m3-${run}`,
            organizationId: shared,
            userId: staying.id,
            role: 'member',
          },
          {
            id: `m4-${run}`,
            organizationId: other,
            userId: staying.id,
            role: 'owner',
          },
        ],
      });

      // Personal household content, including a catalog recipe filed under it.
      await client.recipe.create({
        data: {
          id: `r-personal-${run}`,
          name: 'Personal recipe',
          organizationId: personal,
          imageUrl: blob('only-here'),
          imageUrls: [blob('also-elsewhere')],
          ingredients: { create: [{ name: 'Oats', quantity: 1, unit: 'cup' }] },
          instructions: { create: [{ stepNumber: 1, text: 'Mix' }] },
        },
      });
      await client.recipe.create({
        data: {
          id: `r-system-${run}`,
          name: 'Catalog recipe',
          organizationId: personal,
          isSystem: true,
        },
      });
      await client.routine.create({
        data: {
          id: `rt-personal-${run}`,
          name: 'Routine',
          organizationId: personal,
        },
      });
      await client.mealPlan.create({
        data: {
          id: `mp-personal-${run}`,
          organizationId: personal,
          startDate: new Date('2026-01-05'),
          endDate: new Date('2026-01-11'),
          items: {
            create: [
              {
                recipeId: `r-personal-${run}`,
                date: new Date('2026-01-05'),
                mealType: 'dinner',
              },
            ],
          },
        },
      });
      await client.shoppingListItem.create({
        data: {
          organizationId: personal,
          name: 'Milk',
          quantity: 1,
          unit: 'l',
        },
      });

      // Shared household content stays.
      await client.recipe.create({
        data: {
          id: `r-shared-${run}`,
          name: 'Shared recipe',
          organizationId: shared,
          imageUrl: blob('also-elsewhere'),
        },
      });

      // Another household planned the personal recipe.
      await client.mealPlan.create({
        data: {
          id: `mp-other-${run}`,
          organizationId: other,
          startDate: new Date('2026-01-05'),
          endDate: new Date('2026-01-11'),
          items: {
            create: [
              {
                recipeId: `r-personal-${run}`,
                date: new Date('2026-01-06'),
                mealType: 'lunch',
              },
            ],
          },
        },
      });

      await client.invitation.createMany({
        data: [
          {
            id: `inv-sent-${run}`,
            organizationId: shared,
            email: `friend-${run}@example.com`,
            status: 'pending',
            expiresAt: new Date('2099-01-01'),
            inviterId: leaving.id,
          },
          {
            id: `inv-received-${run}`,
            organizationId: other,
            email: leaving.email.toLowerCase(),
            status: 'pending',
            expiresAt: new Date('2099-01-01'),
            inviterId: staying.id,
          },
        ],
      });
      await client.journalEntry.create({
        data: { userId: leaving.id, date: new Date('2026-01-05'), mood: 7 },
      });
    });

    afterAll(async () => {
      await client.organization.deleteMany({
        where: { id: { in: [personal, shared, other] } },
      });
      await client.recipe.deleteMany({
        where: { id: { in: [`r-system-${run}`, `r-shared-${run}`] } },
      });
      await client.user.deleteMany({
        where: { id: { in: [leaving.id, staying.id] } },
      });
      await client.$disconnect();
      await pool.end();
    });

    it('removes sole-member households and keeps shared ones', async () => {
      const result = await deleteAccountData(leaving);

      expect(result.deletedHouseholdIds).toEqual([personal]);
      expect(result.leftHouseholdIds).toEqual([shared]);
      // The shared recipe still uses one of the images.
      expect(result.orphanedImageUrls).toEqual([blob('only-here')]);

      expect(
        await client.organization.findUnique({ where: { id: personal } })
      ).toBeNull();
      expect(
        await client.recipe.findUnique({ where: { id: `r-personal-${run}` } })
      ).toBeNull();
      expect(
        await client.ingredient.count({
          where: { recipeId: `r-personal-${run}` },
        })
      ).toBe(0);
      expect(
        await client.routine.findUnique({ where: { id: `rt-personal-${run}` } })
      ).toBeNull();
      expect(
        await client.shoppingListItem.count({
          where: { organizationId: personal },
        })
      ).toBe(0);
      expect(
        await client.mealPlan.findUnique({
          where: { id: `mp-personal-${run}` },
        })
      ).toBeNull();

      // Catalog content is detached, not deleted.
      const catalog = await client.recipe.findUnique({
        where: { id: `r-system-${run}` },
      });
      expect(catalog).toMatchObject({ isSystem: true, organizationId: null });

      // The other household keeps its plan, minus the entry for the deleted recipe.
      expect(
        await client.mealPlanItem.count({
          where: { mealPlanId: `mp-other-${run}` },
        })
      ).toBe(0);
      expect(
        await client.mealPlan.findUnique({ where: { id: `mp-other-${run}` } })
      ).not.toBeNull();

      // The shared household keeps its content and gets a new owner.
      expect(
        await client.recipe.findUnique({ where: { id: `r-shared-${run}` } })
      ).not.toBeNull();
      expect(
        await client.member.findUnique({ where: { id: `m3-${run}` } })
      ).toMatchObject({ role: 'owner' });

      expect(
        await client.invitation.count({
          where: { id: { in: [`inv-sent-${run}`, `inv-received-${run}`] } },
        })
      ).toBe(0);
    });

    it('leaves the rest to the user delete cascade', async () => {
      await client.user.delete({ where: { id: leaving.id } });
      expect(
        await client.journalEntry.count({ where: { userId: leaving.id } })
      ).toBe(0);
      expect(await client.member.count({ where: { userId: leaving.id } })).toBe(
        0
      );
      expect(
        await client.member.count({ where: { organizationId: shared } })
      ).toBe(1);
    });
  }
);
