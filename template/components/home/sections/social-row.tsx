"use client";

// Fileira de comunidade/creators: cards de foto com badge de @handle (portado de loja real em produção).
// ⚠️ GENTE REAL: os defaults são placeholders neutros sem nome/seguidores. O agente troca
// por pessoas reais (com autorização de uso de imagem) via receita — números de seguidores
// só se forem verdadeiros.
import type { SectionComponentProps } from "./registry";
import { Foto } from "@/components/ui/foto";

type Person = { image: string; handle?: string; name?: string; meta?: string };

const DEFAULT_PEOPLE: Person[] = [
  { image: "/brand/ph/poster-a.svg", handle: "@suamarca" },
  { image: "/brand/ph/poster-b.svg", handle: "@suamarca" },
  { image: "/brand/ph/poster-c.svg", handle: "@suamarca" },
  { image: "/brand/ph/poster-a.svg", handle: "@suamarca" },
];

export function SocialRowSection({ sectionProps = {} }: SectionComponentProps) {
  const {
    title = "A comunidade da marca",
    subtitle = "Quem cria e compartilha com a gente.",
  } = sectionProps as Record<string, string>;
  const people = (sectionProps.people as Person[] | undefined) ?? DEFAULT_PEOPLE;
  return (
    <div className="mx-auto max-w-[var(--container-max,1240px)] px-4 pt-[var(--section-gap,52px)] sm:px-6">
      <div className="mb-[18px]">
        <h2 className="font-display text-[28px] font-extrabold leading-[1.15]">{title}</h2>
        <p className="mt-1 text-sm text-[var(--store-muted)]">{subtitle}</p>
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {people.map((p, i) => (
          <div key={i} className="overflow-hidden store-card rounded-2xl">
            <div className="relative">
              {/* TODO: fotos reais, com autorização de uso */}
              <Foto src={p.image} width={600} height={750} sizes="(min-width: 1024px) 300px, 50vw" className="aspect-[4/5] w-full object-cover" />
              {p.handle && <span className="absolute bottom-2.5 left-2.5 rounded-full bg-black/60 px-3 py-1 text-[12px] font-semibold text-white">{p.handle}</span>}
            </div>
            {(p.name || p.meta) && (
              <div className="px-4 py-3">
                {p.name && <div className="text-[14px] font-bold text-[var(--store-ink)]">{p.name}</div>}
                {p.meta && <div className="text-[12px] text-[var(--store-muted)]">{p.meta}</div>}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
