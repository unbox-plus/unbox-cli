"use client";

// História da marca: card com foto de fundo e bloco de texto sobreposto + assinatura.
// Portado de loja real em produção e genericizado. Âncora #nossa-historia (pode ser alvo do menu).
//
// EDITOR: foto, título, texto e assinatura são caminhos da seção. A assinatura só registra caminho
// quando a receita a traz: não abrimos ponto de "assinatura" numa história que não é assinada.
// A foto continua passando pelo `Foto` (otimizador do Next): o `Editable.Slot` só lhe entrega o
// src/alt do lojista e os atributos de seleção.
import { Editable } from "@/lib/editable";
import type { SectionComponentProps } from "./registry";
import { Foto } from "@/components/ui/foto";

export function FounderStorySection({ sectionProps = {} }: SectionComponentProps) {
  const {
    title = "Nossa história",
    text = "",
    signature = "",
    image = "/brand/ph/photo-c.svg",
  } = sectionProps as Record<string, string>;
  // História é da marca: sem texto na receita, a seção não renderiza (nada de história genérica).
  if (!text) return null;
  return (
    <div id="nossa-historia" className="reveal mx-auto max-w-[var(--container-max,1240px)] scroll-mt-24 px-4 pt-[var(--section-gap,52px)] sm:px-6">
      <div className="relative overflow-hidden rounded-2xl">
        {/* TODO: foto real de bastidor/fundador (desktop ~21:9) */}
        <Editable.Slot path="imagem" type="image" fallback={{ src: image, alt: "" }} label="Foto de fundo">
          {(v, attrs, ref) => <Foto ref={ref} attrs={attrs} src={v.src} alt={v.alt ?? ""} width={2480} height={840} sizes="(min-width: 1280px) 1240px, 100vw" className="h-[420px] w-full object-cover sm:h-[460px]" />}
        </Editable.Slot>
        <div className="absolute inset-0 flex items-end p-5 sm:items-center sm:p-10">
          <div className="max-w-[480px] rounded-2xl bg-white/95 p-6 sm:p-8">
            <Editable.Text as="h2" path="titulo" fallback={title} label="Título" className="font-display text-[24px] font-extrabold" />
            <Editable.Text as="p" path="texto" fallback={text} label="Texto da história" multiline className="mt-3 text-[14.5px] leading-[1.6] text-[var(--store-ink-2)]" />
            {signature && <Editable.Text as="div" path="assinatura" fallback={signature} label="Assinatura" className="font-display mt-4 text-[18px] font-bold italic text-[var(--store-primary,#18181B)]" />}
          </div>
        </div>
      </div>
    </div>
  );
}
