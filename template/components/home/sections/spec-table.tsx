"use client";

// Faixa de especificações: texto+CTA / tabela de linhas / foto — com modal de tabela
// completa. Serve pra ficha técnica, composição, medidas — e tabela nutricional, se for alimento.
// Conteúdo SÓ via receita (props.rows): sem linhas, a seção não renderiza. "Origem: Brasil" e
// "garantia" não são dados da foundation, são do produto.
import * as React from "react";
import { X } from "@phosphor-icons/react/dist/ssr";
import type { SectionComponentProps } from "./registry";

type Row = { label: string; value: string };


export function SpecTableSection({ sectionProps = {} }: SectionComponentProps) {
  const {
    title = "Ficha completa, sem letra miúda",
    text = "",
    ctaLabel = "Ver ficha completa",
    image = "/brand/ph/photo-b.svg",
    modalTitle = "Ficha completa",
  } = sectionProps as Record<string, string>;
  const rows = ((sectionProps.rows as Row[] | undefined) ?? []).filter((r) => r?.label && r?.value);
  const modalRows = (sectionProps.modalRows as Row[] | undefined) ?? rows;
  const [open, setOpen] = React.useState(false);
  if (rows.length === 0) return null;

  return (
    <div className="mt-[52px] bg-[var(--store-surface-2)]">
      <div className="mx-auto grid max-w-[var(--container-max,1240px)] items-center gap-8 px-4 py-12 sm:px-6 md:grid-cols-[1fr_1.1fr_0.9fr]">
        <div>
          <h2 className="font-display text-[26px] font-extrabold leading-[1.2]">{title}</h2>
          {text && <p className="mt-2.5 text-[14.5px] leading-[1.55] text-[var(--store-muted)]">{text}</p>}
          <button type="button" onClick={() => setOpen(true)} className="font-display mt-5 rounded-full bg-[var(--store-primary,#18181B)] px-6 py-2.5 text-[14px] font-bold text-white transition-colors hover:bg-[var(--store-primary-dark,#09090B)]">{ctaLabel}</button>
        </div>
        <div className="rounded-2xl border border-[var(--store-line-2)] bg-white p-1.5">
          {rows.map((r, i) => (
            <div key={i} className={`flex items-center justify-between gap-4 px-4 py-2.5 text-[13.5px] ${i > 0 ? "border-t border-[var(--store-line)]" : ""}`}>
              <span className="font-semibold text-[var(--store-ink-2)]">{r.label}</span>
              <span className="text-right text-[var(--store-muted)]">{r.value}</span>
            </div>
          ))}
        </div>
        {/* TODO: foto real do produto */}
        <img src={image} alt="" className="hidden h-full max-h-[320px] w-full rounded-2xl object-cover md:block" loading="lazy" decoding="async" />
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setOpen(false)}>
          <div className="max-h-[85vh] w-full max-w-[560px] overflow-y-auto rounded-2xl bg-white p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-display text-[20px] font-extrabold">{modalTitle}</h3>
              <button type="button" onClick={() => setOpen(false)} aria-label="Fechar" className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--store-line-2)] hover:bg-[var(--store-surface)]"><X weight="bold" /></button>
            </div>
            <div className="rounded-xl border border-[var(--store-line-2)]">
              {modalRows.map((r, i) => (
                <div key={i} className={`flex items-center justify-between gap-4 px-4 py-2.5 text-[13.5px] ${i > 0 ? "border-t border-[var(--store-line)]" : ""}`}>
                  <span className="font-semibold text-[var(--store-ink-2)]">{r.label}</span>
                  <span className="text-right text-[var(--store-muted)]">{r.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
