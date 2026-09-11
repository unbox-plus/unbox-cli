"use client";

// "Como usar / o ritual": crossfade automático de fotos + checklist com ícones + CTA.
// Portado de loja real em produção e genericizado. Conteúdo via receita; defaults neutros.
//
// EDITOR: selo, título e cada foto do crossfade são caminhos da seção (`foto-1`, `foto-2`…: a
// quantidade de fotos é da receita, não é lista); os passos são uma LISTA editável
// (`passos.passo-N`, com ícone e texto). No crossfade, as fotos que não estão na vez ficam
// `pointer-events-none`: assim o clique do lojista no editor cai na foto que ele está vendo, e não
// na última do empilhamento. O botão é um `Editable.Slot` de texto (o elemento já existe e não
// pode ganhar invólucro dentro do fluxo do botão).
import * as React from "react";
import { CheckCircle } from "@phosphor-icons/react/dist/ssr";
import { Editable, EditableScope } from "@/lib/editable";
import type { SectionComponentProps } from "./registry";

const DEFAULT_PHOTOS = ["/brand/ph/photo-a.svg", "/brand/ph/photo-b.svg", "/brand/ph/photo-c.svg"];
const DEFAULT_ITEMS = [
  "Escolha o que combina com a sua rotina",
  "Receba em casa, do nosso cuidado pro seu",
  "Use do seu jeito, no seu tempo",
  "Volte quando quiser: recompra em 2 cliques",
];

export function RitualSection({ sectionProps = {} }: SectionComponentProps) {
  const {
    badge = "simples assim",
    title = "Do pedido ao seu dia a dia",
    ctaLabel = "Ver destaques",
  } = sectionProps as Record<string, string>;
  const photos = (sectionProps.photos as string[] | undefined) ?? DEFAULT_PHOTOS;
  const items = (sectionProps.items as string[] | undefined) ?? DEFAULT_ITEMS;
  const [idx, setIdx] = React.useState(0);

  React.useEffect(() => {
    if (photos.length < 2) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % photos.length), 3200);
    return () => clearInterval(t);
  }, [photos.length]);

  return (
    <div className="mx-auto max-w-[var(--container-max,1240px)] px-4 pt-[var(--section-gap,52px)] sm:px-6">
      <div className="grid items-center gap-9 md:grid-cols-2">
        <div className="relative aspect-[4/5] max-h-[520px] w-full overflow-hidden rounded-2xl">
          {photos.map((p, i) => (
            /* TODO: fotos reais de uso/rotina */
            <Editable.Img
              key={p + i}
              path={`foto-${i + 1}`}
              fallback={{ src: p, alt: "" }}
              label={`Foto ${i + 1}`}
              className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${i === idx ? "opacity-100" : "pointer-events-none opacity-0"}`}
              loading="lazy"
              decoding="async"
            />
          ))}
        </div>
        <div>
          <Editable.Text path="selo" fallback={badge} label="Selo acima do título" className="rounded-full bg-[var(--store-primary-soft,#F1F1F3)] px-4 py-1.5 text-[12.5px] font-bold uppercase tracking-[0.6px] text-[var(--store-primary,#18181B)]" />
          <Editable.Text as="h2" path="titulo" fallback={title} label="Título" className="font-display mt-4" />
          <ul className="mt-6 flex flex-col gap-4">
            <EditableScope path="passos">
              <Editable.Sections nested>
                {items.map((t, i) => (
                  <Editable.Section key={t} item id={`passo-${i + 1}`} label={`Passo ${i + 1}`}>
                    <li className="flex items-start gap-3">
                      {/* a className era do ícone; vai pro invólucro do Icon pra não descolar da linha */}
                      <Editable.Icon path="icone" label="Ícone do passo" size={22} className="mt-0.5 shrink-0 text-[22px] text-[var(--store-primary,#18181B)]">
                        <CheckCircle weight="fill" />
                      </Editable.Icon>
                      <Editable.Text path="texto" fallback={t} label="Texto do passo" className="text-[15px] leading-[1.5] text-[var(--store-ink-2)]" />
                    </li>
                  </Editable.Section>
                ))}
              </Editable.Sections>
            </EditableScope>
          </ul>
          <Editable.Slot path="cta" type="text" fallback={ctaLabel} label="Botão">
            {(v, attrs, ref, estilo) => (
              <button
                ref={ref}
                type="button"
                onClick={() => document.getElementById("destaques")?.scrollIntoView({ behavior: "smooth" })}
                className="font-display mt-7 rounded-full bg-[var(--store-cta,#D97706)] px-7 py-3 text-[15px] font-extrabold text-[var(--store-cta-fg,#1C1207)] transition-colors hover:bg-[var(--store-cta-dark,#B45309)]"
                style={estilo}
                {...attrs}
              >
                {v}
              </button>
            )}
          </Editable.Slot>
        </div>
      </div>
    </div>
  );
}
