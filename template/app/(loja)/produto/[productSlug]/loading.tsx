// Fronteira de Suspense da PDP: aparece imediatamente ao clicar num produto,
// enquanto o servidor busca os dados do catálogo.
export default function Loading() {
  return (
    <div>
      <div className="mb-4 h-5 w-56 animate-pulse rounded bg-muted" />
      <div className="grid gap-8 lg:grid-cols-2">
        <div className="aspect-square animate-pulse rounded-xl bg-muted" />
        <div className="space-y-4">
          <div className="h-5 w-24 animate-pulse rounded bg-muted" />
          <div className="h-9 w-3/4 animate-pulse rounded bg-muted" />
          <div className="h-5 w-1/2 animate-pulse rounded bg-muted" />
          <div className="h-8 w-1/3 animate-pulse rounded bg-muted" />
          <div className="h-11 w-full animate-pulse rounded-lg bg-muted" />
          <div className="h-11 w-full animate-pulse rounded-lg bg-muted" />
        </div>
      </div>
    </div>
  );
}
