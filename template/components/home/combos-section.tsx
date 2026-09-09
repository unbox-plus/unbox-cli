"use client";

// Seção de combos da home (abaixo dos reviews). Layout em 3 colunas inspirado na referência:
// imagem + selo · nome/descrição/destaques/preço/CTA · lista "Este combo contém".
import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Package, Fire, Sparkle, Star, ShieldCheck, Heart, Tag, Gift,
  PiggyBank, ShoppingCartSimple, Spinner, CaretLeft, CaretRight,
} from "@phosphor-icons/react/dist/ssr";
import { useCart } from "@/components/cart/cart-provider";
import { formatBRL } from "@/lib/format";
import { ComboCardCompact } from "@/components/home/combo-card-compact";
import type { ResolvedCombo, ComboHighlight } from "@/lib/enrichment/combos";

const HIGHLIGHT_ICON: Record<ComboHighlight["icon"], React.ComponentType<any>> = {
  box: Package, fire: Fire, sparkle: Sparkle, star: Star,
  shield: ShieldCheck, heart: Heart, tag: Tag, gift: Gift,
};

export function CombosSection({ combos }: { combos: ResolvedCombo[] }) {
  const { add, setOpen } = useCart();
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const rowRef = React.useRef<HTMLDivElement | null>(null);

  if (combos.length === 0) return null;

  async function addCombo(combo: ResolvedCombo) {
    setBusyId(combo.id);
    try {
      // Adiciona cada item com o preço já com desconto do combo (silencioso) e abre o carrinho ao fim.
      for (const it of combo.items) {
        await add(
          {
            productId: it.productId,
            variantId: it.variantId,
            price: it.discountedPrice,
            quantity: it.qty,
            thumbnail: it.imageUrl ?? undefined,
            title: `${combo.name} · ${it.name}`,
          },
          { silent: true },
        );
      }
      setOpen(true);
    } finally {
      setBusyId(null);
    }
  }

  const scrollRow = (dir: number) => rowRef.current?.scrollBy({ left: dir * 720, behavior: "smooth" });

  return (
    <div className="mx-auto max-w-[1240px] px-4 pt-[42px] sm:px-6">
      <div className="mb-[18px] flex items-end justify-between gap-3">
        <div>
          <div className="text-xs font-extrabold tracking-[1.5px] text-[var(--store-primary,#18181B)]">KITS DA LOJA</div>
          <h2 className="font-display mt-1.5 text-[26px] font-extrabold">Monte seu kit com nossos combos</h2>
          <p className="mt-1 text-sm text-[var(--store-muted)]">Tudo combinado, com desconto e pronto pro carrinho.</p>
        </div>
        {combos.length > 1 && (
          <div className="hidden gap-2.5 sm:flex">
            <button type="button" onClick={() => scrollRow(-1)} aria-label="Anterior" className="flex h-[42px] w-[42px] items-center justify-center rounded-full border-[1.5px] border-[var(--store-line-2)] bg-white hover:border-[var(--store-primary,#18181B)]"><CaretLeft weight="bold" className="text-[var(--store-ink-2)]" /></button>
            <button type="button" onClick={() => scrollRow(1)} aria-label="Próximo" className="flex h-[42px] w-[42px] items-center justify-center rounded-full border-[1.5px] border-[var(--store-line-2)] bg-white hover:border-[var(--store-primary,#18181B)]"><CaretRight weight="bold" className="text-[var(--store-ink-2)]" /></button>
          </div>
        )}
      </div>

      {/* desktop: card grande em 3 colunas */}
      <div ref={rowRef} className="hidden snap-x gap-5 overflow-x-auto pb-3.5 [scrollbar-width:thin] md:flex">
        {combos.map((c) => (
          <ComboCard key={c.id} combo={c} busy={busyId === c.id} onAdd={() => addCombo(c)} />
        ))}
      </div>

      {/* mobile: versão compacta em carrossel */}
      <div className="flex snap-x gap-3.5 overflow-x-auto pb-3.5 [scrollbar-width:none] md:hidden">
        {combos.map((c) => (
          <ComboCardCompact key={c.id} combo={c} className="w-[230px] flex-none snap-start" />
        ))}
      </div>
    </div>
  );
}

function ComboCard({ combo, busy, onAdd }: { combo: ResolvedCombo; busy: boolean; onAdd: () => void }) {
  const highlights: ComboHighlight[] = [
    { icon: "box", label: `${combo.itemCount} itens` },
    ...combo.highlights,
  ];
  const hero = combo.imageUrl || combo.items[0]?.imageUrl || null;

  return (
    <div className="flex w-[min(96vw,1000px)] flex-none snap-start overflow-hidden rounded-2xl border border-[var(--store-line)] bg-[var(--store-surface)] lg:w-[1000px]">
      <div className="grid w-full grid-cols-1 lg:grid-cols-[0.9fr_1.1fr_1fr]">
        {/* coluna 1: imagem ocupa toda a coluna + selo sobreposto */}
        <div className="relative min-h-[260px] overflow-hidden border-b border-[var(--store-line)] bg-white lg:border-b-0 lg:border-r">
          {combo.badge && (
            <span className="absolute left-5 top-5 z-[2] rounded-full bg-[var(--store-cta-soft)] px-3 py-1 text-[11px] font-extrabold tracking-[0.4px] text-[var(--store-cta-fg)]">{combo.badge}</span>
          )}
          {hero ? (
            <Image src={hero} alt={combo.name} fill sizes="(max-width:1024px) 100vw, 320px" className="object-cover" />
          ) : (
            <span className="flex h-full items-center justify-center text-sm text-[var(--store-faint)]">{combo.name}</span>
          )}
        </div>

        {/* coluna 2: detalhes + CTA */}
        <div className="flex flex-col justify-center border-b border-[var(--store-line)] p-6 sm:p-7 lg:border-b-0 lg:border-r">
          <h3 className="font-display text-[26px] font-extrabold leading-[1.08] text-[var(--store-ink)]">{combo.name}</h3>
          <p className="mt-2 max-w-[360px] text-[15px] leading-[1.5] text-[var(--store-ink-2)]">{combo.description}</p>

          <div className="my-5 grid grid-cols-3 gap-2 border-y border-[var(--store-line)] py-4">
            {highlights.map((h, i) => {
              const Icon = HIGHLIGHT_ICON[h.icon];
              return (
                <div key={i} className="flex flex-col items-center gap-2 text-center">
                  <Icon className="text-[28px] text-[var(--store-primary,#18181B)]" />
                  <span className="text-[13px] font-semibold text-[var(--store-ink-2)]">{h.label}</span>
                </div>
              );
            })}
          </div>

          {combo.save > 0 && (
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="text-[15px] text-[var(--store-faint)] line-through">{formatBRL(combo.subtotal)}</span>
              <span className="rounded-md bg-[var(--store-cta,#D97706)] px-2 py-0.5 text-[12px] font-extrabold text-[var(--store-cta-fg,#1C1207)]">{combo.discountPct}% OFF</span>
            </div>
          )}
          <div className="font-display text-[34px] font-extrabold leading-[1.05] text-[var(--store-primary,#18181B)]">{formatBRL(combo.total)}</div>
          {combo.save > 0 && (
            <div className="mt-1 flex items-center gap-1.5 text-[14px] font-bold text-[var(--store-primary,#18181B)]"><PiggyBank weight="fill" />Economize {formatBRL(combo.save)}</div>
          )}

          <button
            type="button"
            onClick={onAdd}
            disabled={busy}
            className="font-display mt-5 flex h-[54px] w-full cursor-pointer items-center justify-center gap-2.5 rounded-xl bg-[var(--store-primary,#18181B)] text-[15px] font-bold tracking-[0.4px] text-white shadow-[var(--store-shadow-cta)] transition-colors hover:bg-[var(--store-primary-dark,#09090B)] disabled:opacity-60"
          >
            {busy ? <Spinner className="animate-spin text-lg" /> : <ShoppingCartSimple weight="bold" className="text-lg" />}
            ADICIONAR AO CARRINHO
          </button>
        </div>

        {/* coluna 3: itens do combo */}
        <div className="flex flex-col gap-2.5 p-6 sm:p-7">
          <div className="text-[15px] font-extrabold text-[var(--store-ink)]">Este combo contém:</div>
          {combo.items.map((it) => (
            <Link
              key={it.variantId}
              href={`/produto/${encodeURIComponent(it.slug)}`}
              className="flex items-center gap-3.5 rounded-lg border border-[var(--store-line)] bg-white p-2.5 pl-3 no-underline transition-colors hover:border-[var(--store-primary,#18181B)]"
            >
              <span className="relative flex h-[68px] w-[68px] shrink-0 items-center justify-center">
                {it.imageUrl ? <Image src={it.imageUrl} alt={it.name} fill sizes="68px" className="object-contain" /> : <Package className="text-[28px] text-[var(--store-faint)]" />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px] font-bold text-[var(--store-ink)]">{it.name}</div>
                {it.weight && <div className="text-[12.5px] text-[var(--store-muted)]">{it.weight}</div>}
              </div>
              <span className="shrink-0 text-[14px] font-extrabold text-[var(--store-primary,#18181B)]">{it.qty}×</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
