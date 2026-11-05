import type { UiCartItem } from "@/lib/cart-normalize";

/** Linha de variante do item: kit mostra o nome da opção e os sabores num colapso (podem ser muitos). */
export function ItemVariant({ it, className }: { it: UiCartItem; className?: string }) {
  if (!it.kitId) return it.variantTitle ? <div className={className}>{it.variantTitle}</div> : null;
  const picks = it.kitPicks ?? [];
  return (
    <div className={className}>
      {it.kitLabel && <div>{it.kitLabel}</div>}
      {picks.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer list-none underline-offset-2 hover:underline [&::-webkit-details-marker]:hidden">
            <span className="group-open:hidden">Ver sabores ({picks.length})</span>
            <span className="hidden group-open:inline">Ocultar sabores</span>
          </summary>
          <ul className="mt-0.5">{picks.map((l) => <li key={l}>{l}</li>)}</ul>
        </details>
      )}
    </div>
  );
}
