// Skeleton da grade de catálogo — usado pelos loading.tsx de /produtos e /categoria/[tagSlug]
// para dar feedback instantâneo enquanto o Server Component carrega.
export function CatalogGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex flex-col overflow-hidden rounded-xl border bg-card">
          <div className="aspect-square animate-pulse bg-muted" />
          <div className="flex flex-1 flex-col gap-2 p-3">
            <div className="h-4 w-full animate-pulse rounded bg-muted" />
            <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
            <div className="mt-2 h-6 w-1/2 animate-pulse rounded bg-muted" />
            <div className="mt-1 h-9 w-full animate-pulse rounded-md bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}
