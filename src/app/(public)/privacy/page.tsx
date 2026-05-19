import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'How HealthHub collects, uses, and protects your information.',
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <p className="text-sm font-medium text-primary-600">Legal</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-900">
        Privacy Policy
      </h1>
      <p className="mt-2 text-sm text-gray-500">Last updated: May 19, 2026</p>

      <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <strong>Draft notice:</strong> This policy is a placeholder for
        engineering and AdSense review. Have qualified legal counsel review
        before production launch.
      </div>

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
            Cookies and advertising
          </h2>
          <p>
            We use essential cookies for sign-in. If we enable third-party
            advertising (e.g. Google AdSense), we will update this policy and
            provide consent controls as required.
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
