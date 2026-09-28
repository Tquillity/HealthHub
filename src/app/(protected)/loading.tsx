/** Skeleton shown while an authenticated page's Server Component data loads. */
export default function ProtectedLoading() {
  return (
    <div className="flex flex-col gap-6" role="status" aria-live="polite">
      <span className="sr-only">Loading…</span>
      <div className="flex flex-col gap-2">
        <div className="h-8 w-48 animate-pulse rounded-md bg-gray-200" />
        <div className="h-4 w-72 max-w-full animate-pulse rounded-md bg-gray-200" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <div
            key={index}
            className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
          >
            <div className="h-5 w-2/3 animate-pulse rounded-md bg-gray-200" />
            <div className="h-4 w-full animate-pulse rounded-md bg-gray-100" />
            <div className="h-4 w-5/6 animate-pulse rounded-md bg-gray-100" />
          </div>
        ))}
      </div>
    </div>
  );
}
