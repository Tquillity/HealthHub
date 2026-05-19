import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'Terms governing use of HealthHub wellness tools.',
};

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <p className="text-sm font-medium text-primary-600">Legal</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-900">
        Terms of Service
      </h1>
      <p className="mt-2 text-sm text-gray-500">Last updated: May 19, 2026</p>

      <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <strong>Draft notice:</strong> These terms are a placeholder. Have
        qualified legal counsel review before production launch.
      </div>

      <article className="mt-8 flex flex-col gap-8 text-sm leading-relaxed text-gray-700">
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-gray-900">Agreement</h2>
          <p>
            By using HealthHub, you agree to these Terms. If you do not agree,
            do not use the service.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-gray-900">The service</h2>
          <p>
            HealthHub offers wellness tools including recipes, meal planning,
            groceries, routines, journaling, cycle insights, educational content,
            and a focus timer. Features may change over time.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-gray-900">
            Not medical advice
          </h2>
          <p>
            Content is for general wellness and education only. It is not medical
            advice. Consult qualified professionals for health decisions.
          </p>
          <p>
            Cycle tracking, expert phase recommendations, and Learn articles are
            provided for wellness and educational purposes only — not as clinical
            guidance, diagnosis, or treatment.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-gray-900">Accounts</h2>
          <p>
            You are responsible for safeguarding your credentials and for activity
            under your account. You must provide accurate registration information.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-gray-900">
            Acceptable use
          </h2>
          <p>
            Do not misuse the service, attempt unauthorized access, scrape at
            scale, or upload unlawful content.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-gray-900">Contact</h2>
          <p>
            Questions:{' '}
            <a
              href="mailto:legal@healthhub.com"
              className="font-medium text-primary-600 hover:text-primary-700"
            >
              legal@healthhub.com
            </a>
          </p>
        </section>
      </article>

      <p className="mt-10 text-sm text-gray-500">
        <Link href="/" className="text-primary-600 hover:text-primary-700">
          Back to home
        </Link>
        {' · '}
        <Link href="/privacy" className="text-primary-600 hover:text-primary-700">
          Privacy Policy
        </Link>
      </p>
    </div>
  );
}
