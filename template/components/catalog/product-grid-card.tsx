"use client";

// Card de produto (modo grade) — fonte única usada no catálogo e na home.
// Preenche a largura do container; em carrosséis, envolva num wrapper de largura fixa.
import Link from "next/link";
import Image from "next/image";
import { Plus, Spinner } from "@phosphor-icons/react/dist/ssr";
import type { CatalogProductItem } from "@/components/catalog/catalog-client";

export function ProductGridCard({ p, onAdd, busy, onSelect }: {
  p: CatalogProductItem;
  onAdd: () => void;
  busy: boolean;
 onSelect?: () => void }) {
  const canAdd = !!p.variantId && p.price > 0 && !p.soldOut;

  return (
    <div className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-[var(--store-line)] bg-white transition-shadow duration-200 hover:shadow-[var(--store-shadow-card)]">
      {p.badge && (
        <span className="absolute left-3 top-3 z-[2] rounded-md px-2.5 py-1 text-[10px] font-extrabold tracking-[0.3px]" style={{ background: p.badge.bg, color: p.badge.fg }}>{p.badge.label}</span>
      )}
      <Link href={`/produto/${encodeURIComponent(p.slug)}`} onClick={onSelect} className="relative block aspect-square overflow-hidden bg-[var(--store-surface)]">
        {p.imageUrl ? (
          <Image src={p.imageUrl} alt={p.title} fill sizes="(max-width:768px) 50vw, 260px" className="object-contain transition-transform duration-300 group-hover:scale-[1.05]" />
        ) : (
          <span className="flex h-full items-center justify-center text-xs text-[var(--store-faint)]">sem foto</span>
        )}
      </Link>

      <div className="flex flex-1 flex-col p-4">
        <Link href={`/produto/${encodeURIComponent(p.slug)}`} onClick={onSelect} className="min-h-[36px] text-sm font-bold leading-[1.3] text-[var(--store-ink)] no-underline line-clamp-2">{p.title}</Link>
        {p.weight && <div className="mt-1 text-xs text-[var(--store-muted)]">{p.weight}</div>}
        <div className="mt-auto flex items-end justify-between pt-3">
          <div>
            {p.displayOld && (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-[var(--store-faint)] line-through">{p.displayOld}</span>
                {p.offPct != null && <span className="rounded bg-[var(--store-sale-soft)] px-1.5 py-0.5 text-[10px] font-extrabold text-[var(--store-sale)]">-{p.offPct}%</span>}
              </div>
            )}
            <div className="font-display text-[19px] font-extrabold leading-[1.1] text-[var(--store-primary,#18181B)]">{p.displayPrice}</div>
          </div>
          {canAdd && (
            <button type="button" onClick={onAdd} disabled={busy} aria-label="Adicionar ao carrinho" className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full bg-[var(--store-primary,#18181B)] text-white shadow-[var(--store-shadow-cta-sm)] transition-colors hover:bg-[var(--store-primary-dark,#09090B)] disabled:opacity-60">
              {busy ? <Spinner className="animate-spin text-lg" /> : <Plus weight="bold" className="text-lg" />}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
