"use client";

// Seções de recomendação da PDP com PRODUTOS REAIS do catálogo e add-to-cart funcional.
// Substitui os antigos Bundles/Combos com preços fictícios e botões sem ação.
import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { Plus, Spinner, ShoppingCartSimple, ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { useCart } from "@/components/cart/cart-provider";
import { formatBRL } from "@/lib/format";
import type { CatalogItem } from "@/components/product/pdp/catalog-grid";

const canAdd = (p: CatalogItem) => !!p.productId && !!p.variantId && p.price != null;

function useQuickAdd() {
  const { add } = useCart();
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const addOne = React.useCallback(async (p: CatalogItem) => {
    if (!canAdd(p)) return;
    setBusyId(p.variantId!);
    await add({ productId: p.productId!, variantId: p.variantId!, price: p.price ?? 0, quantity: 1, thumbnail: p.imageUrl ?? undefined, title: p.title });
    setBusyId(null);
  }, [add]);
  return { addOne, busyId };
}

function Thumb({ item, size = 84 }: { item: CatalogItem; size?: number }) {
  return (
    <span className="relative flex items-center justify-center overflow-hidden rounded-md border border-[var(--store-line)] bg-[var(--store-line)]" style={{ width: size, height: size }}>
      {item.imageUrl ? (
        <Image src={item.imageUrl} alt={item.title} fill sizes={`${size}px`} className="object-contain p-0.5" />
      ) : (
        <span className="text-[10px] text-[var(--store-faint)]">sem foto</span>
      )}
    </span>
  );
}

/** "Compre junto" (real): N produtos reais + adicionar todos de uma vez. Sem desconto fabricado. */
export function BuyTogether({ items }: { items: CatalogItem[] }) {
  const products = items.filter(canAdd).slice(0, 3);
  const { addOne } = useQuickAdd();
  const [busyAll, setBusyAll] = React.useState(false);
  if (products.length < 2) return null;
  const sum = products.reduce((s, p) => s + (p.price ?? 0), 0);

  async function addAll() {
    setBusyAll(true);
    for (const p of products) await addOne(p);
    setBusyAll(false);
  }

  return (
    <div className="rounded-xl border border-[var(--store-line)] bg-white p-[26px]">
      <h2 className="font-display mb-5 text-[22px] font-extrabold text-[var(--store-primary,#18181B)]">Compre junto</h2>
      <div className="flex flex-wrap items-start gap-2 max-sm:justify-center max-sm:gap-3.5">
        {products.map((p, i) => (
          <div key={p.slug} className="contents">
            <div className="flex w-[100px] shrink-0 flex-col items-center gap-1.5">
              <Link href={`/produto/${encodeURIComponent(p.slug)}`}><Thumb item={p} /></Link>
              <Link href={`/produto/${encodeURIComponent(p.slug)}`} className="line-clamp-2 text-center text-xs font-bold leading-tight text-[var(--store-ink)] no-underline">{p.title}</Link>
              <div className="text-[13px] font-extrabold text-[var(--store-ink)]">{p.displayPrice}</div>
            </div>
            {i < products.length - 1 && (
              <span className="mt-9 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--store-primary,#18181B)] text-white"><Plus weight="bold" className="text-[15px]" /></span>
            )}
          </div>
        ))}
        <span className="mt-9 shrink-0 text-[22px] font-bold text-[var(--store-faint)]">=</span>
        <div className="flex flex-1 flex-col items-center gap-1.5 pt-0.5 text-center">
          <div className="text-[13px] text-[var(--store-muted)]">Os {products.length} por</div>
          <div className="font-display text-[26px] font-extrabold leading-none text-[var(--store-ink)]">{formatBRL(sum)}</div>
          <button type="button" onClick={addAll} disabled={busyAll}
            className="font-display mt-1 flex cursor-pointer items-center gap-1.5 rounded-md bg-[var(--store-primary,#18181B)] px-5 py-3 text-[13px] font-bold leading-tight text-white transition-colors hover:bg-[var(--store-primary-dark,#09090B)] disabled:opacity-60">
            {busyAll ? <Spinner className="animate-spin" /> : <ShoppingCartSimple weight="bold" />}Adicionar todos
          </button>
        </div>
      </div>
    </div>
  );
}

/** "Frequentemente comprados juntos" (real): produtos reais com quick-add individual. */
export function FrequentlyBought({ items }: { items: CatalogItem[] }) {
  const products = items.filter(canAdd).slice(0, 3);
  const { addOne, busyId } = useQuickAdd();
  if (products.length === 0) return null;

  return (
    <div className="rounded-xl border border-[var(--store-line)] bg-white p-[26px]">
      <h2 className="font-display mb-5 text-[22px] font-extrabold text-[var(--store-ink)]">Frequentemente comprados juntos</h2>
      <div className="flex items-start gap-[18px]">
        {products.map((p) => (
          <div key={p.slug} className="flex flex-1 flex-col items-center gap-1.5">
            <Link href={`/produto/${encodeURIComponent(p.slug)}`}><Thumb item={p} size={96} /></Link>
            <Link href={`/produto/${encodeURIComponent(p.slug)}`} className="line-clamp-2 text-center text-xs font-bold leading-tight text-[var(--store-ink)] no-underline">{p.title}</Link>
            <div className="text-[13px] font-extrabold text-[var(--store-ink)]">{p.displayPrice}</div>
            <button type="button" onClick={() => addOne(p)} disabled={busyId === p.variantId} aria-label={`Adicionar ${p.title}`}
              className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-[var(--store-primary,#18181B)] text-white shadow-[var(--store-shadow-cta-sm)] transition-colors hover:bg-[var(--store-primary-dark,#09090B)] disabled:opacity-60">
              {busyId === p.variantId ? <Spinner className="animate-spin text-base" /> : <Plus weight="bold" className="text-base" />}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Grade de "kits sugeridos" (real): produtos reais com quick-add. Sem % OFF fabricado. */
export function SuggestedKits({ items }: { items: CatalogItem[] }) {
  const products = items.filter(canAdd).slice(0, 3);
  const { addOne, busyId } = useQuickAdd();
  if (products.length === 0) return null;

  return (
    <>
      <div className="mb-[18px] flex items-end justify-between">
        <div>
          <h2 className="font-display text-2xl font-extrabold">Leve também</h2>
          <p className="mt-1 text-sm text-[var(--store-muted)]">Você também pode gostar.</p>
        </div>
        <Link href="/produtos" className="flex items-center gap-1.5 text-sm font-bold text-[var(--store-primary,#18181B)] no-underline max-sm:hidden">
          Ver todos os produtos <ArrowRight weight="bold" />
        </Link>
      </div>
      <div className="grid gap-[18px] sm:grid-cols-2 lg:grid-cols-3">
        {products.map((p) => (
          <div key={p.slug} className="flex flex-col rounded-2xl border border-[var(--store-line)] bg-white p-[18px]">
            <Link href={`/produto/${encodeURIComponent(p.slug)}`} className="flex justify-center py-2">
              <Thumb item={p} size={120} />
            </Link>
            <Link href={`/produto/${encodeURIComponent(p.slug)}`} className="mt-2 line-clamp-2 text-base font-bold text-[var(--store-ink)] no-underline">{p.title}</Link>
            {p.weight && <div className="mt-0.5 text-[12.5px] text-[var(--store-muted)]">{p.weight}</div>}
            <div className="font-display mt-2 text-[22px] font-extrabold text-[var(--store-primary,#18181B)]">{p.displayPrice}</div>
            <button type="button" onClick={() => addOne(p)} disabled={busyId === p.variantId}
              className="font-display mt-3.5 flex cursor-pointer items-center justify-center gap-1.5 rounded-md bg-[var(--store-primary,#18181B)] py-3 text-[13.5px] font-bold text-white transition-colors hover:bg-[var(--store-primary-dark,#09090B)] disabled:opacity-60">
              {busyId === p.variantId ? <Spinner className="animate-spin" /> : <Plus weight="bold" />}Adicionar
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
