"use client";

// Carrossel de reviews em card bordado com pílulas de tema (portado do carrossel de clube de uma loja real em produção).
// Reviews REAIS via receita (props.reviews). Sem elas a seção não renderiza — não existe
// default: "Cliente A/B/C" fabricado foi ao ar em loja real.
import * as React from "react";
import { CaretLeft, CaretRight } from "@phosphor-icons/react/dist/ssr";
import { Stars } from "./stars";
import type { SectionComponentProps } from "./registry";

type Review = { name: string; quote: string; tag?: string; stars?: number };

export function ReviewsCarouselSection({ sectionProps = {} }: SectionComponentProps) {
  const { title = "O que dizem nossos clientes" } = sectionProps as Record<string, string>;
  const reviews = (sectionProps.reviews as Review[] | undefined) ?? [];
  const tags = [...new Set(reviews.map((r) => r.tag).filter(Boolean))] as string[];
  const [active, setActive] = React.useState<string | null>(null);
  const [idx, setIdx] = React.useState(0);
  const visible = active ? reviews.filter((r) => r.tag === active) : reviews;
  const current = visible[Math.min(idx, visible.length - 1)] ?? reviews[0];

  const step = (d: number) => setIdx((i) => (i + d + visible.length) % visible.length);

  if (!reviews.length) return null;
  const comNota = reviews.filter((r) => r.stars != null);
  const media = comNota.length ? comNota.reduce((s, r) => s + (r.stars as number), 0) / comNota.length : null;

  return (
    <div className="mx-auto max-w-[var(--container-max,1240px)] px-4 pt-[var(--section-gap,52px)] sm:px-6">
      <div className="rounded-2xl border-2 border-[var(--store-primary,#18181B)]/25 bg-[var(--store-surface)] p-6 sm:p-9">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-[24px] font-extrabold">{title}</h2>
          <Stars n={media} className="text-[16px] text-[#B45309]" />
        </div>
        {tags.length > 1 && (
          <div className="mt-5 flex flex-wrap gap-2">
            {[null, ...tags].map((t) => (
              <button key={t ?? "todos"} type="button" onClick={() => { setActive(t); setIdx(0); }} className={`rounded-full border px-4 py-1.5 text-[13px] font-semibold transition-colors ${active === t ? "border-[var(--store-primary,#18181B)] bg-[var(--store-primary,#18181B)] text-white" : "border-[var(--store-line-2)] bg-white text-[var(--store-ink-2)] hover:border-[var(--store-primary,#18181B)]"}`}>{t ?? "todos"}</button>
            ))}
          </div>
        )}
        <div className="mt-6 flex items-center gap-4">
          <button type="button" onClick={() => step(-1)} aria-label="Anterior" className="hidden h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full border-[1.5px] border-[var(--store-line-2)] bg-white hover:border-[var(--store-primary,#18181B)] sm:flex"><CaretLeft weight="bold" /></button>
          <div className="min-h-[110px] flex-1 rounded-xl bg-white p-6">
            <p className="text-[15.5px] leading-[1.6] text-[var(--store-ink-2)]">“{current.quote}”</p>
            <div className="mt-3 text-[13.5px] font-bold text-[var(--store-ink)]">{current.name}</div>
          </div>
          <button type="button" onClick={() => step(1)} aria-label="Próximo" className="hidden h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full border-[1.5px] border-[var(--store-line-2)] bg-white hover:border-[var(--store-primary,#18181B)] sm:flex"><CaretRight weight="bold" /></button>
        </div>
        <div className="mt-4 flex justify-center gap-1.5">
          {visible.map((_, i) => (
            <button key={i} type="button" onClick={() => setIdx(i)} aria-label={`Review ${i + 1}`} className={`h-2 w-2 rounded-full ${i === idx ? "bg-[var(--store-primary,#18181B)]" : "bg-[var(--store-line-2)]"}`} />
          ))}
        </div>
      </div>
    </div>
  );
}
