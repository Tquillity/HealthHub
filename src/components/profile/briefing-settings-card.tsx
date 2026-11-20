import {
  getBriefingSettings,
  type BriefingSettings,
} from '@/lib/briefing/data';
import { safeErrorLabel } from '@/lib/safe-error';
import { BriefingSettingsControls } from './briefing-settings-controls';

/** Profile section: daily briefing frequency, data sources and detail level. */
export async function BriefingSettingsCard({ userId }: { userId: string }) {
  let settings: BriefingSettings;
  try {
    settings = await getBriefingSettings(userId);
  } catch (error) {
    console.error(
      '[briefing] Failed to load briefing settings:',
      safeErrorLabel(error)
    );
    return null;
  }
  return (
    <section
      id="daily-briefing-settings"
      aria-labelledby="daily-briefing-settings-title"
      className="flex scroll-mt-6 flex-col gap-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
    >
      <div className="flex flex-col gap-1">
        <h2
          id="daily-briefing-settings-title"
          className="text-xl font-semibold text-gray-900"
        >
          Daily briefing
        </h2>
        <p className="text-sm text-gray-500">
          A few suggestions on your dashboard, worked out inside HealthHub from
          your own logs with fixed rules. Nothing is sent to an AI service. Your
          feedback is only used to rank your suggestions, is included in your
          data download and is deleted with your account.
        </p>
      </div>
      <BriefingSettingsControls settings={settings} />
    </section>
  );
}
