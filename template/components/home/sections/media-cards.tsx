"use client";

// Carrossel horizontal de cards de imagem com legenda sobreposta (na loja de referência: categorias
// de ingredientes). Serve pra ingredientes, materiais, coleções, bastidores...
// Conteúdo via receita; defaults neutros com placeholders recoloridos pela marca.
//
// EDITOR: título e subtítulo são caminhos da seção; os cards são uma LISTA editável
// (`cards.card-N`, com foto, título e texto). O invólucro do item é display:contents, então quem
// continua sendo o filho do carrossel (`flex-none`) é o próprio card. As setas são interface.
// A foto continua passando pelo `Foto` (otimizador do Next): o `Editable.Slot` só lhe entrega o
// src/alt do lojista e os atributos de seleção.
import * as React from "react";
import { CaretLeft, CaretRight } from "@phosphor-icons/react/dist/ssr";
import { Editable, EditableScope } from "@/lib/editable";
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
          <Editable.Text as="h2" path="titulo" fallback={title} label="Título" className="font-display" />
          <Editable.Text as="p" path="subtitulo" fallback={subtitle} label="Subtítulo" className="mt-1 text-sm text-[var(--store-muted)]" />
        </div>
        <div className="hidden gap-2.5 sm:flex">
          <button type="button" onClick={() => scrollRow(-1)} aria-label="Anterior" className="flex h-[42px] w-[42px] items-center justify-center rounded-full border-[1.5px] border-[var(--store-line-2)] bg-white hover:border-[var(--store-primary,#18181B)]"><CaretLeft weight="bold" className="text-[var(--store-ink-2)]" /></button>
          <button type="button" onClick={() => scrollRow(1)} aria-label="Próximo" className="flex h-[42px] w-[42px] items-center justify-center rounded-full border-[1.5px] border-[var(--store-line-2)] bg-white hover:border-[var(--store-primary,#18181B)]"><CaretRight weight="bold" className="text-[var(--store-ink-2)]" /></button>
        </div>
      </div>
      <div ref={rowRef} className="flex gap-[18px] overflow-x-auto pb-3.5 [scrollbar-width:thin]">
        <EditableScope path="cards">
          <Editable.Sections nested>
            {cards.map((c, i) => (
              <Editable.Section key={i} item id={`card-${i + 1}`} label={`Card ${i + 1}`}>
                <div className="relative w-[264px] flex-none overflow-hidden rounded-2xl">
                  {/* TODO: trocar por fotos reais (aspect 4:5) */}
                  <Editable.Slot path="imagem" type="image" fallback={{ src: c.image, alt: "" }} label="Foto do card">
                    {(v, attrs, ref) => <Foto ref={ref} attrs={attrs} src={v.src} alt={v.alt ?? ""} width={528} height={660} sizes="264px" className="aspect-[4/5] w-full object-cover" />}
                  </Editable.Slot>
                  <div className="absolute inset-x-3 bottom-3 rounded-xl bg-[var(--store-chrome-bg,#18181B)]/92 px-4 py-3.5">
                    <Editable.Text as="div" path="titulo" fallback={c.title} label="Título do card" className="font-display text-[15px] font-bold text-[var(--store-chrome-text,#ffffff)]" />
                    {c.text && <Editable.Text as="p" path="texto" fallback={c.text} label="Texto do card" multiline className="mt-1 text-[12.5px] leading-[1.45] text-[var(--store-chrome-muted)]" />}
                  </div>
                </div>
              </Editable.Section>
            ))}
          </Editable.Sections>
        </EditableScope>
      </div>
    </div>
  );
}
