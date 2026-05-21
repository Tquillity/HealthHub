import type { Metadata } from 'next';
import Link from 'next/link';
import { isLegalReviewApproved } from '@/lib/legal/review';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'How HealthHub collects, uses, and protects your information.',
};

export default function PrivacyPage() {
  const approved = isLegalReviewApproved();

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <p className="text-sm font-medium text-primary-600">Legal</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-900">
        Privacy Policy
      </h1>
      <p className="mt-2 text-sm text-gray-500">Last updated: May 20, 2026</p>

      {!approved ? (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <strong>Draft notice:</strong> This policy is a placeholder for
          engineering and AdSense review. Have qualified legal counsel review
          before production launch.
        </div>
      ) : null}

      <article className="mt-8 flex flex-col gap-8 text-sm leading-relaxed text-gray-700">
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-gray-900">Overview</h2>
          <p>
            HealthHub provides household wellness tools including recipes, meal
            planning, focus timing, and educational content. This policy
            describes what data we process and why.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-gray-900">
            Information we collect
          </h2>
          <ul className="flex flex-col gap-2 list-disc pl-5">
            <li>
              <strong>Account data:</strong> name, email, and authentication
              identifiers when you register or sign in.
            </li>
            <li>
              <strong>Wellness data:</strong> meal plans, grocery lists,
              journal entries (encrypted at rest), cycle preferences, and
              household settings you save.
            </li>
            <li>
              <strong>Focus timer data:</strong> Pomodoro sessions, tasks, and
              statistics stored in your browser unless you enable future cloud
              sync features.
            </li>
            <li>
              <strong>Technical data:</strong> server logs, session cookies, and
              PWA cache data.
            </li>
          </ul>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-gray-900">
            Health and journal data
          </h2>
          <p>
            Journal entries may contain sensitive personal information. We encrypt
            journal content at rest where configured. Cycle preferences and meal
            data are stored to provide household features. This information is not
            sold. Do not use HealthHub as a substitute for professional medical
            advice.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-gray-900">Data retention</h2>
          <p>
            Account and household data are retained while your account is active.
            You may request deletion of your account and associated data by
            contacting us. Server logs are retained for a limited period for
            security and debugging.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-gray-900">
            Cookies, analytics, and advertising
          </h2>
          <p>
            We use essential cookies for authentication and session management.
            Our cookie banner lets you accept all cookies or limit use to
            essential cookies only.
          </p>
          <p>
            If we enable analytics or third-party advertising (e.g. Google
            AdSense), we will update this policy, list relevant cookies, and load
            those scripts only after you have been given appropriate choice where
            required by law.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-gray-900">
            Your rights (GDPR / CCPA)
          </h2>
          <p>
            Depending on where you live, you may have rights to access, correct,
            delete, or export personal data, and to object to or restrict certain
            processing. To exercise these rights, contact us at the email below.
            We will respond within timeframes required by applicable law.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-gray-900">Contact</h2>
          <p>
            Questions:{' '}
            <a
              href="mailto:privacy@healthhub.com"
              className="font-medium text-primary-600 hover:text-primary-700"
            >
              privacy@healthhub.com
            </a>
          </p>
        </section>
      </article>

      <p className="mt-10 text-sm text-gray-500">
        <Link href="/" className="text-primary-600 hover:text-primary-700">
          Back to home
        </Link>
      </p>
    </div>
  );
}
