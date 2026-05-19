import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { PublicNav } from '@/components/layout/public-nav';
import { Footer } from '@/components/layout/footer';
import {
  Timer,
  UtensilsCrossed,
  GraduationCap,
  ArrowRight,
  Shield,
  Wifi,
  Zap,
} from 'lucide-react';

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <PublicNav />

      {/* ── Hero ── */}
      <section className="relative overflow-hidden bg-linear-to-br from-primary-600 via-primary-700 to-primary-900 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(255,255,255,0.15),transparent)]" />

        <div className="relative mx-auto flex max-w-7xl flex-col items-center gap-8 px-4 py-20 text-center sm:px-6 sm:py-28 lg:px-8 lg:py-36">
          <p className="rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs font-semibold tracking-wide uppercase backdrop-blur-sm sm:text-sm">
            Focus &middot; Nourish &middot; Learn
          </p>

          <h1 className="max-w-3xl text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
            Your Household Wellness Hub
          </h1>

          <p className="max-w-xl text-base leading-relaxed text-white/80 sm:text-lg">
            A privacy-first super-app that helps you stay focused, eat well, and
            make evidence-based health decisions &mdash; all in one place.
          </p>

          <div className="flex flex-col gap-4 sm:flex-row">
            <Link href="/timer">
              <Button
                size="lg"
                className="gap-2 bg-white text-primary-700 hover:bg-white/90"
              >
                <Timer className="h-5 w-5" />
                Try the Free Timer
              </Button>
            </Link>
            <Link href="/sign-up">
              <Button
                size="lg"
                variant="outline"
                className="gap-2 border-white/30 text-white hover:bg-white/10"
              >
                Create Account
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Three Pillars ── */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
        <div className="mb-16 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Three Pillars of Wellness
          </h2>
          <p className="mt-4 text-lg text-gray-500">
            Everything your household needs, distilled into one app.
          </p>
        </div>

        <div className="grid gap-10 md:grid-cols-3">
          {/* Pillar 1 — Focus */}
          <Link
            href="/timer"
            className="group flex flex-col gap-5 rounded-2xl border border-gray-200 bg-white p-8 shadow-sm transition-shadow hover:shadow-md"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary-100 text-primary-600 transition-colors group-hover:bg-primary-600 group-hover:text-white">
              <Timer className="h-7 w-7" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900">
              Scientific Focus
            </h3>
            <p className="text-sm leading-relaxed text-gray-500">
              Enter flow state with our privacy-first Focus Timer. Pomodoro
              cycles, ambient soundscapes, task tracking, and daily
              goal&nbsp;insights &mdash; all stored locally in your browser.
            </p>
            <span className="mt-auto inline-flex items-center gap-1 text-sm font-semibold text-primary-600 group-hover:gap-2 transition-all">
              Launch Timer <ArrowRight className="h-4 w-4" />
            </span>
          </Link>

          {/* Pillar 2 — Nutrition */}
          <Link
            href="/recipes"
            className="group flex flex-col gap-5 rounded-2xl border border-gray-200 bg-white p-8 shadow-sm transition-shadow hover:shadow-md"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-wellness-100 text-wellness-600 transition-colors group-hover:bg-wellness-600 group-hover:text-white">
              <UtensilsCrossed className="h-7 w-7" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900">
              Smart Nutrition
            </h3>
            <p className="text-sm leading-relaxed text-gray-500">
              Standardized, healthy recipes scaled to your household. Filter by
              cuisine, dietary needs, or macros &mdash; and auto-generate your
              weekly grocery&nbsp;list.
            </p>
            <span className="mt-auto inline-flex items-center gap-1 text-sm font-semibold text-wellness-600 group-hover:gap-2 transition-all">
              Browse Recipes <ArrowRight className="h-4 w-4" />
            </span>
          </Link>

          {/* Pillar 3 — Learning */}
          <Link
            href="/learn"
            className="group flex flex-col gap-5 rounded-2xl border border-gray-200 bg-white p-8 shadow-sm transition-shadow hover:shadow-md"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-purple-100 text-purple-600 transition-colors group-hover:bg-purple-600 group-hover:text-white">
              <GraduationCap className="h-7 w-7" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900">
              Wellness Intelligence
            </h3>
            <p className="text-sm leading-relaxed text-gray-500">
              Evidence-based articles on circadian rhythms, cycle syncing,
              stress management, and more &mdash; curated for real-world
              household&nbsp;health.
            </p>
            <span className="mt-auto inline-flex items-center gap-1 text-sm font-semibold text-purple-600 group-hover:gap-2 transition-all">
              Start Learning <ArrowRight className="h-4 w-4" />
            </span>
          </Link>
        </div>
      </section>

      {/* ── Trust Badges ── */}
      <section className="border-t border-gray-100 bg-gray-50">
        <div className="mx-auto grid max-w-5xl gap-8 px-4 py-16 sm:grid-cols-3 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center gap-3 text-center">
            <Shield className="h-8 w-8 text-primary-500" />
            <h4 className="font-semibold text-gray-900">Privacy First</h4>
            <p className="text-sm text-gray-500">
              Timer data stays in your browser. No tracking, no telemetry.
            </p>
          </div>
          <div className="flex flex-col items-center gap-3 text-center">
            <Wifi className="h-8 w-8 text-wellness-500" />
            <h4 className="font-semibold text-gray-900">Works Offline</h4>
            <p className="text-sm text-gray-500">
              Focus sessions continue even without an internet connection.
            </p>
          </div>
          <div className="flex flex-col items-center gap-3 text-center">
            <Zap className="h-8 w-8 text-purple-500" />
            <h4 className="font-semibold text-gray-900">Free &amp; Fast</h4>
            <p className="text-sm text-gray-500">
              Core tools are free forever. Sign up to unlock premium features.
            </p>
          </div>
        </div>
      </section>

      {/* ── CTA Banner ── */}
      <section className="bg-linear-to-r from-primary-600 to-wellness-600 text-white">
        <div className="mx-auto flex max-w-4xl flex-col items-center gap-6 px-4 py-16 text-center sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold sm:text-3xl">
            Ready to upgrade your wellness routine?
          </h2>
          <p className="max-w-xl text-white/80">
            Join HealthHub for meal planning, wellness journaling, cycle
            tracking, and an ad-free experience across all tools.
          </p>
          <div className="flex flex-col gap-4 sm:flex-row">
            <Link href="/sign-up">
              <Button
                size="lg"
                className="gap-2 bg-white text-primary-700 hover:bg-white/90"
              >
                Sign Up Free
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/timer">
              <Button
                size="lg"
                variant="outline"
                className="border-white/30 text-white hover:bg-white/10"
              >
                Try the Timer First
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
