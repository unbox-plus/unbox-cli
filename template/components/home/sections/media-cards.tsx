"use client";

// Carrossel horizontal de cards de imagem com legenda sobreposta (na loja de referência: categorias
// de ingredientes). Serve pra ingredientes, materiais, coleções, bastidores...
// Conteúdo via receita; defaults neutros com placeholders recoloridos pela marca.
import * as React from "react";
import { CaretLeft, CaretRight } from "@phosphor-icons/react/dist/ssr";
import type { SectionComponentProps } from "./registry";
import { Foto } from "@/components/ui/foto";

type MediaCard = { image: string; title: string; text?: string };

const DEFAULT_CARDS: MediaCard[] = [
  { image: "/brand/ph/photo-a.svg", title: "Feito pra durar", text: "Escolha de materiais e fornecedores com critério." },
  { image: "/brand/ph/photo-b.svg", title: "Detalhe importa", text: "Acabamento e apresentação que fazem diferença." },
  { image: "/brand/ph/photo-c.svg", title: "Do nosso jeito", text: "Processo próprio, testado no dia a dia." },
  { image: "/brand/ph/photo-a.svg", title: "Pra sua rotina", text: "Pensado pra caber na vida real." },
];

export function MediaCardsSection({ sectionProps = {} }: SectionComponentProps) {
  const {
    title = "Por dentro do que você leva",
    subtitle = "O que entra em cada produto, sem segredo.",
  } = sectionProps as Record<string, string>;
  const cards = (sectionProps.cards as MediaCard[] | undefined) ?? DEFAULT_CARDS;
  const rowRef = React.useRef<HTMLDivElement | null>(null);
  const scrollRow = (dir: number) => rowRef.current?.scrollBy({ left: dir * 300, behavior: "smooth" });

  return (
    <div className="reveal mx-auto max-w-[var(--container-max,1240px)] px-4 pt-[var(--section-gap,52px)] sm:px-6">
      <div className="mb-[18px] flex items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-[28px] font-extrabold leading-[1.15]">{title}</h2>
          <p className="mt-1 text-sm text-[var(--store-muted)]">{subtitle}</p>
        </div>
        <div className="hidden gap-2.5 sm:flex">
          <button type="button" onClick={() => scrollRow(-1)} aria-label="Anterior" className="flex h-[42px] w-[42px] items-center justify-center rounded-full border-[1.5px] border-[var(--store-line-2)] bg-white hover:border-[var(--store-primary,#18181B)]"><CaretLeft weight="bold" className="text-[var(--store-ink-2)]" /></button>
          <button type="button" onClick={() => scrollRow(1)} aria-label="Próximo" className="flex h-[42px] w-[42px] items-center justify-center rounded-full border-[1.5px] border-[var(--store-line-2)] bg-white hover:border-[var(--store-primary,#18181B)]"><CaretRight weight="bold" className="text-[var(--store-ink-2)]" /></button>
        </div>
      </div>
      <div ref={rowRef} className="flex gap-[18px] overflow-x-auto pb-3.5 [scrollbar-width:thin]">
        {cards.map((c, i) => (
          <div key={i} className="relative w-[264px] flex-none overflow-hidden rounded-2xl">
            {/* TODO: trocar por fotos reais (aspect 4:5) */}
            <Foto src={c.image} width={528} height={660} sizes="264px" className="aspect-[4/5] w-full object-cover" />
            <div className="absolute inset-x-3 bottom-3 rounded-xl bg-[var(--store-chrome-bg,#18181B)]/92 px-4 py-3.5">
              <div className="font-display text-[15px] font-bold text-[var(--store-chrome-text,#ffffff)]">{c.title}</div>
              {c.text && <p className="mt-1 text-[12.5px] leading-[1.45] text-[var(--store-chrome-muted)]">{c.text}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
