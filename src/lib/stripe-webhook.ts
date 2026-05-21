import { prisma } from '@/lib/db';

export async function isStripeEventProcessed(eventId: string): Promise<boolean> {
  const row = await prisma.stripeWebhookEvent.findUnique({
    where: { eventId },
    select: { id: true },
  });
  return Boolean(row);
}

export async function markStripeEventProcessed(
  eventId: string,
  eventType: string
): Promise<void> {
  await prisma.stripeWebhookEvent.create({
    data: { eventId, eventType },
  });
}

export async function setUserPremium(userId: string, isPremium: boolean): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { isPremium },
  });
}
