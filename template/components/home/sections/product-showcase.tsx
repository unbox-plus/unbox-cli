"use client";

// Vitrine de produtos com fundo colorido por card (portado da vitrine de uma loja real em produção).
// Diferença importante: aqui os produtos e PREÇOS vêm do CATÁLOGO REAL (data.combos),
// não de constante hardcoded. A receita pode customizar título, cores de fundo e CTA.
import Link from "next/link";
import type { SectionComponentProps } from "./registry";
import { Foto } from "@/components/ui/foto";

const DEFAULT_BGS = [
  "var(--store-primary-soft, #F1F1F3)",
  "var(--store-cta-soft, #FDF0DC)",
  "var(--store-surface-2)",
  "var(--store-sale-soft, #FBE7E7)",
];

export function ProductShowcaseSection({ data, sectionProps = {} }: SectionComponentProps) {
  const {
    title = "Escolha o seu",
    subtitle = "Os favoritos da loja, direto do catálogo.",
    ctaHref = "",
  } = sectionProps as Record<string, string>;
  const bgs = (sectionProps.backgrounds as string[] | undefined) ?? DEFAULT_BGS;
  const max = (sectionProps.max as number | undefined) ?? 4;
  const items = data.combos.slice(0, max);
  if (items.length === 0) return null;

  return (
    <div className="mx-auto max-w-[var(--container-max,1240px)] px-4 pt-[var(--section-gap,52px)] sm:px-6">
      <div className="mx-auto mb-7 max-w-[560px] text-center">
        <h2 className="font-display text-[28px] font-extrabold leading-[1.15]">{title}</h2>
        <p className="mt-1.5 text-[15px] text-[var(--store-muted)]">{subtitle}</p>
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {items.map((p, i) => (
          <Link key={p.slug} href={ctaHref || `/produto/${encodeURIComponent(p.slug)}`} className="group flex flex-col overflow-hidden rounded-2xl no-underline transition-transform hover:scale-[1.015]" style={{ background: bgs[i % bgs.length] }}>
            <div className="flex aspect-square items-center justify-center p-6">
              {p.imageUrl
                ? <Foto src={p.imageUrl} alt={p.title} width={560} height={560} sizes="(min-width: 1024px) 280px, 45vw" className="max-h-full max-w-full object-contain transition-transform group-hover:scale-105" />
                : <span className="font-display text-[42px] font-extrabold text-[var(--store-primary,#18181B)]/30">{p.title[0]}</span>}
            </div>
            <div className="px-5 pb-5 text-center">
              <div className="font-display text-[16px] font-extrabold leading-[1.25] text-[var(--store-ink)]">{p.title}</div>
              <div className="mt-1.5 text-[14.5px] font-bold text-[var(--store-primary,#18181B)]">{p.displayPrice}</div>
              <span className="font-display mt-3 inline-block rounded-full bg-[var(--store-primary,#18181B)] px-5 py-2 text-[13px] font-extrabold text-white transition-colors group-hover:bg-[var(--store-primary-dark,#09090B)]">comprar</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
