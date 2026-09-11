"use client";

// Card de combo compacto — usado no mobile (home) e no catálogo. Autocontido (add-to-cart).
import * as React from "react";
import Image from "next/image";
import { ShoppingCartSimple, Spinner, PiggyBank } from "@phosphor-icons/react/dist/ssr";
import { useCart } from "@/components/cart/cart-provider";
import { formatBRL } from "@/lib/format";
import type { ResolvedCombo } from "@/lib/enrichment/combos";

export function ComboCardCompact({ combo, className = "" }: { combo: ResolvedCombo; className?: string }) {
  const { add, setOpen } = useCart();
  const [busy, setBusy] = React.useState(false);
  const hero = combo.imageUrl || combo.items[0]?.imageUrl || null;

  async function addCombo() {
    setBusy(true);
    try {
      for (const it of combo.items) {
        await add(
          { productId: it.productId, variantId: it.variantId, price: it.discountedPrice, quantity: it.qty, thumbnail: it.imageUrl ?? undefined, title: `${combo.name} · ${it.name}` },
          { silent: true },
        );
      }
      setOpen(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`flex flex-col overflow-hidden rounded-2xl border border-[var(--store-line)] bg-white ${className}`}>
      <div className="relative aspect-[4/3] bg-[var(--store-surface)]">
        {combo.badge && (
          <span className="absolute left-2.5 top-2.5 z-[2] rounded-full bg-[var(--store-cta-soft)] px-2.5 py-0.5 text-[10px] font-extrabold tracking-[0.3px] text-[var(--store-cta-fg)]">{combo.badge}</span>
        )}
        {hero && <Image src={hero} alt={combo.name} fill sizes="240px" className="object-cover" />}
      </div>

      <div className="flex flex-1 flex-col p-3.5">
        <h4 className="font-display text-[var(--store-ink)]">{combo.name}</h4>
        <p className="mt-0.5 text-[12px] text-[var(--store-muted)]">{combo.itemCount} itens</p>

        {combo.save > 0 && (
          <div className="mt-2.5 flex items-center gap-2">
            <span className="text-[12.5px] text-[var(--store-faint)] line-through">{formatBRL(combo.subtotal)}</span>
            <span className="rounded bg-[var(--store-cta,#D97706)] px-1.5 py-0.5 text-[10px] font-extrabold text-[var(--store-cta-fg,#1C1207)]">{combo.discountPct}% OFF</span>
          </div>
        )}
        <div className="font-display text-[22px] font-extrabold leading-[1.1] text-[var(--store-primary,#18181B)]">{formatBRL(combo.total)}</div>
        {combo.save > 0 && (
          <div className="mt-0.5 flex items-center gap-1 text-[12px] font-bold text-[var(--store-primary,#18181B)]"><PiggyBank weight="fill" />Economize {formatBRL(combo.save)}</div>
        )}

        <button
          type="button"
          onClick={addCombo}
          disabled={busy}
          className="font-display mt-3 flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[var(--store-primary,#18181B)] text-[13.5px] font-bold text-white transition-colors hover:bg-[var(--store-primary-dark,#09090B)] disabled:opacity-60"
        >
          {busy ? <Spinner className="animate-spin text-base" /> : <ShoppingCartSimple weight="bold" className="text-base" />}
          Adicionar
        </button>
      </div>
    </div>
  );
}
