"use client";

// REVIEWS — depoimentos. Variantes: "grid" (3 colunas, default) e "faixa" (linha única
// horizontal, mais discreta — combina com estilos minimalistas).
// SÓ com depoimentos reais, vindos da receita (props.reviews, preenchidos no briefing a partir
// de avaliações que existem). Sem eles, a seção não renderiza. Não há default: a foundation
// publicava "Cliente A/B/C" com selo de compra verificada, e isso foi ao ar em loja real.
//
// EDITOR: só o TÍTULO é caminho da seção. As avaliações são dado de terceiros (quem fala é o
// cliente, não a marca) e a nota média é número vindo de dados: a regra §8 do README do editor
// os deixa fora dos primitivos, e a lista sai do gate por `data-editor-ignore`.
import { SealCheck } from "@phosphor-icons/react/dist/ssr";
import { Star } from "@phosphor-icons/react/dist/ssr";
import { Editable } from "@/lib/editable";
import { Stars } from "./stars";
import type { SectionComponentProps } from "./registry";

export interface HomeReview { name: string; quote: string; stars?: number; verified?: boolean }

export function ReviewsSection({ variant = "grid", sectionProps = {} }: SectionComponentProps) {
  const REVIEWS = (sectionProps.reviews as HomeReview[] | undefined) ?? [];
  const { title = "O que dizem nossos clientes" } = sectionProps as Record<string, string>;
  if (!REVIEWS.length) return null;
  const comNota = REVIEWS.filter((r) => r.stars != null);
  const media = comNota.length ? (comNota.reduce((s, r) => s + (r.stars as number), 0) / comNota.length).toFixed(1).replace(".", ",") : null;
  if (variant === "faixa") {
    return (
      <div className="mx-auto max-w-[var(--container-max,1240px)] px-4 pt-[42px] sm:px-6">
        <div className="flex gap-[18px] overflow-x-auto rounded-xl border border-[var(--store-line)] bg-[var(--store-surface)] px-6 py-5 [scrollbar-width:thin]" data-editor-ignore="">
          {REVIEWS.map((r) => (
            <div key={r.name} className="flex min-w-[300px] flex-1 items-start gap-3.5">
              <Stars n={r.stars} className="mt-0.5 flex text-[13px] text-[var(--store-cta-dark)]" />
              <div>
                <p className="text-[14px] leading-[1.5] text-[var(--store-ink-2)]">“{r.quote}”</p>
                <div className="mt-1.5 text-[12.5px] font-bold text-[var(--store-muted)]">{r.name}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // grid (default)
  return (
    <div className="mx-auto max-w-[var(--container-max,1240px)] px-4 pt-[42px] sm:px-6">
      <div className="mb-[18px] flex items-end justify-between">
        <Editable.Text as="h2" path="titulo" fallback={title} label="Título" className="font-display" />
        {media && <div className="flex items-center gap-2 text-sm font-semibold text-[var(--store-muted)]" data-editor-ignore=""><Star weight="fill" className="text-[17px] text-[var(--store-cta-dark)]" /><b className="text-[var(--store-ink)]">{media}</b></div>}
      </div>
      <div className="grid gap-[18px] md:grid-cols-3" data-editor-ignore="">
        {REVIEWS.map((r) => (
          <div key={r.name} className="flex flex-col gap-3.5 store-card rounded-xl p-6">
            <Stars n={r.stars} className="flex text-[15px] text-[var(--store-cta-dark)]" />
            <p className="flex-1 text-[15px] leading-[1.55] text-[var(--store-ink-2)]">“{r.quote}”</p>
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-[var(--store-primary-soft,#F1F1F3)] bg-[var(--store-chrome-bg,#18181B)] text-sm font-extrabold text-white">{r.name[0]}</span>
              <div>
                <div className="text-sm font-bold text-[var(--store-ink)]">{r.name}</div>
                {r.verified && <div className="mt-0.5 flex items-center gap-1.5 text-xs font-semibold text-[var(--store-primary,#18181B)]"><SealCheck weight="fill" />Compra verificada</div>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
