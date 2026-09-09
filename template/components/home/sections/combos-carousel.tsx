"use client";

// Carrossel de produtos em destaque (combos/ofertas) com add-to-cart funcional.
// Âncora #destaques — alvo do CTA do hero.
import * as React from "react";
import Link from "next/link";
import { CaretLeft, CaretRight, ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { useCart } from "@/components/cart/cart-provider";
import type { CatalogProductItem } from "@/components/catalog/catalog-client";
import { ProductGridCard } from "@/components/catalog/product-grid-card";
import type { SectionComponentProps } from "./registry";

export function CombosCarouselSection({ data }: SectionComponentProps) {
  const { add } = useCart();
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const rowRef = React.useRef<HTMLDivElement | null>(null);

  if (data.combos.length === 0) return null;

  async function quickAdd(p: CatalogProductItem) {
    if (!p.productId || !p.variantId || p.soldOut) return;
    setBusyId(p.variantId);
    await add({ productId: p.productId, variantId: p.variantId, price: p.price, quantity: 1, thumbnail: p.imageUrl ?? undefined, title: p.title });
    setBusyId(null);
  }
  const scrollRow = (dir: number) => rowRef.current?.scrollBy({ left: dir * 300, behavior: "smooth" });

  return (
    <div id="destaques" className="mx-auto max-w-[var(--container-max,1240px)] scroll-mt-24 px-4 pt-[42px] sm:px-6">
      <div className="mb-[18px] flex items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-[26px] font-extrabold">{data.combosTitle}</h2>
          <p className="mt-1 text-sm text-[var(--store-muted)]">Produtos em destaque para você.</p>
        </div>
        <div className="hidden gap-2.5 sm:flex">
          <button type="button" onClick={() => scrollRow(-1)} aria-label="Anterior" className="flex h-[42px] w-[42px] items-center justify-center rounded-full border-[1.5px] border-[var(--store-line-2)] bg-white hover:border-[var(--store-primary,#18181B)]"><CaretLeft weight="bold" className="text-[var(--store-ink-2)]" /></button>
          <button type="button" onClick={() => scrollRow(1)} aria-label="Próximo" className="flex h-[42px] w-[42px] items-center justify-center rounded-full border-[1.5px] border-[var(--store-line-2)] bg-white hover:border-[var(--store-primary,#18181B)]"><CaretRight weight="bold" className="text-[var(--store-ink-2)]" /></button>
        </div>
      </div>
      <div ref={rowRef} className="flex gap-[18px] overflow-x-auto pb-3.5 [scrollbar-width:thin]">
        {data.combos.map((c) => (
          <div key={c.slug} className="w-[260px] flex-none">
            <ProductGridCard p={c} busy={busyId === c.variantId} onAdd={() => quickAdd(c)} />
          </div>
        ))}
        {/* card final: ver todos os produtos */}
        <Link
          href="/produtos"
          className="group flex w-[260px] flex-none flex-col items-center justify-center gap-3.5 rounded-2xl border-[1.5px] border-dashed border-[var(--store-primary-soft)] bg-white/60 p-6 text-center no-underline transition-colors hover:border-[var(--store-primary,#18181B)] hover:bg-[var(--store-primary-soft,#F1F1F3)]"
        >
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--store-primary-soft,#F1F1F3)] text-[var(--store-primary,#18181B)] transition-colors group-hover:bg-[var(--store-primary,#18181B)] group-hover:text-white">
            <ArrowRight weight="bold" className="text-2xl" />
          </span>
          <span className="font-display text-[17px] font-extrabold leading-[1.2] text-[var(--store-primary,#18181B)]">Ver todos os produtos</span>
          <span className="text-[13px] text-[var(--store-muted)]">Explore o catálogo completo</span>
        </Link>
      </div>
    </div>
  );
}
