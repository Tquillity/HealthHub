import { APIError } from 'better-auth/api';
import { del } from '@vercel/blob';
import { prisma } from '@/lib/db';
import { cancelProSubscriptions } from '@/lib/account-billing';

/**
 * Account deletion ("Delete account" on the profile page).
 *
 * Better-Auth's `deleteUser` endpoint checks the password (or a fresh session), calls
 * `beforeAccountDeletion`, then deletes the user row. Deleting the row cascades to the
 * rows that hang off the user: sessions, sign-in accounts, household memberships,
 * journal entries, ingredient preferences and timer state.
 *
 * Everything else the user owns lives in households (Better-Auth organizations), which
 * do not cascade from the user, so this module removes it first:
 * - Households where the user is the only member are deleted with all their recipes,
 *   routines, meal plans, templates and grocery items.
 * - Shared households stay with the remaining members. If the user was the owner, the
 *   longest-standing remaining member becomes owner.
 * - Invitations the user sent or received are deleted.
 * - Active HealthHub Pro subscriptions are cancelled, so billing stops.
 * - Uploaded images of deleted recipes and routines are removed from Vercel Blob.
 */

export class AccountDeletionError extends Error {}

export type AccountDeletionContext = {
  /** Email/password accounts confirm with their password; social-only accounts need a fresh sign-in. */
  hasPassword: boolean;
  /** The main admin (superadmin) cannot delete itself from the app. */
  isMainAdmin: boolean;
};

export async function getAccountDeletionContext(
  userId: string
): Promise<AccountDeletionContext> {
  const [credential, user] = await Promise.all([
    prisma.account.findFirst({
      where: { userId, providerId: 'credential', password: { not: null } },
      select: { id: true },
    }),
    prisma.user.findUnique({ where: { id: userId }, select: { role: true } }),
  ]);
  return {
    hasPassword: Boolean(credential),
    isMainAdmin: user?.role === 'superadmin',
  };
}

type DeletableUser = { id: string; email: string };

export type DeletedAccountData = {
  deletedHouseholdIds: string[];
  leftHouseholdIds: string[];
  /** Uploaded images that no remaining recipe or routine uses. */
  orphanedImageUrls: string[];
};

/**
 * Deletes the user's household data in one transaction. Leaves the user row itself to
 * Better-Auth, whose delete cascades to the user's own rows.
 */
export async function deleteAccountData(
  user: DeletableUser
): Promise<DeletedAccountData> {
  return prisma.$transaction(
    async (tx) => {
      const memberships = await tx.member.findMany({
        where: { userId: user.id },
        select: { organizationId: true, role: true },
      });
      const householdIds = memberships.map((m) => m.organizationId);
      const otherMembers = await tx.member.findMany({
        where: {
          organizationId: { in: householdIds },
          userId: { not: user.id },
        },
        select: { id: true, organizationId: true, role: true },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      });
      const sharedIds = new Set(otherMembers.map((m) => m.organizationId));
      const soleIds = householdIds.filter((id) => !sharedIds.has(id));

      // A shared household must keep an owner, or nobody can manage it.
      for (const membership of memberships) {
        if (
          membership.role !== 'owner' ||
          !sharedIds.has(membership.organizationId)
        ) {
          continue;
        }
        const remaining = otherMembers.filter(
          (m) => m.organizationId === membership.organizationId
        );
        if (remaining.some((m) => m.role === 'owner')) continue;
        await tx.member.update({
          where: { id: remaining[0].id },
          data: { role: 'owner' },
        });
      }

      const [recipes, routines] = await Promise.all([
        tx.recipe.findMany({
          where: { organizationId: { in: soleIds }, isSystem: false },
          select: { id: true, imageUrl: true, imageUrls: true },
        }),
        tx.routine.findMany({
          where: { organizationId: { in: soleIds }, isSystem: false },
          select: { id: true, imageUrl: true },
        }),
      ]);
      const recipeIds = recipes.map((r) => r.id);

      // A member of several households can plan a recipe from one in another.
      // Those plan entries would block the delete, and they point at nothing afterwards.
      await tx.mealPlanItem.deleteMany({
        where: { recipeId: { in: recipeIds } },
      });
      await tx.mealPlanTemplateItem.deleteMany({
        where: { recipeId: { in: recipeIds } },
      });
      // Ingredients, instructions and ingredient alternatives cascade from the recipe.
      await tx.recipe.deleteMany({ where: { id: { in: recipeIds } } });
      await tx.routine.deleteMany({
        where: { id: { in: routines.map((r) => r.id) } },
      });
      // Public catalog entries are never deleted along with a household.
      await tx.recipe.updateMany({
        where: { organizationId: { in: soleIds }, isSystem: true },
        data: { organizationId: null },
      });
      await tx.routine.updateMany({
        where: { organizationId: { in: soleIds }, isSystem: true },
        data: { organizationId: null },
      });
      // Meal plans, templates, grocery items, invitations and memberships cascade.
      await tx.organization.deleteMany({ where: { id: { in: soleIds } } });

      await tx.invitation.deleteMany({
        where: {
          OR: [
            { inviterId: user.id },
            { email: { equals: user.email, mode: 'insensitive' } },
          ],
        },
      });
      // Pending password-reset and delete-account tokens carry the user id as value.
      await tx.verification.deleteMany({ where: { value: user.id } });

      const candidateUrls = [
        ...new Set(
          [
            ...recipes.flatMap((r) => [r.imageUrl, ...r.imageUrls]),
            ...routines.map((r) => r.imageUrl),
          ].filter((url): url is string => Boolean(url && isBlobUrl(url)))
        ),
      ];
      const stillUsed = new Set<string>();
      if (candidateUrls.length > 0) {
        const [usedByRecipes, usedByRoutines] = await Promise.all([
          tx.recipe.findMany({
            where: {
              OR: [
                { imageUrl: { in: candidateUrls } },
                { imageUrls: { hasSome: candidateUrls } },
              ],
            },
            select: { imageUrl: true, imageUrls: true },
          }),
          tx.routine.findMany({
            where: { imageUrl: { in: candidateUrls } },
            select: { imageUrl: true },
          }),
        ]);
        for (const r of usedByRecipes) {
          if (r.imageUrl) stillUsed.add(r.imageUrl);
          r.imageUrls.forEach((url) => stillUsed.add(url));
        }
        for (const r of usedByRoutines) {
          if (r.imageUrl) stillUsed.add(r.imageUrl);
        }
      }

      return {
        deletedHouseholdIds: soleIds,
        leftHouseholdIds: [...sharedIds],
        orphanedImageUrls: candidateUrls.filter((url) => !stillUsed.has(url)),
      };
    },
    { timeout: 30_000 }
  );
}

/** Images uploaded through `uploadImage` in production live on Vercel Blob. */
export function isBlobUrl(url: string): boolean {
  try {
    return new URL(url).hostname.endsWith('.blob.vercel-storage.com');
  } catch {
    return false;
  }
}

/** Removes uploaded images. Best effort: the account is already gone if this fails. */
export async function deleteUploadedImages(urls: string[]): Promise<void> {
  if (urls.length === 0 || !process.env.BLOB_READ_WRITE_TOKEN) return;
  try {
    await del(urls);
  } catch (error) {
    console.error(
      '[account deletion] Failed to delete uploaded images:',
      error
    );
  }
}

async function cancelBilling(user: DeletableUser): Promise<void> {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secretKey) return;
  const { default: StripeSdk } = await import('stripe');
  try {
    await cancelProSubscriptions(
      user,
      new StripeSdk(secretKey),
      process.env.STRIPE_PRICE_ID_PRO?.trim()
    );
  } catch (error) {
    console.error('[account deletion] Failed to cancel subscriptions:', error);
    throw new AccountDeletionError(
      "We couldn't cancel your HealthHub Pro subscription, so your account was not deleted. Please try again in a few minutes."
    );
  }
}

/** Better-Auth `user.deleteUser.beforeDelete` hook. Throwing stops the deletion. */
export async function beforeAccountDeletion(user: {
  id: string;
  email: string;
}): Promise<void> {
  try {
    const { isMainAdmin } = await getAccountDeletionContext(user.id);
    if (isMainAdmin) {
      throw new AccountDeletionError(
        'The main admin account cannot be deleted from the app.'
      );
    }
    // Stop billing first: if that fails, nothing has been deleted yet.
    await cancelBilling(user);
    const { orphanedImageUrls } = await deleteAccountData(user);
    await deleteUploadedImages(orphanedImageUrls);
  } catch (error) {
    if (error instanceof AccountDeletionError) {
      throw new APIError('BAD_REQUEST', { message: error.message });
    }
    console.error('[account deletion] Failed:', error);
    throw new APIError('INTERNAL_SERVER_ERROR', {
      message:
        'Something went wrong, so your account was not deleted. Please try again.',
    });
  }
}
