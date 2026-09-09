"use client";

// Grid de destaques com imagem circular + texto (na loja de referência: estatísticas de eficácia).
// ⚠️ NÚMERO SÓ COM DADO REAL: os defaults são qualitativos de propósito. Se a marca tiver
// pesquisa/estatística de verdade, a receita passa `stats` com os valores reais e a fonte.
//
// EDITOR: o título é caminho da seção; os cards são uma LISTA editável (`destaques.destaque-N`) com
// imagem, número (quando a receita traz), texto e fonte. Número e fonte só registram caminho quando
// a receita os passa: não abrimos ponto de "número" numa seção que por regra não inventa número.
// A imagem continua passando pelo `Foto` (otimizador do Next): o `Editable.Slot` só lhe entrega o
// src/alt do lojista e os atributos de seleção.
import { Editable, EditableScope } from "@/lib/editable";
import type { SectionComponentProps } from "./registry";
import { Foto } from "@/components/ui/foto";

type Stat = { value?: string; text: string; image?: string; source?: string };

const DEFAULT_STATS: Stat[] = [
  { text: "Clientes que voltam pra segunda compra", image: "/brand/ph/avatar-a.svg" },
  { text: "Entrega acompanhada do pedido à porta", image: "/brand/ph/avatar-b.svg" },
  { text: "Troca simples se algo não ficar certo", image: "/brand/ph/avatar-c.svg" },
  { text: "Atendimento que responde de verdade", image: "/brand/ph/avatar-d.svg" },
];

export function StatsGridSection({ sectionProps = {} }: SectionComponentProps) {
  const { title = "O que sustenta a nossa promessa" } = sectionProps as Record<string, string>;
  const stats = (sectionProps.stats as Stat[] | undefined) ?? DEFAULT_STATS;
  return (
    <div className="mx-auto max-w-[var(--container-max,1240px)] px-4 pt-[var(--section-gap,52px)] sm:px-6">
      <Editable.Text as="h2" path="titulo" fallback={title} label="Título" className="font-display mx-auto max-w-[560px] text-center text-[28px] font-extrabold leading-[1.15]" />
      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {/* o invólucro do item é display:contents: quem continua sendo a célula do grid é o card */}
        <EditableScope path="destaques">
          <Editable.Sections nested>
            {stats.map((s, i) => (
              <Editable.Section key={i} item id={`destaque-${i + 1}`} label={`Destaque ${i + 1}`}>
                <div className="flex flex-col items-center gap-4 store-card rounded-2xl px-5 py-7 text-center">
                  {s.image && (
                    <Editable.Slot path="imagem" type="image" fallback={{ src: s.image, alt: "" }} label="Imagem do destaque">
                      {(v, attrs, ref) => <Foto ref={ref} attrs={attrs} src={v.src} alt={v.alt ?? ""} width={160} height={160} sizes="80px" className="h-20 w-20 rounded-full object-cover" />}
                    </Editable.Slot>
                  )}
                  {s.value && <Editable.Text as="div" path="valor" fallback={s.value} label="Número do destaque" className="font-display text-[34px] font-extrabold leading-none text-[var(--store-primary,#18181B)]" />}
                  <Editable.Text as="p" path="texto" fallback={s.text} label="Texto do destaque" multiline className="text-[14px] font-medium leading-[1.5] text-[var(--store-ink-2)]" />
                  {s.source && <Editable.Text as="div" path="fonte" fallback={s.source} label="Fonte do número" className="text-[11px] text-[var(--store-faint)]" />}
                </div>
              </Editable.Section>
            ))}
          </Editable.Sections>
        </EditableScope>
      </div>
    </div>
  );
}
