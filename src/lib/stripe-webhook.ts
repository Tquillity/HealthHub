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

    if (premiumChange) {
      await tx.user.update({
        where: { id: premiumChange.userId },
        data: { isPremium: premiumChange.isPremium },
      });
    }
    return { duplicate: false };
  });
}
