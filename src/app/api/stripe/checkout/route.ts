import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/session';
import { isStripeConfigured } from '@/lib/stripe';

/**
 * Creates a Stripe Checkout session for HealthHub Pro.
 * Requires STRIPE_PRICE_ID_PRO and authenticated user.
 */
export async function POST() {
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 });
  }

  const priceId = process.env.STRIPE_PRICE_ID_PRO?.trim();
  if (!priceId) {
    return NextResponse.json({ error: 'Pro price not configured' }, { status: 503 });
  }

  const session = await getServerSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const baseUrl = process.env.BETTER_AUTH_URL ?? process.env.NEXT_PUBLIC_BETTER_AUTH_URL;
  if (!baseUrl) {
    return NextResponse.json({ error: 'Missing app URL' }, { status: 503 });
  }

  try {
    const { default: Stripe } = await import('stripe');
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
    const checkout = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${baseUrl}/pro?checkout=success`,
      cancel_url: `${baseUrl}/pro?checkout=cancel`,
      client_reference_id: session.user.id,
      metadata: { userId: session.user.id },
    });

    if (!checkout.url) {
      return NextResponse.json({ error: 'No checkout URL' }, { status: 500 });
    }

    return NextResponse.json({ url: checkout.url });
  } catch (error) {
    console.error('[HealthHub stripe] checkout session failed:', error);
    return NextResponse.json({ error: 'Checkout failed' }, { status: 500 });
  }
}
