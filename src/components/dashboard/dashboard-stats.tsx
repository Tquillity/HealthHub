import { getDashboardStats } from '@/lib/dashboard-data';

/** Routine and recipe totals. Streams in under a Suspense boundary. */
export async function DashboardStats({ userId }: { userId: string }) {
  const stats = await getDashboardStats(userId);

  if (!stats) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-600 shadow-sm">
        We&apos;re still setting up your household. Refresh the page in a moment to see your
        routines and recipes.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-3">
          Total Routines
        </h3>
        <p className="text-3xl font-bold text-gray-900 mb-2">{stats.routinesCount}</p>
        <p className="text-sm text-gray-500">Available routines</p>
      </div>
      <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-3">
          Total Recipes
        </h3>
        <p className="text-3xl font-bold text-gray-900 mb-2">{stats.recipesCount}</p>
        <p className="text-sm text-gray-500">Available recipes</p>
      </div>
    </div>
  );
}
