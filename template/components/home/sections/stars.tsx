import { Star } from "@phosphor-icons/react/dist/ssr";

/** Estrelas de avaliação. `n` ausente → não renderiza: nota que a loja não tem não aparece. */
export function Stars({ n, className = "" }: { n?: number | null; className?: string }) {
  if (n == null || Number.isNaN(n)) return null;
  const k = Math.max(0, Math.min(5, Math.round(n)));
  return (
    <span className={`flex ${className}`} aria-label={`${k} de 5 estrelas`}>
      {Array.from({ length: 5 }, (_, i) => <Star key={i} weight={i < k ? "fill" : "regular"} />)}
    </span>
  );
}
