"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { Plus, Heart, Spinner, ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { useCart } from "@/components/cart/cart-provider";
// EDITOR: módulo de cliente ("use client"): aqui o namespace `Editable.*` é a forma de uso (README §4).
import { Editable } from "@/lib/editable";

export interface CatalogItem {
  slug: string;
  title: string;
  displayPrice: string;
  imageUrl?: string | null;
  weight?: string | null;
  productId?: string;
  variantId?: string | null;
  price?: number | null;
  badge?: { label: string; bg: string; fg: string } | null;
}

/**
 * Link "Ver todos os produtos" do bloco de catálogo da PDP. É `Slot` de tipo link (e não `Link`
 * editável) porque o rótulo divide o elemento com o ícone: no `Editable.Link`, editar o rótulo
 * apagaria a seta. Vive aqui, num módulo de cliente, porque o render-prop não atravessa a fronteira
 * de servidor da view (pdp-view.tsx).
 */
export function CatalogCta() {
  return (
    <Editable.Slot path="cta" type="link" fallback={{ href: "/produtos", label: "Ver todos os produtos" }} label="Link para o catálogo completo">
      {(v, attrs, ref, estilo) => (
        <Link
          ref={ref}
          href={v.href}
          {...attrs}
          style={estilo}
          className="flex items-center gap-1.5 text-sm font-bold text-[var(--store-primary,#18181B)] no-underline max-sm:hidden"
        >
          {v.label ?? "Ver todos os produtos"}{" "}
          <Editable.Icon path="cta-icone" label="Ícone do link" size={14}>
            <ArrowRight weight="bold" />
          </Editable.Icon>
        </Link>
      )}
    </Editable.Slot>
  );
}

// EDITOR: os produtos da grade são dado do catálogo, não copy do molde: fora do editor (README §8).
export function CatalogGrid({ items }: { items: CatalogItem[] }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5" data-editor-ignore>
      {items.map((p) => (
        <Card key={p.slug} item={p} />
      ))}
    </div>
  );
}

function Card({ item }: { item: CatalogItem }) {
  const { add } = useCart();
  const [busy, setBusy] = React.useState(false);
  const canQuickAdd = !!item.productId && !!item.variantId && item.price != null;

  async function quickAdd() {
    if (!canQuickAdd) return;
    setBusy(true);
    await add({
      productId: item.productId!,
      variantId: item.variantId!,
      price: item.price ?? 0,
      quantity: 1,
      thumbnail: item.imageUrl ?? undefined,
      title: item.title,
    });
    setBusy(false);
  }

  return (
    <div className="relative flex flex-col rounded-2xl border border-[var(--store-line)] bg-white p-3.5">
      {item.badge && (
        <span className="absolute left-3.5 top-3.5 z-[1] rounded-md px-2.5 py-1 text-[10px] font-extrabold tracking-[0.3px]" style={{ background: item.badge.bg, color: item.badge.fg }}>
          {item.badge.label}
        </span>
      )}
      <button type="button" aria-label="Favoritar" className="absolute right-3.5 top-3.5 z-[1] flex h-8 w-8 items-center justify-center rounded-full border border-[var(--store-line)] bg-white">
        <Heart className="text-[15px] text-[var(--store-faint)]" />
      </button>

      <Link href={`/produto/${encodeURIComponent(item.slug)}`} className="flex h-[150px] items-center justify-center">
        {item.imageUrl ? (
          <span className="relative block h-full w-full">
            <Image src={item.imageUrl} alt={item.title} fill sizes="180px" className="object-contain p-0.5" />
          </span>
        ) : (
          <span className="text-[var(--store-faint)]">sem imagem</span>
        )}
      </Link>

      <Link href={`/produto/${encodeURIComponent(item.slug)}`} className="text-sm font-bold leading-tight text-[var(--store-ink)] no-underline line-clamp-2">{item.title}</Link>
      {item.weight && <div className="mt-0.5 text-xs text-[var(--store-muted)]">{item.weight}</div>}
      <div className="mt-2.5 flex items-center justify-between">
        <div className="font-display text-[17px] font-extrabold text-[var(--store-ink)]">{item.displayPrice}</div>
        {canQuickAdd && (
          <button type="button" onClick={quickAdd} disabled={busy} aria-label="Adicionar ao carrinho" className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--store-primary,#18181B)] text-white shadow-[var(--store-shadow-cta-sm)] transition-colors hover:bg-[var(--store-primary-dark,#09090B)] disabled:opacity-60">
            {busy ? <Spinner className="animate-spin text-lg" /> : <Plus weight="bold" className="text-lg" />}
          </button>
        )}
      </div>
    </div>
  );
}
