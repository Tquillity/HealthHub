import { NextResponse } from 'next/server';
import { findPaymentRetrySubscription } from '@/lib/billing-notice';
import { getServerSession } from '@/lib/session';
import { isStripeConfigured } from '@/lib/stripe';

/**
 * Sends a user whose Pro payment failed to Stripe to fix it: the billing portal (update the
 * card), or the unpaid invoice's own page when the portal is not set up in the Stripe account.
 */
export async function POST() {
  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: 'Stripe not configured' },
      { status: 503 }
    );
  }

  const session = await getServerSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const baseUrl =
    process.env.BETTER_AUTH_URL ?? process.env.NEXT_PUBLIC_BETTER_AUTH_URL;
  if (!baseUrl) {
    return NextResponse.json({ error: 'Missing app URL' }, { status: 503 });
  }

  try {
    const found = await findPaymentRetrySubscription(session.user.id);
    if (!found) {
      return NextResponse.json(
        { error: 'No payment needs your attention right now.' },
        { status: 404 }
      );
    }
    const { stripe, subscription } = found;
    const customerId =
      typeof subscription.customer === 'string'
        ? subscription.customer
        : subscription.customer.id;

    try {
      const portal = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: `${baseUrl.replace(/\/+$/, '')}/dashboard`,
      });
      return NextResponse.json({ url: portal.url });
    } catch (portalError) {
      // The portal needs a one-time setup in the Stripe Dashboard; fall back to the invoice page.
      console.warn(
        '[HealthHub stripe] Billing portal unavailable, using the invoice page:',
        portalError instanceof Error ? portalError.message : portalError
      );
    }

    const invoiceId =
      typeof subscription.latest_invoice === 'string'
        ? subscription.latest_invoice
        : subscription.latest_invoice?.id;
    const invoice = invoiceId
      ? await stripe.invoices.retrieve(invoiceId)
      : null;
    if (invoice?.hosted_invoice_url) {
      return NextResponse.json({ url: invoice.hosted_invoice_url });
    }
    return NextResponse.json(
      { error: 'Could not open the payment page' },
      { status: 500 }
    );
  } catch (error) {
    console.error('[HealthHub stripe] portal:', error);
    return NextResponse.json(
      { error: 'Could not open the payment page' },
      { status: 500 }
    );
  }
}
