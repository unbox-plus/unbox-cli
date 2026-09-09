import { CatalogGridSkeleton } from "@/components/catalog/grid-skeleton";

export default function Loading() {
  return (
    <div>
      <div className="mb-3 h-5 w-56 animate-pulse rounded bg-muted" />
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-2">
          <div className="h-7 w-48 animate-pulse rounded bg-muted" />
          <div className="h-4 w-24 animate-pulse rounded bg-muted" />
        </div>
        <div className="h-9 w-40 animate-pulse rounded-md bg-muted" />
      </div>
      <CatalogGridSkeleton count={8} />
    </div>
  );
}
