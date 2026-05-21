import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ProCheckoutButton } from '@/components/pro/pro-checkout-button';
import { isStripeConfigured } from '@/lib/stripe';
import { ArrowRight, Timer, Sparkles } from 'lucide-react';

export const metadata: Metadata = {
  title: 'HealthHub Pro — Coming Soon',
  description:
    'HealthHub Pro is coming soon. Core wellness tools stay free — timer, recipes, Learn, and account features.',
};

const plannedBenefits = [
  {
    title: 'Ad-free experience',
    description:
      'Optional upgrade to use recipes, meal planning, and learning tools without display ads.',
  },
  {
    title: 'Cloud timer sync',
    description:
      'Back up Pomodoro progress across devices. The timer remains local-first and works offline today.',
  },
  {
    title: 'Priority support',
    description: 'Faster help when you need it for household wellness workflows.',
  },
  {
    title: 'Early access',
    description: 'Try new features before they roll out to everyone.',
  },
];

export default function ProPage() {
  const checkoutEnabled = isStripeConfigured() && Boolean(process.env.STRIPE_PRICE_ID_PRO?.trim());

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <p className="text-sm font-medium text-primary-600">Premium</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-900">
        HealthHub Pro
      </h1>
      <p className="mt-2 text-lg text-gray-600">
        Coming soon — an optional upgrade, not required to use HealthHub
      </p>

      <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
        <strong>Core features stay free today.</strong> Meal planning, journaling,
        groceries, cycle tracking, and the timer remain free. Pro is an optional
        upgrade for extras like ad-free use and cloud sync.
      </div>

      {checkoutEnabled ? (
        <div className="mt-4 flex flex-col gap-2">
          <ProCheckoutButton />
          <p className="text-xs text-gray-500">
            Secure checkout via Stripe. Sign in first if prompted.
          </p>
        </div>
      ) : (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Checkout is not configured in this environment. Set{' '}
          <code className="text-xs">STRIPE_PRICE_ID_PRO</code> and webhook secrets
          to enable upgrades.
        </div>
      )}

      <section className="mt-6 flex flex-col gap-2 rounded-lg border border-gray-200 bg-gray-50 px-4 py-4">
        <h2 className="text-base font-semibold text-gray-900">
          Our commitment to free core tools
        </h2>
        <p className="text-sm leading-relaxed text-gray-700">
          HealthHub&apos;s core experience — including the focus timer, public
          recipes, the Learn hub, and free account features such as meal planning,
          journaling, groceries, and cycle tracking — will always remain free.
          HealthHub Pro is an optional upgrade for extras like ad-free use and
          cloud sync, not a paywall on essentials.
        </p>
      </section>

      <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <strong>Draft notice:</strong> Benefits below are planned only and not
        available yet. We will not charge until Pro launches.
      </div>

      <article className="mt-8 flex flex-col gap-8">
        <section className="flex flex-col gap-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
            <Sparkles className="h-5 w-5 text-primary-600" aria-hidden />
            Planned benefits
          </h2>
          <p className="text-sm text-gray-600">
            When HealthHub Pro launches, subscribers may get:
          </p>
          <ul className="flex flex-col gap-4">
            {plannedBenefits.map((benefit) => (
              <li
                key={benefit.title}
                className="rounded-lg border border-gray-200 bg-white px-4 py-3"
              >
                <h3 className="font-medium text-gray-900">{benefit.title}</h3>
                <p className="mt-1 text-sm text-gray-600">{benefit.description}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="flex flex-col gap-4 border-t border-gray-200 pt-8">
          <h2 className="text-lg font-semibold text-gray-900">Get started free</h2>
          <p className="text-sm text-gray-600">
            You do not need Pro to use HealthHub today. Create a free account or
            try the timer with no sign-in required.
          </p>
          <div className="flex flex-col gap-4 sm:flex-row">
            <Link href="/sign-up">
              <Button className="min-h-[44px] w-full gap-2 sm:w-auto">
                Sign up free
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Button>
            </Link>
            <Link href="/timer">
              <Button
                variant="outline"
                className="min-h-[44px] w-full gap-2 sm:w-auto"
              >
                <Timer className="h-4 w-4" aria-hidden />
                Try the timer
              </Button>
            </Link>
          </div>
        </section>

        <p className="text-sm text-gray-500">
          Questions?{' '}
          <Link href="/" className="font-medium text-primary-600 hover:text-primary-700">
            Return home
          </Link>
        </p>
      </article>
    </div>
  );
}
