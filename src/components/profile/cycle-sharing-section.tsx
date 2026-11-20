import { HeartHandshake } from 'lucide-react';
import { getCycleSharingPanelData } from '@/lib/support-status';
import { CycleSharingSettingsPanel } from '@/components/profile/cycle-sharing-settings';

/** Profile section for partner sync (#3). `userId` must be the session user's id. */
export async function CycleSharingSection({ userId }: { userId: string }) {
  const data = await getCycleSharingPanelData(userId);
  if (!data) return null;

  return (
    <section
      id="cycle-sharing"
      aria-labelledby="cycle-sharing-title"
      className="scroll-mt-24 rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
    >
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-100 text-primary-600">
          <HeartHandshake className="h-5 w-5" aria-hidden />
        </div>
        <div>
          <h2 id="cycle-sharing-title" className="text-xl font-semibold text-gray-900">
            Cycle status sharing
          </h2>
          <p className="text-sm text-gray-500">
            Help the people you live with support you. Off unless you turn it on for a
            household.
          </p>
        </div>
      </div>
      <CycleSharingSettingsPanel data={data} />
    </section>
  );
}
