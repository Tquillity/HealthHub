import {
  getCircadianSettings,
  type CircadianSettings,
} from '@/lib/circadian-data';
import { safeErrorLabel } from '@/lib/safe-error';
import { CircadianSettingsControls } from './circadian-settings-controls';

/** Profile section: circadian insights opt-in and deleting energy check-ins. */
export async function CircadianSettingsCard({ userId }: { userId: string }) {
  let settings: CircadianSettings;
  try {
    settings = await getCircadianSettings(userId);
  } catch (error) {
    console.error(
      '[circadian] Failed to load circadian settings:',
      safeErrorLabel(error)
    );
    return null;
  }
  return (
    <section
      id="circadian-insights-settings"
      aria-labelledby="circadian-insights-settings-title"
      className="flex scroll-mt-6 flex-col gap-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
    >
      <div className="flex flex-col gap-1">
        <h2
          id="circadian-insights-settings-title"
          className="text-xl font-semibold text-gray-900"
        >
          Circadian insights
        </h2>
        <p className="text-sm text-gray-500">
          Time-of-day suggestions built on typical daily rhythms, such as the
          morning high in testosterone and cortisol, and on your own energy
          check-ins. Your check-ins are private to you: they are never shared
          with your household, are included in your data download and are
          deleted with your account.
        </p>
      </div>
      <CircadianSettingsControls settings={settings} />
    </section>
  );
}
