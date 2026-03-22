'use client';

export const SEOContent = () => {
  return (
    <article className="w-full max-w-3xl mx-auto mt-12 mb-8 px-6 text-white/45 text-xs sm:text-sm leading-relaxed space-y-6">
      <section className="space-y-3">
        <h2 className="text-white/70 font-bold text-base sm:text-lg">
          Free Pomodoro Timer for Focus, Study, and Deep Work
        </h2>
        <p>
          HealthHub&apos;s Focus Timer is a privacy-first{' '}
          <strong>online Pomodoro timer</strong> built for students, developers,
          writers, and anyone who wants a calmer way to focus. It runs entirely
          in your browser, so it keeps working <strong>offline</strong>, stores
          your data locally, and does not require an account to use the timer.
        </p>
        <p>
          If you use the <strong>Pomodoro Technique</strong> for studying, coding,
          reading, or creative work, this timer combines a clean focus experience
          with task tracking, customizable durations, and ambient{' '}
          <strong>white noise</strong> or nature sounds to make each session
          easier to stick with.
        </p>
      </section>

      <section className="space-y-3">
        <h3 className="text-white/60 font-semibold text-sm sm:text-base">
          How the Pomodoro schedule works
        </h3>
        <ol className="space-y-2 list-decimal list-inside">
          <li>Work through a focused Pomodoro session.</li>
          <li>Take a short break to reset before the next session.</li>
          <li>Repeat the cycle until the fourth Pomodoro.</li>
          <li>Take a longer break to recover before starting the next set.</li>
        </ol>
      </section>

      <section className="space-y-3">
        <h3 className="text-white/60 font-semibold text-sm sm:text-base">
          Why use this timer instead of a basic timer
        </h3>
        <ul className="space-y-2 list-disc list-inside">
          <li>Offline-first timer with no backend and no sign-up.</li>
          <li>Task tracking so you can connect focus sessions to real work.</li>
          <li>Zen Mode with rain, forest, and white-noise soundscapes.</li>
          <li>Custom Pomodoro, short-break, and long-break durations.</li>
          <li>Privacy-first local storage instead of cloud data collection.</li>
        </ul>
      </section>
    </article>
  );
};
