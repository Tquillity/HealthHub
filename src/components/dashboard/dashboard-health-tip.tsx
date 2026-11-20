const HEALTH_TIPS = [
  'Starting your day with 5 minutes of deep breathing can significantly improve your energy levels and mental clarity throughout the day.',
  'Hydration is key! Aim to drink at least 8 glasses of water daily to maintain optimal body function.',
  'Regular meal planning can reduce stress and help you make healthier food choices throughout the week.',
  'Getting 7-9 hours of quality sleep each night is essential for physical recovery and mental well-being.',
  'Taking short breaks every hour during work can improve focus and reduce mental fatigue.',
];

/**
 * One tip per day, picked by weekday. A Server Component, so there is no hydration step that
 * could disagree with the server about the date, and it is part of the instant dashboard shell.
 */
export function DashboardHealthTip() {
  const tip = HEALTH_TIPS[new Date().getDay() % HEALTH_TIPS.length];

  return (
    <div className="rounded-lg p-6 border border-primary-100 bg-linear-to-br from-primary-50 to-wellness-50">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Today&apos;s Tip</h3>
      <p className="text-gray-700 text-sm leading-relaxed">&quot;{tip}&quot;</p>
    </div>
  );
}
