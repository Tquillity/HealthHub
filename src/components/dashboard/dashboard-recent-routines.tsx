import Link from 'next/link';
import {
  getRecentDashboardRoutines,
  RECENT_ROUTINES_LIMIT,
} from '@/lib/dashboard-data';

/** The household's newest routines. Streams in under a Suspense boundary; hidden when empty. */
export async function DashboardRecentRoutines({ userId }: { userId: string }) {
  const routines = await getRecentDashboardRoutines(userId);

  if (routines.length === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
      <h2 className="text-xl font-semibold text-gray-900 mb-5">Recent Routines</h2>
      <div className="flex flex-col gap-4">
        {routines.map((routine) => (
          <Link
            key={routine.id}
            href="/routines"
            className="block rounded-lg border border-gray-200 p-4 transition-colors hover:bg-gray-50 hover:border-gray-300"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-gray-900">{routine.name}</h3>
                {routine.description && (
                  <p className="text-sm text-gray-500 mt-1">{routine.description}</p>
                )}
              </div>
              {routine.category && (
                <span className="text-xs font-medium text-gray-500 capitalize">
                  {routine.category}
                </span>
              )}
            </div>
          </Link>
        ))}
      </div>
      {routines.length >= RECENT_ROUTINES_LIMIT && (
        <Link
          href="/routines"
          className="mt-4 block text-center text-sm font-medium text-primary-600 hover:text-primary-700"
        >
          View all routines →
        </Link>
      )}
    </div>
  );
}
