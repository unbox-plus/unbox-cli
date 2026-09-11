"use client";

// Fileira de comunidade/creators: cards de foto com badge de @handle (portado de loja real em produção).
// ⚠️ GENTE REAL: os defaults são placeholders neutros sem nome/seguidores. O agente troca
// por pessoas reais (com autorização de uso de imagem) via receita — números de seguidores
// só se forem verdadeiros.
//
// EDITOR: título e subtítulo são caminhos da seção; as pessoas são uma LISTA editável
// (`pessoas.pessoa-N`, com foto, @ e, quando a receita traz, nome e detalhe). O invólucro do item é
// display:contents, então quem continua sendo a célula do grid é o próprio card. A foto continua
// passando pelo `Foto` (otimizador do Next): o `Editable.Slot` só lhe entrega o src/alt do lojista
// e os atributos de seleção.
import { Editable, EditableScope } from "@/lib/editable";
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
        <Editable.Text as="h2" path="titulo" fallback={title} label="Título" className="font-display" />
        <Editable.Text as="p" path="subtitulo" fallback={subtitle} label="Subtítulo" className="mt-1 text-sm text-[var(--store-muted)]" />
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <EditableScope path="pessoas">
          <Editable.Sections nested>
            {people.map((p, i) => (
              <Editable.Section key={i} item id={`pessoa-${i + 1}`} label={`Pessoa ${i + 1}`}>
                <div className="overflow-hidden store-card rounded-2xl">
                  <div className="relative">
                    {/* TODO: fotos reais, com autorização de uso */}
                    <Editable.Slot path="imagem" type="image" fallback={{ src: p.image, alt: "" }} label="Foto">
                      {(v, attrs, ref) => <Foto ref={ref} attrs={attrs} src={v.src} alt={v.alt ?? ""} width={600} height={750} sizes="(min-width: 1024px) 300px, 50vw" className="aspect-[4/5] w-full object-cover" />}
                    </Editable.Slot>
                    {p.handle && <Editable.Text path="arroba" fallback={p.handle} label="Perfil (@)" className="absolute bottom-2.5 left-2.5 rounded-full bg-black/60 px-3 py-1 text-[12px] font-semibold text-white" />}
                  </div>
                  {(p.name || p.meta) && (
                    <div className="px-4 py-3">
                      {p.name && <Editable.Text as="div" path="nome" fallback={p.name} label="Nome" className="text-[14px] font-bold text-[var(--store-ink)]" />}
                      {p.meta && <Editable.Text as="div" path="detalhe" fallback={p.meta} label="Detalhe" className="text-[12px] text-[var(--store-muted)]" />}
                    </div>
                  )}
                </div>
              </Editable.Section>
            ))}
          </Editable.Sections>
        </EditableScope>
      </div>
    </div>
  );
}
