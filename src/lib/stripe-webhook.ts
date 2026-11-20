import { prisma } from '@/lib/db';

export type PremiumChange = { userId: string; isPremium: boolean };

export async function processStripeEvent(
  event: { id: string; type: string },
  premiumChange: PremiumChange | null
): Promise<{ duplicate: boolean }> {
  return prisma.$transaction(async (tx) => {
    const claimed = await tx.stripeWebhookEvent.createMany({
      data: { eventId: event.id, eventType: event.type },
      skipDuplicates: true,
    });
    if (claimed.count === 0) return { duplicate: true };

    if (premiumChange && !premiumChange.isPremium) {
      // Deleting an account cancels its subscription, so the cancellation event can
      // arrive after the user is gone. There is nothing left to downgrade, and failing
      // would make Stripe retry the event for days.
      await tx.user.updateMany({
        where: { id: premiumChange.userId },
        data: { isPremium: false },
      });
    } else if (premiumChange) {
      await tx.user.update({
        where: { id: premiumChange.userId },
        data: { isPremium: premiumChange.isPremium },
      });
    }
    return { duplicate: false };
  });
}
