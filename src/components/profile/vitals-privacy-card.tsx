import {
  getVitalsPrivacySummary,
  type VitalsPrivacySummary,
} from '@/lib/daily-metrics';
import { safeErrorLabel } from '@/lib/safe-error';
import { VitalsPrivacyControls } from './vitals-privacy-controls';

/** Profile section: vitals opt-in, temperature unit, and deleting vitals or BBT data. */
export async function VitalsPrivacyCard({ userId }: { userId: string }) {
  let summary: VitalsPrivacySummary;
  try {
    summary = await getVitalsPrivacySummary(userId);
  } catch (error) {
    console.error(
      '[vitals] Failed to load privacy settings:',
      safeErrorLabel(error)
    );
    return null;
  }
  return (
    <section
      aria-labelledby="vitals-privacy-title"
      className="flex flex-col gap-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
    >
      <div className="flex flex-col gap-1">
        <h2
          id="vitals-privacy-title"
          className="text-xl font-semibold text-gray-900"
        >
          Vitals &amp; temperature
        </h2>
        <p className="text-sm text-gray-500">
          Your vitals and temperature readings are private to you. They are
          never shared with your household, are included in your data download,
          and are deleted with your account.
        </p>
      </div>
      <VitalsPrivacyControls summary={summary} />
    </section>
  );
}
