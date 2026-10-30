"use client";

import * as React from "react";
import Link from "next/link";
import { Foto } from "@/components/ui/foto";

/** Outra opção de cota do mesmo bundle ("2 Box", "4 Box"). Selecionar = navegar para o slug. */
export interface PdpKitOption {
  id: string;
  slug: string;
  label: string;
  titleLabel?: string | null;
  highlightLabel?: string | null;
  description?: string | null;
  /** null quando o lojista esconde o preço do card (kitDisplay.showPrice) */
  displayPrice: string | null;
  compareAt?: string | null;
  perUnit?: string | null;
  perUnitLabel?: string | null;
  isSoldOut: boolean;
  isCurrent: boolean;
  /**
   * Só nas opções que repartem o slug com a página (o backend gerou o mesmo slug para os kits do bundle):
   * não há URL para navegar, então a opção é escolhida na própria página com os dados dela.
   */
  inline?: { kitId: string; required: number; price: number | null; oldPrice: number | null; flavors: PdpKitFlavor[] };
}

/** Um sabor que o cliente pode escolher para completar a cota. */
export interface PdpKitFlavor {
  productId: string;
  variantId: string;
  label: string;
  imageUrl?: string | null;
}

export interface PdpKit {
  id: string;
  /** a cota: quantos itens o cliente precisa escolher */
  required: number;
  options: PdpKitOption[];
  flavors: PdpKitFlavor[];
}

export type KitPicks = Record<string, number>;

export const kitTotal = (picks: KitPicks) => Object.values(picks).reduce((s, q) => s + q, 0);

/** Seletor de opção do bundle: cards em radio, como o BundleBoxSelect da loja Unbox. */
export function KitOptions({ options, selectedId, onSelect }: { options: PdpKitOption[]; selectedId: string; onSelect: (id: string) => void }) {
  if (options.length < 2) return null;
  return (
    <div className="mt-6" data-editor-ignore>
      <div className="mb-2.5 text-sm font-bold text-[var(--store-ink-2)]">Escolha uma opção</div>
      <div className="flex flex-col gap-3">
        {options.map((o) => {
          const sel = o.id === selectedId;
          const cls = "relative flex items-start gap-3 rounded-xl border-2 p-4 text-left text-[var(--store-ink)] no-underline transition-colors";
          const style = {
            background: sel ? "var(--store-primary-soft,#F1F1F3)" : "var(--store-surface)",
            borderColor: sel ? "var(--store-primary,#18181B)" : "var(--store-line-2)",
            ...(o.isSoldOut && !sel ? { opacity: 0.5 } : {}),
          } as React.CSSProperties;
          const inner = (
            <>
              {o.titleLabel && (
                <span className="absolute -top-3 right-4 rounded-md bg-[var(--store-primary,#18181B)] px-3 py-1 text-[11px] font-extrabold text-white">{o.titleLabel}</span>
              )}
              <span
                aria-hidden
                className="mt-0.5 inline-block h-[18px] w-[18px] shrink-0 rounded-full border-2"
                style={{
                  borderColor: sel ? "var(--store-primary,#18181B)" : "var(--store-faint)",
                  background: sel ? "radial-gradient(var(--store-primary,#18181B) 0 38%, var(--store-surface) 42%)" : "var(--store-surface)",
                }}
              />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-[15px] font-bold">{o.label}</span>
                  {o.highlightLabel && (
                    <span className="rounded-md bg-[var(--store-sale-soft)] px-2 py-0.5 text-[11px] font-extrabold text-[var(--store-sale)]">{o.highlightLabel}</span>
                  )}
                </span>
                {o.description && (
                  <span className="mt-1 block text-[12.5px] leading-[1.4] text-[var(--store-muted)]">
                    {o.description.split(/\\n|\n/).filter(Boolean).map((l, i) => <span key={i} className="block">{l}</span>)}
                  </span>
                )}
              </span>
              <span className="shrink-0 text-right">
                {o.compareAt && <span className="block text-[12.5px] text-[var(--store-faint)] line-through">{o.compareAt}</span>}
                {o.displayPrice && <span className="block text-[15px] font-extrabold text-[var(--store-primary,#18181B)]">{o.isSoldOut ? "Esgotado" : o.displayPrice}</span>}
                {o.perUnit && <span className="block text-[11.5px] text-[var(--store-muted)]">{o.perUnit}{o.perUnitLabel ? ` / ${o.perUnitLabel}` : ""}</span>}
              </span>
            </>
          );
          return sel ? (
            <div key={o.id} aria-current="true" className={`${cls} cursor-default`} style={style}>{inner}</div>
          ) : o.inline || o.isCurrent ? (
            <button key={o.id} type="button" onClick={() => onSelect(o.id)} className={`${cls} w-full cursor-pointer`} style={style}>{inner}</button>
          ) : (
            <Link key={o.id} href={`/produto/${o.slug}`} scroll={false} className={`${cls} cursor-pointer`} style={style}>{inner}</Link>
          );
        })}
      </div>
    </div>
  );
}

/** Contador de sabores: o cliente reparte a cota entre os itens, como o BundlePickCounter. */
export function KitPicker({ kit, picks, onChange }: { kit: PdpKit; picks: KitPicks; onChange: (variantId: string, qty: number) => void }) {
  const total = kitTotal(picks);
  const full = total >= kit.required;
  if (kit.flavors.length < 2) return null; // um sabor só: a cota inteira vai nele, sem o que escolher
  return (
    <div className="mt-6" data-editor-ignore>
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <span className="text-sm font-bold text-[var(--store-ink-2)]">Escolha os itens</span>
        <span className="text-[13px] font-bold text-[var(--store-primary,#18181B)]" aria-live="polite">Quantidade {total}/{kit.required}</span>
      </div>
      <div className="flex flex-col gap-2.5">
        {kit.flavors.map((f) => {
          const q = picks[f.variantId] ?? 0;
          return (
            <div key={f.variantId} className="flex items-center gap-3 rounded-xl border border-[var(--store-line-2)] bg-[var(--store-surface)] p-2.5">
              <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md bg-[var(--store-surface-2)]">
                {f.imageUrl && <Foto src={f.imageUrl} width={48} height={48} sizes="48px" className="h-full w-full object-cover" />}
              </span>
              <span className="min-w-0 flex-1 text-[14px] font-bold leading-[1.2] text-[var(--store-ink)] line-clamp-2">{f.label}</span>
              <span className="flex shrink-0 items-center overflow-hidden rounded-md border-[1.5px] border-[var(--store-line-2)] bg-white">
                <button type="button" aria-label={`Tirar ${f.label}`} onClick={() => onChange(f.variantId, q - 1)} disabled={q <= 0} className="h-10 w-9 cursor-pointer border-none bg-transparent text-lg text-[var(--store-ink-2)] disabled:opacity-40">−</button>
                <span className="w-8 text-center text-[14px] font-extrabold">{q}</span>
                <button type="button" aria-label={`Pôr ${f.label}`} onClick={() => onChange(f.variantId, q + 1)} disabled={full} className="h-10 w-9 cursor-pointer border-none bg-transparent text-lg text-[var(--store-ink-2)] disabled:opacity-40">+</button>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
