"use client";

// Comparativo "nós vs outros" — tabela ESTRUTURAL (a loja de referência usava imagem raster; aqui é
// componente de verdade: acessível, responsivo e recolorível). Conteúdo via receita.
// ⚠️ Compare ATRIBUTOS do seu produto, sem citar marcas concorrentes nem inventar dado.
import { CheckCircle, XCircle } from "@phosphor-icons/react/dist/ssr";
import type { SectionComponentProps } from "./registry";

type CompRow = { label: string; us: boolean | string; others: boolean | string };


function Cell({ v }: { v: boolean | string }) {
  if (v === true) return <CheckCircle weight="fill" className="mx-auto text-[22px] text-[var(--store-primary,#18181B)]" />;
  if (v === false) return <XCircle weight="fill" className="mx-auto text-[22px] text-[var(--store-faint)]" />;
  return <span className="text-[13px] text-[var(--store-muted)]">{v}</span>;
}

export function ComparisonSection({ sectionProps = {} }: SectionComponentProps) {
  const {
    title = "Compare e escolha bem",
    usLabel = "Aqui",
    othersLabel = "Por aí",
  } = sectionProps as Record<string, string>;
  const rows = ((sectionProps.rows as CompRow[] | undefined) ?? []).filter((r) => r?.label);
  if (rows.length === 0) return null; // comparativo é afirmação sobre o produto: só com dado da marca
  return (
    <div className="mx-auto max-w-[880px] px-4 pt-[var(--section-gap,52px)] sm:px-6">
      <h2 className="font-display text-center text-[28px] font-extrabold leading-[1.15]">{title}</h2>
      <div className="mt-7 overflow-hidden rounded-2xl border border-[var(--store-line-2)] bg-white">
        <div className="grid grid-cols-[1.6fr_1fr_1fr] border-b border-[var(--store-line)] bg-[var(--store-surface)] text-center">
          <div />
          <div className="font-display py-3 text-[14px] font-extrabold text-[var(--store-primary,#18181B)]">{usLabel}</div>
          <div className="font-display py-3 text-[14px] font-bold text-[var(--store-muted)]">{othersLabel}</div>
        </div>
        {rows.map((r, i) => (
          <div key={i} className={`grid grid-cols-[1.6fr_1fr_1fr] items-center text-center ${i > 0 ? "border-t border-[var(--store-line)]" : ""}`}>
            <div className="px-4 py-3.5 text-left text-[14px] font-semibold text-[var(--store-ink-2)]">{r.label}</div>
            <div className="py-3.5"><Cell v={r.us} /></div>
            <div className="py-3.5"><Cell v={r.others} /></div>
          </div>
        ))}
      </div>
    </div>
  );
}
